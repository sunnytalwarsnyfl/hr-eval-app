const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { sendEmail } = require('../utils/mailer');

// =====================================================================
// PUBLIC ENDPOINTS (no auth) — must come BEFORE router.use(authenticateToken)
// =====================================================================

// GET /api/disciplinary/:id/employee-link/:token — public, fetch by token
router.get('/:id/employee-link/:token', (req, res) => {
  const db = getDb();
  const { id, token } = req.params;
  try {
    const entry = db.prepare(`
      SELECT d.*,
             e.name AS employee_name, e.department, e.job_title, e.email AS employee_email,
             f.name AS facility_name,
             u.name AS initiated_by_name
      FROM disciplinary_actions d
      JOIN employees e ON d.employee_id = e.id
      LEFT JOIN facilities f ON d.facility_id = f.id
      LEFT JOIN users u ON d.initiated_by = u.id
      WHERE d.id = ? AND d.employee_sign_token = ?
    `).get(id, token);

    if (!entry) return res.status(404).json({ error: 'Invalid or expired link' });
    res.json({ data: entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/disciplinary/:id/employee-link/:token/sign — public, employee signs via token
router.post('/:id/employee-link/:token/sign', (req, res) => {
  const db = getDb();
  const { id, token } = req.params;
  const { signature, employee_statement } = req.body;

  if (!signature) return res.status(400).json({ error: 'signature required' });

  try {
    const entry = db.prepare(
      'SELECT * FROM disciplinary_actions WHERE id = ? AND employee_sign_token = ?'
    ).get(id, token);
    if (!entry) return res.status(404).json({ error: 'Invalid or expired link' });

    const now = new Date().toISOString();
    const newStatus = entry.manager_signature ? 'Active' : entry.status;

    db.prepare(`
      UPDATE disciplinary_actions
      SET employee_signature = ?, employee_signed_at = ?,
          employee_statement = COALESCE(?, employee_statement),
          acknowledged_at = ?, status = ?
      WHERE id = ?
    `).run(signature, now, employee_statement || null, now, newStatus, id);

    const updated = db.prepare('SELECT * FROM disciplinary_actions WHERE id = ?').get(id);
    res.json({ data: updated, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================================
// All routes below require authentication
// =====================================================================
router.use(authenticateToken);

// GET /api/disciplinary/summary — open actions with monitoring expiring within 30 days
router.get('/summary', (req, res) => {
  const db = getDb();
  try {
    const rows = db.prepare(`
      SELECT d.*,
             e.name AS employee_name, e.department, e.job_title, e.email AS employee_email,
             f.name AS facility_name
      FROM disciplinary_actions d
      JOIN employees e ON d.employee_id = e.id
      LEFT JOIN facilities f ON e.facility_id = f.id
      WHERE d.status IN ('Incomplete','Active','Pending HR Review','Approved')
        AND d.roll_off_date <= date('now', '+30 days')
        AND d.roll_off_date >= date('now')
      ORDER BY d.roll_off_date ASC
    `).all();
    const open = db.prepare(`
      SELECT COUNT(*) AS c FROM disciplinary_actions
      WHERE status IN ('Incomplete','Active','Pending HR Review','Approved')
    `).get();
    res.json({ data: rows, open_cases: open.c, count: open.c });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/disciplinary — list all with employee info
router.get('/', (req, res) => {
  const db = getDb();
  const { employee_id, status } = req.query;

  let query = `
    SELECT d.*,
           e.name AS employee_name, e.department, e.job_title, e.email AS employee_email,
           f.name AS facility_name
    FROM disciplinary_actions d
    JOIN employees e ON d.employee_id = e.id
    LEFT JOIN facilities f ON e.facility_id = f.id
    WHERE 1=1
  `;
  const params = [];

  if (employee_id) {
    query += ` AND d.employee_id = ?`;
    params.push(employee_id);
  }
  if (status) {
    query += ` AND d.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY d.created_at DESC`;

  try {
    const entries = db.prepare(query).all(...params);
    res.json({ data: entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/disciplinary/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  try {
    const entry = db.prepare(`
      SELECT d.*,
             e.name AS employee_name, e.department, e.job_title, e.email AS employee_email,
             f.name AS facility_name,
             u.name AS initiated_by_name
      FROM disciplinary_actions d
      JOIN employees e ON d.employee_id = e.id
      LEFT JOIN facilities f ON d.facility_id = f.id
      LEFT JOIN users u ON d.initiated_by = u.id
      WHERE d.id = ?
    `).get(req.params.id);

    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.json({ data: entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/disciplinary — create new entry (write-up)
router.post('/', (req, res) => {
  const db = getDb();
  const {
    employee_id, facility_id, date_of_incident, issue, details,
    accumulated_points, issuance_date, monitoring_period, type, status,
    next_step,
    violation_types, action_level,
    improvement_plan, consequence_if_continued, consequence_type, suspension_days,
    policy_attached, attachment_path, employee_statement
  } = req.body;

  if (!employee_id || !date_of_incident) {
    return res.status(400).json({ error: 'employee_id and date_of_incident are required' });
  }

  const actualIssuanceDate = issuance_date || date_of_incident;

  // Auto-calculate roll_off_date as 30 calendar days from issuance_date
  const issDate = new Date(actualIssuanceDate);
  issDate.setDate(issDate.getDate() + 30);
  const roll_off_date = issDate.toISOString().split('T')[0];

  // Generate employee sign token
  const employee_sign_token = crypto.randomBytes(32).toString('hex');

  // violation_types may come as array or string; store as JSON
  let violationTypesStr = null;
  if (Array.isArray(violation_types)) {
    violationTypesStr = JSON.stringify(violation_types);
  } else if (typeof violation_types === 'string' && violation_types.length) {
    violationTypesStr = violation_types;
  }

  try {
    const result = db.prepare(`
      INSERT INTO disciplinary_actions (
        employee_id, facility_id, initiated_by,
        date_of_incident, issue, details,
        accumulated_points, issuance_date, monitoring_period, type, status,
        roll_off_date, next_step, notification_sent, created_by,
        violation_types, action_level,
        improvement_plan, consequence_if_continued, consequence_type, suspension_days,
        policy_attached, attachment_path, employee_statement,
        employee_sign_token
      )
      VALUES (
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, 0, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?
      )
    `).run(
      employee_id, facility_id || null, req.user.id,
      date_of_incident, issue || null, details || null,
      accumulated_points || 0, actualIssuanceDate,
      monitoring_period || '30 Days', type || 'New', status || 'Pending HR Review',
      roll_off_date, next_step || null, req.user.id,
      violationTypesStr, action_level || null,
      improvement_plan || null, consequence_if_continued || null,
      consequence_type || null, suspension_days || null,
      policy_attached ? 1 : 0, attachment_path || null, employee_statement || null,
      employee_sign_token
    );

    const entry = db.prepare('SELECT * FROM disciplinary_actions WHERE id = ?').get(result.lastInsertRowid);

    // Send notification email to HR
    const employee = db.prepare('SELECT name, email FROM employees WHERE id = ?').get(employee_id);
    try {
      const emailBody = `<p>A new disciplinary write-up has been initiated for <strong>${employee.name}</strong>.</p>
        <p><strong>Date of Incident:</strong> ${date_of_incident}</p>
        <p><strong>Action Level:</strong> ${action_level || 'N/A'}</p>
        <p><strong>Issue:</strong> ${issue || 'N/A'}</p>
        <p><strong>Status:</strong> ${entry.status}</p>
        <p>This write-up is awaiting HR review.</p>`;

      sendEmail({
        to: 'HR@sipsconsults.com',
        subject: `Disciplinary Write-Up Pending Review - ${employee.name}`,
        html: emailBody
      }).catch(err => console.error('Email error (HR):', err.message));

      db.prepare('UPDATE disciplinary_actions SET notification_sent = 1 WHERE id = ?').run(entry.id);
      entry.notification_sent = 1;
    } catch (e) {
      console.log(`[EMAIL MOCK] Disciplinary notification for employee ${employee_id}`);
    }

    res.status(201).json({ data: entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/disciplinary/:id/approve — HR approves write-up
router.post('/:id/approve', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  if (!['hr', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only HR/admin can approve' });
  }

  const existing = db.prepare('SELECT * FROM disciplinary_actions WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  try {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE disciplinary_actions
      SET status = 'Approved', hr_approved_by = ?, hr_approved_at = ?, employee_notified_at = ?
      WHERE id = ?
    `).run(req.user.id, now, now, id);

    const updated = db.prepare('SELECT * FROM disciplinary_actions WHERE id = ?').get(id);

    // Notify initiator and employee
    const employee = db.prepare('SELECT name, email FROM employees WHERE id = ?').get(existing.employee_id);
    const initiator = existing.initiated_by
      ? db.prepare('SELECT name, email FROM users WHERE id = ?').get(existing.initiated_by)
      : null;

    const APP_URL = process.env.APP_URL || '';
    const employeeLink = `${APP_URL}/disciplinary/sign/${id}/${existing.employee_sign_token}`;

    if (initiator?.email) {
      sendEmail({
        to: initiator.email,
        subject: `Disciplinary Write-Up Approved - ${employee?.name || ''}`,
        html: `<p>The disciplinary write-up for <strong>${employee?.name}</strong> has been approved by HR.</p>
               <p>Please proceed with the manager meeting and signature.</p>`
      }).catch(err => console.error('Email error (initiator):', err.message));
    }

    if (employee?.email) {
      sendEmail({
        to: employee.email,
        subject: 'Disciplinary Action Notice - Acknowledgment Required',
        html: `<p>Hello ${employee.name},</p>
               <p>A disciplinary action has been approved that requires your review and electronic signature.</p>
               <p><a href="${employeeLink}">Click here to view and acknowledge</a></p>
               <p>Or copy this link: ${employeeLink}</p>`
      }).catch(err => console.error('Email error (employee):', err.message));
    }

    res.json({ data: updated, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/disciplinary/:id/sign-employee — employee e-signs (authenticated)
router.post('/:id/sign-employee', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { signature, employee_statement } = req.body;

  if (!signature) return res.status(400).json({ error: 'signature required' });

  const existing = db.prepare('SELECT * FROM disciplinary_actions WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  try {
    const now = new Date().toISOString();
    const newStatus = existing.manager_signature ? 'Active' : existing.status;

    db.prepare(`
      UPDATE disciplinary_actions
      SET employee_signature = ?, employee_signed_at = ?,
          employee_statement = COALESCE(?, employee_statement),
          acknowledged_at = ?, status = ?
      WHERE id = ?
    `).run(signature, now, employee_statement || null, now, newStatus, id);

    const updated = db.prepare('SELECT * FROM disciplinary_actions WHERE id = ?').get(id);
    res.json({ data: updated, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/disciplinary/:id/sign-manager — manager e-signs
router.post('/:id/sign-manager', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { signature } = req.body;

  if (!signature) return res.status(400).json({ error: 'signature required' });

  const existing = db.prepare('SELECT * FROM disciplinary_actions WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  try {
    const now = new Date().toISOString();
    const newStatus = existing.employee_signature ? 'Active' : existing.status;

    db.prepare(`
      UPDATE disciplinary_actions
      SET manager_signature = ?, manager_signed_at = ?, status = ?
      WHERE id = ?
    `).run(signature, now, newStatus, id);

    const updated = db.prepare('SELECT * FROM disciplinary_actions WHERE id = ?').get(id);
    res.json({ data: updated, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/disciplinary/:id — update entry
router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM disciplinary_actions WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const {
    date_of_incident, issue, details, accumulated_points, issuance_date,
    monitoring_period, type, status, roll_off_date, next_step,
    facility_id, violation_types, action_level,
    improvement_plan, consequence_if_continued, consequence_type, suspension_days,
    policy_attached, attachment_path, employee_statement
  } = req.body;

  let violationTypesStr;
  if (violation_types !== undefined) {
    violationTypesStr = Array.isArray(violation_types)
      ? JSON.stringify(violation_types)
      : violation_types;
  } else {
    violationTypesStr = existing.violation_types;
  }

  try {
    db.prepare(`
      UPDATE disciplinary_actions
      SET date_of_incident = ?, issue = ?, details = ?, accumulated_points = ?,
          issuance_date = ?, monitoring_period = ?, type = ?, status = ?,
          roll_off_date = ?, next_step = ?,
          facility_id = ?, violation_types = ?, action_level = ?,
          improvement_plan = ?, consequence_if_continued = ?, consequence_type = ?, suspension_days = ?,
          policy_attached = ?, attachment_path = ?, employee_statement = ?
      WHERE id = ?
    `).run(
      date_of_incident || existing.date_of_incident,
      issue !== undefined ? issue : existing.issue,
      details !== undefined ? details : existing.details,
      accumulated_points !== undefined ? accumulated_points : existing.accumulated_points,
      issuance_date || existing.issuance_date,
      monitoring_period || existing.monitoring_period,
      type || existing.type,
      status || existing.status,
      roll_off_date || existing.roll_off_date,
      next_step !== undefined ? next_step : existing.next_step,
      facility_id !== undefined ? facility_id : existing.facility_id,
      violationTypesStr,
      action_level !== undefined ? action_level : existing.action_level,
      improvement_plan !== undefined ? improvement_plan : existing.improvement_plan,
      consequence_if_continued !== undefined ? consequence_if_continued : existing.consequence_if_continued,
      consequence_type !== undefined ? consequence_type : existing.consequence_type,
      suspension_days !== undefined ? suspension_days : existing.suspension_days,
      policy_attached !== undefined ? (policy_attached ? 1 : 0) : existing.policy_attached,
      attachment_path !== undefined ? attachment_path : existing.attachment_path,
      employee_statement !== undefined ? employee_statement : existing.employee_statement,
      id
    );

    const updated = db.prepare('SELECT * FROM disciplinary_actions WHERE id = ?').get(id);
    res.json({ data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/disciplinary/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM disciplinary_actions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  try {
    db.prepare('DELETE FROM disciplinary_actions WHERE id = ?').run(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
