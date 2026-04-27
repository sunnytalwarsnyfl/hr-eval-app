const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { audit } = require('../utils/auditLog');

router.use(authenticateToken);

const ALLOWED_STATUSES = [
  'Active',
  'Complete - Met Expectations',
  'Incomplete - Did Not Meet',
  'Extended',
  // Legacy values still accepted for backward compatibility
  'Completed'
];

function parseMonitoringDays(value) {
  if (!value) return 30;
  const m = String(value).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 30;
}

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
  const {
    evaluation_id, action_plan, goals, expectations, timeline,
    next_pip_date, status, monitoring_period, type
  } = req.body;

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

  // Validate status if provided
  if (status && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}` });
  }

  // Resolve facility_id from employee
  let resolvedFacilityId = null;
  try {
    const emp = db.prepare('SELECT facility_id FROM employees WHERE id = ?').get(evaluation.employee_id);
    resolvedFacilityId = emp ? emp.facility_id : null;
  } catch (_) { /* ignore */ }

  try {
    const result = db.prepare(`
      INSERT INTO pip_plans (
        evaluation_id, action_plan, goals, expectations, timeline,
        next_pip_date, status, monitoring_period, type, facility_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      evaluation_id,
      action_plan || null,
      goals || null,
      expectations || null,
      timeline || null,
      next_pip_date || null,
      status || 'Active',
      monitoring_period || '30 Days',
      type || 'New',
      resolvedFacilityId
    );

    const pip = db.prepare('SELECT * FROM pip_plans WHERE id = ?').get(result.lastInsertRowid);

    // Notify HR and the employee's manager (best-effort)
    try {
      const { sendEmail } = require('../utils/mailer');
      const employee = db.prepare(`
        SELECT e.id, e.name, e.manager_id
        FROM employees e
        WHERE e.id = ?
      `).get(evaluation.employee_id);

      const monDays = parseMonitoringDays(pip.monitoring_period);
      const issuance = pip.created_at ? String(pip.created_at).substring(0, 10) : new Date().toISOString().split('T')[0];
      const rollOff = (() => {
        const d = new Date(issuance);
        d.setDate(d.getDate() + monDays);
        return d.toISOString().split('T')[0];
      })();

      const html = `
        <p>A Performance Improvement Plan has been created for <strong>${employee?.name || 'an employee'}</strong>.</p>
        <p><strong>Type:</strong> ${pip.type}</p>
        <p><strong>Monitoring Period:</strong> ${pip.monitoring_period}</p>
        <p><strong>Issuance Date:</strong> ${issuance}</p>
        <p><strong>Roll-Off Date:</strong> ${rollOff}</p>
        <p><strong>Next PIP Date:</strong> ${pip.next_pip_date || 'Not scheduled'}</p>
        <p><strong>Status:</strong> ${pip.status}</p>
      `;

      // HR notification
      sendEmail({
        to: 'HR@sipsconsults.com',
        subject: `PIP Created - ${employee?.name || 'Employee'}`,
        html
      }).catch(err => console.error('PIP HR email error:', err.message));

      // Manager notification
      if (employee?.manager_id) {
        const manager = db.prepare('SELECT name, email FROM users WHERE id = ?').get(employee.manager_id);
        if (manager?.email) {
          sendEmail({
            to: manager.email,
            subject: `PIP Created - ${employee.name}`,
            html
          }).catch(err => console.error('PIP Manager email error:', err.message));
        }
      }

      db.prepare('UPDATE pip_plans SET notification_sent = 1 WHERE id = ?').run(pip.id);
      pip.notification_sent = 1;
    } catch (e) {
      console.log(`[EMAIL MOCK] PIP notification for evaluation ${evaluation_id}: ${e.message}`);
    }

    try { audit(req, 'create', 'pip', pip.id, { evaluation_id }); } catch (_) {}
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
  const {
    action_plan, goals, expectations, timeline, next_pip_date,
    status, monitoring_period, type
  } = req.body;

  const existing = db.prepare('SELECT * FROM pip_plans WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'PIP not found' });

  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}` });
  }

  try {
    db.prepare(`
      UPDATE pip_plans
      SET action_plan = ?, goals = ?, expectations = ?, timeline = ?,
          next_pip_date = ?, status = ?, monitoring_period = ?, type = ?
      WHERE id = ?
    `).run(
      action_plan !== undefined ? action_plan : existing.action_plan,
      goals !== undefined ? goals : existing.goals,
      expectations !== undefined ? expectations : existing.expectations,
      timeline !== undefined ? timeline : existing.timeline,
      next_pip_date !== undefined ? next_pip_date : existing.next_pip_date,
      status !== undefined ? status : existing.status,
      monitoring_period !== undefined ? monitoring_period : (existing.monitoring_period || '30 Days'),
      type !== undefined ? type : (existing.type || 'New'),
      id
    );

    const updated = db.prepare('SELECT * FROM pip_plans WHERE id = ?').get(id);
    try { audit(req, 'update', 'pip', Number(id)); } catch (_) {}
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

  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}` });
  }

  const existing = db.prepare('SELECT * FROM pip_plans WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'PIP not found' });

  try {
    db.prepare('UPDATE pip_plans SET status = ? WHERE id = ?').run(status, id);
    const updated = db.prepare('SELECT * FROM pip_plans WHERE id = ?').get(id);
    try { audit(req, 'update', 'pip', Number(id), { status }); } catch (_) {}
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
    try { audit(req, 'delete', 'pip', Number(id)); } catch (_) {}
    res.json({ message: 'PIP deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
