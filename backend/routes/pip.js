const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/pip — list all PIPs
router.get('/', (req, res) => {
  const db = getDb();
  const { status } = req.query;

  let query = `
    SELECT
      pp.*,
      e.name AS employee_name,
      e.department,
      e.id AS employee_id,
      ev.evaluation_date,
      ev.total_score,
      ev.passed,
      ev.evaluation_type
    FROM pip_plans pp
    JOIN evaluations ev ON pp.evaluation_id = ev.id
    JOIN employees e ON ev.employee_id = e.id
    WHERE e.active = 1
  `;

  const params = [];

  // Manager role: only see PIPs for their assigned employees
  if (req.user.role === 'manager') {
    query += ` AND e.manager_id = ?`;
    params.push(req.user.id);
  }

  if (status) {
    query += ` AND pp.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY pp.created_at DESC`;

  try {
    const pips = db.prepare(query).all(...params);
    res.json({ pips });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pip/:id — get single PIP
router.get('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  try {
    const pip = db.prepare(`
      SELECT
        pp.*,
        e.name AS employee_name,
        e.department,
        e.job_title,
        e.tech_level,
        e.hire_date,
        e.id AS employee_id,
        ev.evaluation_date,
        ev.total_score,
        ev.max_score,
        ev.passed,
        ev.evaluation_type,
        ev.supervisor_comments,
        u.name AS evaluator_name
      FROM pip_plans pp
      JOIN evaluations ev ON pp.evaluation_id = ev.id
      JOIN employees e ON ev.employee_id = e.id
      LEFT JOIN users u ON ev.evaluator_id = u.id
      WHERE pp.id = ?
    `).get(id);

    if (!pip) return res.status(404).json({ error: 'PIP not found' });

    // Manager can only view PIPs for their employees
    const employee = db.prepare('SELECT manager_id FROM employees WHERE id = ?').get(pip.employee_id);
    if (req.user.role === 'manager' && employee?.manager_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ pip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pip — create PIP
router.post('/', (req, res) => {
  const db = getDb();
  const { evaluation_id, action_plan, goals, expectations, timeline, next_pip_date, status } = req.body;

  if (!evaluation_id) {
    return res.status(400).json({ error: 'evaluation_id is required' });
  }

  const evaluation = db.prepare('SELECT * FROM evaluations WHERE id = ?').get(evaluation_id);
  if (!evaluation) return res.status(404).json({ error: 'Evaluation not found' });

  // Check if PIP already exists for this evaluation
  const existing = db.prepare('SELECT id FROM pip_plans WHERE evaluation_id = ?').get(evaluation_id);
  if (existing) {
    return res.status(409).json({ error: 'A PIP already exists for this evaluation' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO pip_plans (evaluation_id, action_plan, goals, expectations, timeline, next_pip_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      evaluation_id,
      action_plan || null,
      goals || null,
      expectations || null,
      timeline || null,
      next_pip_date || null,
      status || 'Active'
    );

    const pip = db.prepare('SELECT * FROM pip_plans WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ pip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/pip/:id — update PIP
router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { action_plan, goals, expectations, timeline, next_pip_date, status } = req.body;

  const existing = db.prepare('SELECT * FROM pip_plans WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'PIP not found' });

  try {
    db.prepare(`
      UPDATE pip_plans
      SET action_plan = ?, goals = ?, expectations = ?, timeline = ?, next_pip_date = ?, status = ?
      WHERE id = ?
    `).run(
      action_plan !== undefined ? action_plan : existing.action_plan,
      goals !== undefined ? goals : existing.goals,
      expectations !== undefined ? expectations : existing.expectations,
      timeline !== undefined ? timeline : existing.timeline,
      next_pip_date !== undefined ? next_pip_date : existing.next_pip_date,
      status !== undefined ? status : existing.status,
      id
    );

    const updated = db.prepare('SELECT * FROM pip_plans WHERE id = ?').get(id);
    res.json({ pip: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/pip/:id/status — update PIP status only
router.patch('/:id/status', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['Active', 'Completed', 'Extended'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be Active, Completed, or Extended' });
  }

  const existing = db.prepare('SELECT * FROM pip_plans WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'PIP not found' });

  try {
    db.prepare('UPDATE pip_plans SET status = ? WHERE id = ?').run(status, id);
    const updated = db.prepare('SELECT * FROM pip_plans WHERE id = ?').get(id);
    res.json({ pip: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/pip/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM pip_plans WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'PIP not found' });

  try {
    db.prepare('DELETE FROM pip_plans WHERE id = ?').run(id);
    res.json({ message: 'PIP deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
