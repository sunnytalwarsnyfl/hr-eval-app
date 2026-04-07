const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/reports/dashboard
router.get('/dashboard', (req, res) => {
  const db = getDb();

  // Total evals this month
  const thisMonth = db.prepare(`
    SELECT COUNT(*) AS count FROM evaluations
    WHERE strftime('%Y-%m', evaluation_date) = strftime('%Y-%m', 'now')
    AND status != 'Draft'
  `).get();

  // Average score percentage (non-draft evals)
  const avgScore = db.prepare(`
    SELECT ROUND(AVG(CAST(total_score AS FLOAT) / max_score * 100), 1) AS avg_pct
    FROM evaluations
    WHERE status != 'Draft' AND max_score > 0
  `).get();

  // Employees due for eval (no eval in 12+ months or never)
  const employeesDue = db.prepare(`
    SELECT COUNT(*) AS count FROM employees e
    WHERE e.active = 1
    AND (
      NOT EXISTS (
        SELECT 1 FROM evaluations ev
        WHERE ev.employee_id = e.id AND ev.status != 'Draft'
      )
      OR (
        SELECT MAX(ev.evaluation_date) FROM evaluations ev
        WHERE ev.employee_id = e.id AND ev.status != 'Draft'
      ) < date('now', '-12 months')
    )
  `).get();

  // Active PIPs (all PIPs on non-draft evaluations)
  const activePips = db.prepare(`
    SELECT COUNT(*) AS count FROM pip_plans pp
    JOIN evaluations ev ON pp.evaluation_id = ev.id
    WHERE ev.status != 'Draft'
  `).get();

  // Recent evaluations
  const recentEvals = db.prepare(`
    SELECT ev.id, ev.evaluation_date, ev.evaluation_type, ev.status,
           ev.total_score, ev.max_score, ev.passed,
           e.name AS employee_name, e.department,
           u.name AS evaluator_name
    FROM evaluations ev
    JOIN employees e ON ev.employee_id = e.id
    LEFT JOIN users u ON ev.evaluator_id = u.id
    WHERE ev.status != 'Draft'
    ORDER BY ev.evaluation_date DESC
    LIMIT 10
  `).all();

  // Overdue employees list
  const overdueEmployees = db.prepare(`
    SELECT e.id, e.name, e.department, e.tech_level,
           MAX(ev.evaluation_date) AS last_eval_date
    FROM employees e
    LEFT JOIN evaluations ev ON e.id = ev.employee_id AND ev.status != 'Draft'
    WHERE e.active = 1
    GROUP BY e.id
    HAVING last_eval_date IS NULL OR last_eval_date < date('now', '-12 months')
    ORDER BY last_eval_date ASC NULLS FIRST
  `).all();

  // Attendance summary: employees with active attendance points > 0
  let attendance_summary = 0;
  try {
    const attRow = db.prepare(`
      SELECT COUNT(DISTINCT employee_id) AS count
      FROM attendance_log
      WHERE roll_off_date > date('now') AND accumulated_points > 0
    `).get();
    attendance_summary = attRow.count;
  } catch (_) {}

  // Disciplinary open: count of open (Incomplete) disciplinary actions
  let disciplinary_open = 0;
  try {
    const discRow = db.prepare(`
      SELECT COUNT(*) AS count FROM disciplinary_actions WHERE status = 'Incomplete'
    `).get();
    disciplinary_open = discRow.count;
  } catch (_) {}

  // QA incomplete: count of incomplete QA items
  let qa_incomplete = 0;
  try {
    const qaRow = db.prepare(`
      SELECT COUNT(*) AS count FROM qa_log WHERE status = 'Incomplete'
    `).get();
    qa_incomplete = qaRow.count;
  } catch (_) {}

  // Evals due in 30 days: employees with hire anniversary within next 30 days
  let evals_due_30 = 0;
  try {
    const evalsDueRow = db.prepare(`
      SELECT COUNT(*) AS count FROM employees
      WHERE active = 1
        AND (
          CAST(strftime('%j', date('now', '+30 days')) AS INTEGER) >=
            CASE
              WHEN CAST(strftime('%j', date(hire_date, '+' || (strftime('%Y','now') - strftime('%Y', hire_date)) || ' years')) AS INTEGER) >= CAST(strftime('%j', 'now') AS INTEGER)
              THEN CAST(strftime('%j', date(hire_date, '+' || (strftime('%Y','now') - strftime('%Y', hire_date)) || ' years')) AS INTEGER)
              ELSE CAST(strftime('%j', date(hire_date, '+' || (strftime('%Y','now') - strftime('%Y', hire_date) + 1) || ' years')) AS INTEGER)
            END
          AND
            CASE
              WHEN CAST(strftime('%j', date(hire_date, '+' || (strftime('%Y','now') - strftime('%Y', hire_date)) || ' years')) AS INTEGER) >= CAST(strftime('%j', 'now') AS INTEGER)
              THEN CAST(strftime('%j', date(hire_date, '+' || (strftime('%Y','now') - strftime('%Y', hire_date)) || ' years')) AS INTEGER)
              ELSE CAST(strftime('%j', date(hire_date, '+' || (strftime('%Y','now') - strftime('%Y', hire_date) + 1) || ' years')) AS INTEGER)
            END >= CAST(strftime('%j', 'now') AS INTEGER)
        )
    `).get();
    evals_due_30 = evalsDueRow.count;
  } catch (_) {}

  res.json({
    total_this_month: thisMonth.count,
    avg_score_pct: avgScore.avg_pct || 0,
    employees_due: employeesDue.count,
    active_pips: activePips.count,
    recent_evals: recentEvals,
    overdue_employees: overdueEmployees,
    attendance_summary,
    disciplinary_open,
    qa_incomplete,
    evals_due_30
  });
});

