const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { toCSV, sendCSV } = require('../utils/csv');
const { buildICal } = require('../utils/icalendar');

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
    SELECT e.id, e.name, e.department, e.tech_level, e.belt_level, e.manager_id,
           u.name AS manager_name, u.email AS manager_email,
           MAX(ev.evaluation_date) AS last_eval_date
    FROM employees e
    LEFT JOIN users u ON e.manager_id = u.id
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

// GET /api/reports/eval-calendar — anniversaries in upcoming 90 days
router.get('/eval-calendar', (req, res) => {
  const db = getDb();

  let query = `
    SELECT e.id AS employee_id, e.name AS employee_name, e.department, e.belt_level,
           e.hire_date, e.anniversary_date,
           u.name AS manager_name
    FROM employees e
    LEFT JOIN users u ON e.manager_id = u.id
    WHERE e.active = 1
  `;
  const params = [];

  if (req.user.role === 'manager') {
    query += ' AND e.manager_id = ?';
    params.push(req.user.id);
  }

  const employees = db.prepare(query).all(...params);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const triggers = [];
  for (const emp of employees) {
    const refDate = emp.anniversary_date || emp.hire_date;
    if (!refDate) continue;
    const ref = new Date(refDate);
    if (isNaN(ref.getTime())) continue;

    const thisYear = new Date(today.getFullYear(), ref.getMonth(), ref.getDate());
    let target = thisYear < today ? new Date(today.getFullYear() + 1, ref.getMonth(), ref.getDate()) : thisYear;

    const daysUntil = Math.round((target.getTime() - todayMs) / (1000 * 60 * 60 * 24));
    if (daysUntil >= 0 && daysUntil <= 90) {
      triggers.push({
        employee_id: emp.employee_id,
        employee_name: emp.employee_name,
        department: emp.department,
        belt_level: emp.belt_level,
        manager_name: emp.manager_name,
        anniversary_date: target.toISOString().split('T')[0],
        days_until: daysUntil
      });
    }
  }

  triggers.sort((a, b) => a.days_until - b.days_until);
  res.json({ data: triggers });
});

