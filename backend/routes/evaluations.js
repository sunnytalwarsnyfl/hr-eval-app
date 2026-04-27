const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

function recalculateTotals(db, evalId) {
  // Recalculate section scores
  const sections = db.prepare('SELECT id FROM eval_sections WHERE evaluation_id = ?').all(evalId);
  for (const section of sections) {
    const result = db.prepare('SELECT COALESCE(SUM(score), 0) AS total FROM eval_items WHERE section_id = ?').get(section.id);
    db.prepare('UPDATE eval_sections SET section_score = ? WHERE id = ?').run(result.total, section.id);
  }

  // Recalculate evaluation total
  const totalResult = db.prepare('SELECT COALESCE(SUM(section_score), 0) AS total FROM eval_sections WHERE evaluation_id = ?').get(evalId);
  const totalScore = totalResult.total;
  const evalRecord = db.prepare('SELECT passing_score FROM evaluations WHERE id = ?').get(evalId);
  const passingScore = evalRecord?.passing_score || 211;
  const passed = totalScore >= passingScore ? 1 : 0;

  db.prepare(`
    UPDATE evaluations SET total_score = ?, passed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(totalScore, passed, evalId);

  return { totalScore, passed };
}

// GET /api/evaluations
router.get('/', (req, res) => {
  const db = getDb();
  const { department, status, start_date, end_date, passed, employee_id, search } = req.query;

  let query = `
    SELECT
      ev.*,
      e.name AS employee_name,
      e.department,
      e.tech_level,
      u.name AS evaluator_name
    FROM evaluations ev
    JOIN employees e ON ev.employee_id = e.id
    LEFT JOIN users u ON ev.evaluator_id = u.id
    WHERE 1=1
  `;

  const params = [];

  // Employee role: hard-scope results to their own employee_id (security)
  if (req.user.role === 'employee') {
    if (!req.user.employee_id) {
      return res.json({ evaluations: [] });
    }
    query += ` AND ev.employee_id = ?`;
    params.push(req.user.employee_id);
  } else if (req.user.role === 'manager') {
    // Manager role: only see evaluations for their assigned employees
    query += ` AND e.manager_id = ?`;
    params.push(req.user.id);
  }

  if (department) {
    query += ` AND e.department = ?`;
    params.push(department);
  }
  if (status) {
    query += ` AND ev.status = ?`;
    params.push(status);
  }
  if (start_date) {
    query += ` AND ev.evaluation_date >= ?`;
    params.push(start_date);
  }
  if (end_date) {
    query += ` AND ev.evaluation_date <= ?`;
    params.push(end_date);
  }
  if (passed !== undefined && passed !== '') {
    query += ` AND ev.passed = ?`;
    params.push(passed === 'true' || passed === '1' ? 1 : 0);
  }
  if (employee_id && req.user.role !== 'employee') {
    query += ` AND ev.employee_id = ?`;
    params.push(employee_id);
  }
  if (search) {
    query += ` AND (e.name LIKE ? OR e.department LIKE ?)`;
    const like = `%${search}%`;
    params.push(like, like);
  }

  query += ` ORDER BY ev.evaluation_date DESC`;

  const evaluations = db.prepare(query).all(...params);
  res.json({ evaluations });
});

// GET /api/evaluations/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const evaluation = db.prepare(`
    SELECT ev.*, e.name AS employee_name, e.department, e.tech_level, e.hire_date,
           u.name AS evaluator_name
    FROM evaluations ev
    JOIN employees e ON ev.employee_id = e.id
    LEFT JOIN users u ON ev.evaluator_id = u.id
    WHERE ev.id = ?
  `).get(id);

  if (!evaluation) return res.status(404).json({ error: 'Evaluation not found' });

  const sections = db.prepare(`
    SELECT * FROM eval_sections WHERE evaluation_id = ? ORDER BY id ASC
  `).all(id);

  for (const section of sections) {
    section.items = db.prepare(`
      SELECT * FROM eval_items WHERE section_id = ? ORDER BY id ASC
    `).all(section.id);
  }

  const pipPlan = db.prepare(`SELECT * FROM pip_plans WHERE evaluation_id = ?`).get(id);

  res.json({ evaluation, sections, pipPlan: pipPlan || null });
});

// POST /api/evaluations
router.post('/', (req, res) => {
  const db = getDb();
  const {
    employee_id, evaluator_id, evaluation_type, evaluation_date,
    status, sections, supervisor_comments, employee_comments,
    next_eval_date, pip_plan, max_score, passing_score
  } = req.body;

  if (!employee_id || !evaluation_type || !evaluation_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const evalMaxScore = max_score || 227;
  const evalPassingScore = passing_score || 211;

  const evalId = db.prepare(`
    INSERT INTO evaluations (employee_id, evaluator_id, evaluation_type, evaluation_date, status, max_score, passing_score, supervisor_comments, employee_comments, next_eval_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    employee_id,
    evaluator_id || req.user.id,
    evaluation_type,
    evaluation_date,
    status || 'Draft',
    evalMaxScore,
    evalPassingScore,
    supervisor_comments || null,
    employee_comments || null,
    next_eval_date || null
  ).lastInsertRowid;

  if (sections && sections.length > 0) {
    for (const section of sections) {
      const sectionId = db.prepare(`
        INSERT INTO eval_sections (evaluation_id, section_name, section_score, section_max, notes)
        VALUES (?, ?, ?, ?, ?)
      `).run(evalId, section.section_name, section.section_score || 0, section.section_max, section.notes || null).lastInsertRowid;

      if (section.items && section.items.length > 0) {
        for (const item of section.items) {
          db.prepare(`
            INSERT INTO eval_items (section_id, item_label, score, max_score, evaluator_note)
            VALUES (?, ?, ?, ?, ?)
          `).run(sectionId, item.item_label, item.score || 0, item.max_score, item.evaluator_note || null);
        }
      }
    }

    recalculateTotals(db, evalId);
  }

  if (pip_plan) {
    db.prepare(`
      INSERT INTO pip_plans (evaluation_id, action_plan, goals, expectations, timeline, next_pip_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(evalId, pip_plan.action_plan || null, pip_plan.goals || null, pip_plan.expectations || null, pip_plan.timeline || null, pip_plan.next_pip_date || null);
  }

  const evaluation = db.prepare(`
    SELECT ev.*, e.name AS employee_name, u.name AS evaluator_name
    FROM evaluations ev
    JOIN employees e ON ev.employee_id = e.id
    LEFT JOIN users u ON ev.evaluator_id = u.id
    WHERE ev.id = ?
  `).get(evalId);

  res.status(201).json({ evaluation });
});

// PUT /api/evaluations/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const {
    evaluation_type, evaluation_date, status, sections,
    supervisor_comments, employee_comments, next_eval_date, pip_plan
  } = req.body;

  const existing = db.prepare('SELECT * FROM evaluations WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Evaluation not found' });

  db.prepare(`
    UPDATE evaluations SET
      evaluation_type = COALESCE(?, evaluation_type),
      evaluation_date = COALESCE(?, evaluation_date),
      status = COALESCE(?, status),
      supervisor_comments = ?,
      employee_comments = ?,
      next_eval_date = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    evaluation_type || null,
    evaluation_date || null,
    status || null,
    supervisor_comments !== undefined ? supervisor_comments : existing.supervisor_comments,
    employee_comments !== undefined ? employee_comments : existing.employee_comments,
    next_eval_date !== undefined ? next_eval_date : existing.next_eval_date,
    id
  );

  if (sections && sections.length > 0) {
    // Delete existing sections and items
    const oldSections = db.prepare('SELECT id FROM eval_sections WHERE evaluation_id = ?').all(id);
    for (const s of oldSections) {
      db.prepare('DELETE FROM eval_items WHERE section_id = ?').run(s.id);
    }
    db.prepare('DELETE FROM eval_sections WHERE evaluation_id = ?').run(id);

    // Insert new sections and items
    for (const section of sections) {
      const sectionId = db.prepare(`
        INSERT INTO eval_sections (evaluation_id, section_name, section_score, section_max, notes)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, section.section_name, section.section_score || 0, section.section_max, section.notes || null).lastInsertRowid;

      if (section.items && section.items.length > 0) {
        for (const item of section.items) {
          db.prepare(`
            INSERT INTO eval_items (section_id, item_label, score, max_score, evaluator_note)
            VALUES (?, ?, ?, ?, ?)
          `).run(sectionId, item.item_label, item.score || 0, item.max_score, item.evaluator_note || null);
        }
      }
    }

    recalculateTotals(db, id);
  }

  if (pip_plan !== undefined) {
    const existingPip = db.prepare('SELECT id FROM pip_plans WHERE evaluation_id = ?').get(id);
    if (pip_plan === null) {
      db.prepare('DELETE FROM pip_plans WHERE evaluation_id = ?').run(id);
    } else if (existingPip) {
      db.prepare(`
        UPDATE pip_plans SET action_plan = ?, goals = ?, expectations = ?, timeline = ?, next_pip_date = ?
        WHERE evaluation_id = ?
      `).run(pip_plan.action_plan || null, pip_plan.goals || null, pip_plan.expectations || null, pip_plan.timeline || null, pip_plan.next_pip_date || null, id);
    } else {
      db.prepare(`
        INSERT INTO pip_plans (evaluation_id, action_plan, goals, expectations, timeline, next_pip_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, pip_plan.action_plan || null, pip_plan.goals || null, pip_plan.expectations || null, pip_plan.timeline || null, pip_plan.next_pip_date || null);
    }
  }

  const evaluation = db.prepare(`
    SELECT ev.*, e.name AS employee_name, u.name AS evaluator_name
    FROM evaluations ev
    JOIN employees e ON ev.employee_id = e.id
    LEFT JOIN users u ON ev.evaluator_id = u.id
    WHERE ev.id = ?
  `).get(id);

  const sections_data = db.prepare('SELECT * FROM eval_sections WHERE evaluation_id = ? ORDER BY id ASC').all(id);
  for (const s of sections_data) {
    s.items = db.prepare('SELECT * FROM eval_items WHERE section_id = ? ORDER BY id ASC').all(s.id);
  }
  const pipPlan = db.prepare('SELECT * FROM pip_plans WHERE evaluation_id = ?').get(id);

  res.json({ evaluation, sections: sections_data, pipPlan: pipPlan || null });
});

// PATCH /api/evaluations/:id/acknowledge
router.patch('/:id/acknowledge', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { acknowledged_by } = req.body;

  if (!acknowledged_by) {
    return res.status(400).json({ error: 'acknowledged_by is required' });
  }

  const evaluation = db.prepare('SELECT * FROM evaluations WHERE id = ?').get(id);
  if (!evaluation) return res.status(404).json({ error: 'Evaluation not found' });

  if (evaluation.status !== 'Submitted') {
    return res.status(400).json({ error: 'Only submitted evaluations can be acknowledged' });
  }

  db.prepare(`
    UPDATE evaluations SET status = 'Acknowledged', acknowledged_by = ?, acknowledged_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(acknowledged_by, id);

  const updated = db.prepare(`
    SELECT ev.*, e.name AS employee_name, u.name AS evaluator_name
    FROM evaluations ev
    JOIN employees e ON ev.employee_id = e.id
    LEFT JOIN users u ON ev.evaluator_id = u.id
    WHERE ev.id = ?
  `).get(id);

  res.json({ evaluation: updated });
});

// PATCH /api/evaluations/:id/hr-review — HR fills post-self-eval data
router.patch('/:id/hr-review', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const {
    attendance_occurrences,
    disciplinary_count,
    compliance_status,
    belt_level_at_eval,
    overall_score,
    pay_increase_rate,
    bonus_percentage,
    hr_notes
  } = req.body;

  // Authorize: only admin or hr
  if (!['admin', 'hr'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden — HR/Admin only' });
  }

  const existing = db.prepare('SELECT * FROM evaluations WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Evaluation not found' });

  try {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE evaluations SET
        hr_reviewed_at = ?,
        hr_reviewed_by = ?,
        attendance_occurrences = COALESCE(?, attendance_occurrences),
        disciplinary_count = COALESCE(?, disciplinary_count),
        compliance_status = COALESCE(?, compliance_status),
        belt_level_at_eval = COALESCE(?, belt_level_at_eval),
        overall_score = COALESCE(?, overall_score),
        pay_increase_rate = COALESCE(?, pay_increase_rate),
        bonus_percentage = COALESCE(?, bonus_percentage),
        supervisor_comments = CASE WHEN ? IS NOT NULL AND ? != '' THEN COALESCE(supervisor_comments || char(10) || char(10), '') || '[HR Review] ' || ? ELSE supervisor_comments END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      now, req.user.id,
      attendance_occurrences ?? null,
      disciplinary_count ?? null,
      compliance_status ?? null,
      belt_level_at_eval ?? null,
      overall_score ?? null,
      pay_increase_rate ?? null,
      bonus_percentage ?? null,
      hr_notes || null,
      hr_notes || null,
      hr_notes || null,
      id
    );

    const updated = db.prepare('SELECT * FROM evaluations WHERE id = ?').get(id);
    res.json({ evaluation: updated });
  } catch (err) {
    console.error('hr-review error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/evaluations/:id/hr-review-data — returns auto-pulled context for HR review
router.get('/:id/hr-review-data', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const evaluation = db.prepare('SELECT * FROM evaluations WHERE id = ?').get(id);
  if (!evaluation) return res.status(404).json({ error: 'Evaluation not found' });

  const employeeId = evaluation.employee_id;

  // Active attendance points
  let attendancePoints = 0;
  let attendanceCount = 0;
  try {
    const a = db.prepare(`
      SELECT COALESCE(SUM(points), 0) AS total, COUNT(*) AS count
      FROM attendance_log
      WHERE employee_id = ? AND roll_off_date > date('now')
    `).get(employeeId);
    attendancePoints = a.total || 0;
    attendanceCount = a.count || 0;
  } catch (_) {}

  // Disciplinary actions in last 12 months
  let discCount = 0;
  try {
    const d = db.prepare(`
      SELECT COUNT(*) AS count FROM disciplinary_actions
      WHERE employee_id = ? AND date_of_incident >= date('now', '-12 months')
    `).get(employeeId);
    discCount = d.count || 0;
  } catch (_) {}

  // Compliance summary — count of active records, count of within-deadline
  let complianceTotal = 0;
  let complianceOnTime = 0;
  try {
    const c = db.prepare(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN renewed_within_deadline = 1 THEN 1 ELSE 0 END) AS on_time
      FROM compliance_records WHERE employee_id = ?
    `).get(employeeId);
    complianceTotal = c.total || 0;
    complianceOnTime = c.on_time || 0;
  } catch (_) {}

  // Employee belt level
  const employee = db.prepare('SELECT belt_level FROM employees WHERE id = ?').get(employeeId);

  res.json({
    attendance: { points: attendancePoints, count: attendanceCount },
    disciplinary: { count_12mo: discCount },
    compliance: { total: complianceTotal, on_time: complianceOnTime, status: complianceTotal > 0 && complianceOnTime === complianceTotal ? 'Compliant' : (complianceTotal > 0 ? 'Non-Compliant' : 'No Records') },
    employee_belt_level: employee?.belt_level || null
  });
});

// DELETE /api/evaluations/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const evaluation = db.prepare('SELECT * FROM evaluations WHERE id = ?').get(id);
  if (!evaluation) return res.status(404).json({ error: 'Evaluation not found' });

  if (evaluation.status !== 'Draft') {
    return res.status(400).json({ error: 'Only draft evaluations can be deleted' });
  }

  // CASCADE should handle sections/items/pip
  db.prepare('DELETE FROM evaluations WHERE id = ?').run(id);
  res.json({ message: 'Evaluation deleted' });
});

module.exports = router;