// GET /api/reports/dept-scores
router.get('/dept-scores', (req, res) => {
  const db = getDb();
  const { start_date, end_date } = req.query;

  let query = `
    SELECT e.department,
           COUNT(*) AS eval_count,
           ROUND(AVG(CAST(ev.total_score AS FLOAT) / ev.max_score * 100), 1) AS avg_score_pct,
           SUM(CASE WHEN ev.passed = 1 THEN 1 ELSE 0 END) AS passed_count,
           SUM(CASE WHEN ev.passed = 0 THEN 1 ELSE 0 END) AS failed_count
    FROM evaluations ev
    JOIN employees e ON ev.employee_id = e.id
    WHERE ev.status != 'Draft' AND ev.max_score > 0
  `;

  const params = [];
  if (start_date) { query += ` AND ev.evaluation_date >= ?`; params.push(start_date); }
  if (end_date) { query += ` AND ev.evaluation_date <= ?`; params.push(end_date); }

  query += ` GROUP BY e.department ORDER BY avg_score_pct DESC`;

  const data = db.prepare(query).all(...params);
  res.json({ data });
});

// GET /api/reports/evals-due
router.get('/evals-due', (req, res) => {
  const db = getDb();

  const data = db.prepare(`
    SELECT e.id, e.name, e.department, e.job_title, e.tech_level, e.hire_date,
           MAX(ev.evaluation_date) AS last_eval_date,
           u.name AS manager_name,
           julianday('now') - julianday(COALESCE(MAX(ev.evaluation_date), e.hire_date)) AS days_since_eval
    FROM employees e
    LEFT JOIN evaluations ev ON e.id = ev.employee_id AND ev.status != 'Draft'
    LEFT JOIN users u ON e.manager_id = u.id
    WHERE e.active = 1
    GROUP BY e.id
    HAVING last_eval_date IS NULL OR last_eval_date < date('now', '-12 months')
    ORDER BY days_since_eval DESC
  `).all();

  res.json({ data });
});

// GET /api/reports/score-distribution
router.get('/score-distribution', (req, res) => {
  const db = getDb();
  const { start_date, end_date } = req.query;

  let query = `
    SELECT
      CASE
        WHEN CAST(total_score AS FLOAT) / max_score * 100 < 50 THEN '0-49%'
        WHEN CAST(total_score AS FLOAT) / max_score * 100 < 60 THEN '50-59%'
        WHEN CAST(total_score AS FLOAT) / max_score * 100 < 70 THEN '60-69%'
        WHEN CAST(total_score AS FLOAT) / max_score * 100 < 80 THEN '70-79%'
        WHEN CAST(total_score AS FLOAT) / max_score * 100 < 90 THEN '80-89%'
        WHEN CAST(total_score AS FLOAT) / max_score * 100 < 93 THEN '90-92%'
        ELSE '93-100%'
      END AS range,
      COUNT(*) AS count,
      MIN(CAST(total_score AS FLOAT) / max_score * 100) AS min_pct,
      MAX(CAST(total_score AS FLOAT) / max_score * 100) AS max_pct
    FROM evaluations
    WHERE status != 'Draft' AND max_score > 0
  `;

  const params = [];
  if (start_date) { query += ` AND evaluation_date >= ?`; params.push(start_date); }
  if (end_date) { query += ` AND evaluation_date <= ?`; params.push(end_date); }

  query += ` GROUP BY range ORDER BY min_pct ASC`;

  const data = db.prepare(query).all(...params);

  // Pass/Fail counts
  let passFailQuery = `
    SELECT
      SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) AS passed,
      SUM(CASE WHEN passed = 0 THEN 1 ELSE 0 END) AS failed,
      COUNT(*) AS total
    FROM evaluations WHERE status != 'Draft'
  `;
  const pf = db.prepare(passFailQuery).get();

  res.json({ distribution: data, pass_fail: pf });
});

// GET /api/reports/pip-tracking
router.get('/pip-tracking', (req, res) => {
  const db = getDb();

  const data = db.prepare(`
    SELECT pp.*,
           ev.evaluation_date, ev.total_score, ev.max_score,
           e.name AS employee_name, e.department, e.tech_level,
           u.name AS evaluator_name
    FROM pip_plans pp
    JOIN evaluations ev ON pp.evaluation_id = ev.id
    JOIN employees e ON ev.employee_id = e.id
    LEFT JOIN users u ON ev.evaluator_id = u.id
    WHERE ev.status != 'Draft'
    ORDER BY pp.created_at DESC
  `).all();

  res.json({ data });
});

module.exports = router;