// GET /api/reports/eval-calendar.ics — download eval triggers as iCalendar file
router.get('/eval-calendar.ics', (req, res) => {
  const db = getDb();

  let query = `
    SELECT e.id AS employee_id, e.name AS employee_name, e.department,
           e.hire_date, e.anniversary_date,
           u.name AS manager_name
    FROM employees e
    LEFT JOIN users u ON e.manager_id = u.id
    WHERE e.active = 1
  `;
  const params = [];
  if (req.user.role === 'manager') {
    query += ' AND e.manager_id = ?';
    params.push(req.user.id);
  }

  const employees = db.prepare(query).all(...params);
  const today = new Date();
  const events = [];

  for (const emp of employees) {
    const refDate = emp.anniversary_date || emp.hire_date;
    if (!refDate) continue;
    const ref = new Date(refDate);
    if (isNaN(ref.getTime())) continue;

    // Generate events for next 2 years
    for (let yearOffset = 0; yearOffset < 2; yearOffset++) {
      const target = new Date(today.getFullYear() + yearOffset, ref.getMonth(), ref.getDate());
      if (target < today && yearOffset === 0) continue; // skip past dates this year

      events.push({
        uid: `eval-${emp.employee_id}-${target.toISOString().split('T')[0]}`,
        title: `Annual Review Due: ${emp.employee_name}`,
        description: `Department: ${emp.department || 'N/A'}\nManager: ${emp.manager_name || 'N/A'}\nAnniversary date.`,
        start: target,
      });

      // Also add 30/15/5-day reminders
      [30, 15, 5].forEach(daysBefore => {
        const reminderDate = new Date(target);
        reminderDate.setDate(reminderDate.getDate() - daysBefore);
        if (reminderDate < today) return;
        events.push({
          uid: `eval-${emp.employee_id}-${target.toISOString().split('T')[0]}-${daysBefore}d`,
          title: `Eval Reminder (${daysBefore}d): ${emp.employee_name}`,
          description: `${daysBefore} days before annual review.\nDepartment: ${emp.department || 'N/A'}`,
          start: reminderDate,
        });
      });
    }
  }

  const ics = buildICal(events, 'SIPS HR — Eval Due Dates');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="sips-hr-eval-calendar.ics"');
  res.send(ics);
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

// ─── CSV EXPORT ENDPOINTS ─────────────────────────────────────────────────────
// GET /api/reports/export/csv/:type
router.get('/export/csv/:type', (req, res) => {
  const db = getDb();
  const { type } = req.params;
  const today = new Date().toISOString().split('T')[0];

  try {
    if (type === 'evaluations') {
      const rows = db.prepare(`
        SELECT ev.id, ev.evaluation_date, ev.evaluation_type, ev.evaluation_subtype, ev.status,
               ev.total_score, ev.max_score, ev.passed, ev.overall_score, ev.belt_level_at_eval,
               e.name AS employee_name, e.department, e.belt_level, e.employment_type,
               u.name AS evaluator_name
        FROM evaluations ev
        JOIN employees e ON ev.employee_id = e.id
        LEFT JOIN users u ON ev.evaluator_id = u.id
        ORDER BY ev.evaluation_date DESC
      `).all();
      const csv = toCSV(rows, [
        { key: 'id', label: 'ID' },
        { key: 'evaluation_date', label: 'Date' },
        { key: 'evaluation_type', label: 'Type' },
        { key: 'evaluation_subtype', label: 'Subtype' },
        { key: 'employee_name', label: 'Employee' },
        { key: 'department', label: 'Department' },
        { key: 'evaluator_name', label: 'Evaluator' },
        { key: 'total_score', label: 'Score' },
        { key: 'max_score', label: 'Max' },
        { key: 'passed', label: 'Passed', format: v => (v === 1 ? 'Yes' : v === 0 ? 'No' : '') },
        { key: 'belt_level', label: 'Belt Level' },
        { key: 'employment_type', label: 'Employment Type' },
        { key: 'status', label: 'Status' },
      ]);
      return sendCSV(res, `evaluations_${today}.csv`, csv);
    }

    if (type === 'attendance') {
      const rows = db.prepare(`
        SELECT a.id, a.date_of_occurrence, a.occurrence_code, a.occurrence_type,
               a.description_type, a.description, a.points, a.accumulated_points,
               a.roll_off_date, a.acknowledged_by_employee, a.acknowledged_at,
               e.name AS employee_name, e.department, e.job_title,
               f.name AS facility_name
        FROM attendance_log a
        JOIN employees e ON a.employee_id = e.id
        LEFT JOIN facilities f ON a.facility_id = f.id
        ORDER BY a.date_of_occurrence DESC
      `).all();
      const csv = toCSV(rows, [
        { key: 'id', label: 'ID' },
        { key: 'employee_name', label: 'Employee' },
        { key: 'department', label: 'Department' },
        { key: 'facility_name', label: 'Facility' },
        { key: 'date_of_occurrence', label: 'Date' },
        { key: 'occurrence_code', label: 'Code' },
        { key: 'occurrence_type', label: 'Type' },
        { key: 'description_type', label: 'Description Type' },
        { key: 'description', label: 'Description' },
        { key: 'points', label: 'Points' },
        { key: 'accumulated_points', label: 'Accumulated' },
        { key: 'roll_off_date', label: 'Roll-Off Date' },
        { key: 'acknowledged_by_employee', label: 'Acknowledged', format: v => (v ? 'Yes' : 'No') },
      ]);
      return sendCSV(res, `attendance_${today}.csv`, csv);
    }

    if (type === 'qa') {
      const rows = db.prepare(`
        SELECT q.id, q.date_of_incident, q.issue_type, q.issue, q.issue_points,
               q.accumulated_points, q.action_taken, q.status, q.disciplinary_triggered,
               q.description, q.roll_off_date,
               e.name AS employee_name, e.department, e.job_title,
               f.name AS facility_name
        FROM qa_log q
        JOIN employees e ON q.employee_id = e.id
        LEFT JOIN facilities f ON q.facility_id = f.id
        ORDER BY q.date_of_incident DESC
      `).all();
      const csv = toCSV(rows, [
        { key: 'id', label: 'ID' },
        { key: 'employee_name', label: 'Employee' },
        { key: 'department', label: 'Department' },
        { key: 'facility_name', label: 'Facility' },
        { key: 'date_of_incident', label: 'Date' },
        { key: 'issue_type', label: 'Issue Type' },
        { key: 'issue_points', label: 'Points' },
        { key: 'accumulated_points', label: 'Accumulated' },
        { key: 'action_taken', label: 'Action Required' },
        { key: 'disciplinary_triggered', label: 'Disciplinary Triggered', format: v => (v ? 'Yes' : 'No') },
        { key: 'status', label: 'Status' },
        { key: 'description', label: 'Description' },
        { key: 'roll_off_date', label: 'Roll-Off Date' },
      ]);
      return sendCSV(res, `qa_log_${today}.csv`, csv);
    }

    if (type === 'disciplinary') {
      const rows = db.prepare(`
        SELECT d.id, d.date_of_incident, d.issuance_date, d.violation_types, d.action_level,
               d.monitoring_period, d.type, d.status, d.roll_off_date, d.consequence_type,
               d.suspension_days, d.policy_attached,
               e.name AS employee_name, e.department, e.job_title,
               f.name AS facility_name,
               u.name AS initiated_by_name,
               h.name AS hr_approved_by_name,
               d.hr_approved_at, d.employee_signed_at, d.manager_signed_at
        FROM disciplinary_actions d
        JOIN employees e ON d.employee_id = e.id
        LEFT JOIN facilities f ON d.facility_id = f.id
        LEFT JOIN users u ON d.initiated_by = u.id
        LEFT JOIN users h ON d.hr_approved_by = h.id
        ORDER BY d.date_of_incident DESC
      `).all();
      const csv = toCSV(rows, [
        { key: 'id', label: 'ID' },
        { key: 'employee_name', label: 'Employee' },
        { key: 'department', label: 'Department' },
        { key: 'facility_name', label: 'Facility' },
        { key: 'date_of_incident', label: 'Incident Date' },
        { key: 'issuance_date', label: 'Issuance Date' },
        { key: 'violation_types', label: 'Violations' },
        { key: 'action_level', label: 'Action Level' },
        { key: 'consequence_type', label: 'Consequence' },
        { key: 'monitoring_period', label: 'Monitoring' },
        { key: 'type', label: 'Type' },
        { key: 'status', label: 'Status' },
        { key: 'initiated_by_name', label: 'Initiated By' },
        { key: 'hr_approved_by_name', label: 'HR Approved By' },
        { key: 'hr_approved_at', label: 'HR Approved At' },
        { key: 'employee_signed_at', label: 'Employee Signed' },
        { key: 'manager_signed_at', label: 'Manager Signed' },
        { key: 'roll_off_date', label: 'Roll-Off Date' },
      ]);
      return sendCSV(res, `disciplinary_${today}.csv`, csv);
    }

    if (type === 'pip') {
      const rows = db.prepare(`
        SELECT pp.id, pp.created_at, pp.action_plan, pp.goals, pp.expectations,
               pp.timeline, pp.next_pip_date, pp.status, pp.monitoring_period, pp.type,
               ev.evaluation_date, ev.total_score, ev.max_score,
               e.name AS employee_name, e.department,
               u.name AS evaluator_name
        FROM pip_plans pp
        JOIN evaluations ev ON pp.evaluation_id = ev.id
        JOIN employees e ON ev.employee_id = e.id
        LEFT JOIN users u ON ev.evaluator_id = u.id
        ORDER BY pp.created_at DESC
      `).all();
      const csv = toCSV(rows, [
        { key: 'id', label: 'PIP ID' },
        { key: 'employee_name', label: 'Employee' },
        { key: 'department', label: 'Department' },
        { key: 'evaluator_name', label: 'Evaluator' },
        { key: 'created_at', label: 'Created' },
        { key: 'evaluation_date', label: 'Eval Date' },
        { key: 'monitoring_period', label: 'Monitoring' },
        { key: 'type', label: 'Type' },
        { key: 'status', label: 'Status' },
        { key: 'next_pip_date', label: 'Next Review' },
        { key: 'action_plan', label: 'Action Plan' },
        { key: 'goals', label: 'Goals' },
      ]);
      return sendCSV(res, `pip_${today}.csv`, csv);
    }

    if (type === 'compliance') {
      const rows = db.prepare(`
        SELECT c.id, c.requirement_type, c.expiration_date, c.renewed_date,
               c.renewed_within_deadline, c.points_value, c.notes, c.created_at,
               e.name AS employee_name, e.department
        FROM compliance_records c
        JOIN employees e ON c.employee_id = e.id
        ORDER BY c.created_at DESC
      `).all();
      const csv = toCSV(rows, [
        { key: 'id', label: 'ID' },
        { key: 'employee_name', label: 'Employee' },
        { key: 'department', label: 'Department' },
        { key: 'requirement_type', label: 'Requirement' },
        { key: 'expiration_date', label: 'Expiration' },
        { key: 'renewed_date', label: 'Renewed' },
        { key: 'renewed_within_deadline', label: 'On Time', format: v => (v === 1 ? 'Yes' : v === 0 ? 'No' : 'Pending') },
        { key: 'points_value', label: 'Points' },
        { key: 'notes', label: 'Notes' },
      ]);
      return sendCSV(res, `compliance_${today}.csv`, csv);
    }

    if (type === 'belt-levels') {
      const rows = db.prepare(`
        SELECT belt_level, COUNT(*) AS count
        FROM employees WHERE active = 1
        GROUP BY belt_level
        ORDER BY count DESC
      `).all();
      const csv = toCSV(rows, [
        { key: 'belt_level', label: 'Belt Level', format: v => v || '(none)' },
        { key: 'count', label: 'Count' },
      ]);
      return sendCSV(res, `belt_levels_${today}.csv`, csv);
    }

    if (type === 'evals-due') {
      const rows = db.prepare(`
        SELECT e.id, e.name AS employee_name, e.department, e.job_title, e.belt_level,
               e.hire_date, e.anniversary_date,
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
      const csv = toCSV(rows, [
        { key: 'id', label: 'ID' },
        { key: 'employee_name', label: 'Employee' },
        { key: 'department', label: 'Department' },
        { key: 'job_title', label: 'Job Title' },
        { key: 'belt_level', label: 'Belt' },
        { key: 'manager_name', label: 'Manager' },
        { key: 'hire_date', label: 'Hire Date' },
        { key: 'anniversary_date', label: 'Anniversary' },
        { key: 'last_eval_date', label: 'Last Eval' },
        { key: 'days_since_eval', label: 'Days Since', format: v => v ? Math.round(v) : '' },
      ]);
      return sendCSV(res, `evals_due_${today}.csv`, csv);
    }

    return res.status(400).json({ error: `Unknown export type: ${type}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
