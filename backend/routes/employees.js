const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { sendEmail } = require('../utils/mailer');

router.use(authenticateToken);

// GET /api/employees
router.get('/', (req, res) => {
  const db = getDb();
  const { search, department, active } = req.query;

  let query = `
    SELECT
      e.*,
      u.name AS manager_name,
      f.name AS facility_name,
      ev.evaluation_date AS last_eval_date,
      ev.total_score AS last_score,
      ev.passed AS last_passed,
      ev.status AS last_status
    FROM employees e
    LEFT JOIN users u ON e.manager_id = u.id
    LEFT JOIN facilities f ON e.facility_id = f.id
    LEFT JOIN (
      SELECT employee_id, evaluation_date, total_score, passed, status,
             ROW_NUMBER() OVER (PARTITION BY employee_id ORDER BY evaluation_date DESC) AS rn
      FROM evaluations
      WHERE status != 'Draft'
    ) ev ON e.id = ev.employee_id AND ev.rn = 1
    WHERE 1=1
  `;

  const params = [];

  // Manager role: only see their assigned employees
  if (req.user.role === 'manager') {
    query += ` AND e.manager_id = ?`;
    params.push(req.user.id);
  }

  if (search) {
    query += ` AND (e.name LIKE ? OR e.email LIKE ? OR e.department LIKE ?)`;
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  if (department) {
    query += ` AND e.department = ?`;
    params.push(department);
  }

  if (active !== undefined) {
    query += ` AND e.active = ?`;
    params.push(active === 'true' ? 1 : 0);
  } else {
    query += ` AND e.active = 1`;
  }

  query += ` ORDER BY e.name ASC`;

  const employees = db.prepare(query).all(...params);
  res.json({ employees });
});

// GET /api/employees/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const employee = db.prepare(`
    SELECT e.*, u.name AS manager_name
    FROM employees e
    LEFT JOIN users u ON e.manager_id = u.id
    WHERE e.id = ?
  `).get(id);

  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  // Manager can only view their own employees
  if (req.user.role === 'manager' && employee.manager_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const evaluations = db.prepare(`
    SELECT ev.*, u.name AS evaluator_name
    FROM evaluations ev
    LEFT JOIN users u ON ev.evaluator_id = u.id
    WHERE ev.employee_id = ?
    ORDER BY ev.evaluation_date DESC
  `).all(id);

  const pipPlans = db.prepare(`
    SELECT pp.* FROM pip_plans pp
    JOIN evaluations ev ON pp.evaluation_id = ev.id
    WHERE ev.employee_id = ?
    ORDER BY pp.created_at DESC
  `).all(id);

  res.json({ employee, evaluations, pipPlans });
});

// GET /api/employees/leaders — employees where is_leadership = 1
router.get('/leaders', (req, res) => {
  const db = getDb();
  try {
    const leaders = db.prepare(`
      SELECT id, name, email, department, job_title, facility_id
      FROM employees
      WHERE is_leadership = 1 AND active = 1
      ORDER BY name ASC
    `).all();
    res.json({ leaders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/employees
router.post('/', (req, res) => {
  const db = getDb();
  const {
    name, email, hire_date, department, job_title, tech_level,
    manager_id, facility_id, phone, employment_type,
    is_leadership, is_evaluator, belt_level,
    work_email, phone_number, anniversary_date
  } = req.body;

  if (!name || !email || !hire_date || !department || !job_title) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // work_email takes priority over email when both provided; phone_number takes priority over phone
  const finalWorkEmail = work_email || email || null;
  const finalPhoneNumber = phone_number || phone || null;
  const finalAnniversaryDate = anniversary_date || hire_date;

  try {
    const result = db.prepare(`
      INSERT INTO employees (
        name, email, hire_date, department, job_title, tech_level,
        manager_id, facility_id, phone, employment_type,
        is_leadership, is_evaluator, belt_level,
        work_email, phone_number, anniversary_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, email, hire_date, department, job_title,
      tech_level || null, manager_id || null, facility_id || null,
      phone || null, employment_type || 'Permanent',
      is_leadership ? 1 : 0, is_evaluator ? 1 : 0, belt_level || null,
      finalWorkEmail, finalPhoneNumber, finalAnniversaryDate
    );

    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ employee });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/employees/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const {
    name, email, hire_date, department, job_title, tech_level,
    manager_id, facility_id, active, phone, employment_type,
    is_leadership, is_evaluator, belt_level,
    work_email, phone_number, anniversary_date
  } = req.body;

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  // work_email priority: explicit work_email > explicit email > existing work_email > existing email
  let finalWorkEmail;
  if (work_email !== undefined) finalWorkEmail = work_email;
  else if (email !== undefined) finalWorkEmail = email;
  else finalWorkEmail = employee.work_email || employee.email;

  // phone_number priority: explicit phone_number > explicit phone > existing phone_number > existing phone
  let finalPhoneNumber;
  if (phone_number !== undefined) finalPhoneNumber = phone_number;
  else if (phone !== undefined) finalPhoneNumber = phone;
  else finalPhoneNumber = employee.phone_number || employee.phone;

  // anniversary_date defaults to hire_date if not provided and no existing value
  let finalAnniversaryDate;
  if (anniversary_date !== undefined) finalAnniversaryDate = anniversary_date;
  else if (employee.anniversary_date) finalAnniversaryDate = employee.anniversary_date;
  else finalAnniversaryDate = hire_date || employee.hire_date;

  try {
    db.prepare(`
      UPDATE employees
      SET name = ?, email = ?, hire_date = ?, department = ?, job_title = ?,
          tech_level = ?, manager_id = ?, facility_id = ?, active = ?,
          phone = ?, employment_type = ?, is_leadership = ?, is_evaluator = ?, belt_level = ?,
          work_email = ?, phone_number = ?, anniversary_date = ?
      WHERE id = ?
    `).run(
      name || employee.name,
      email || employee.email,
      hire_date || employee.hire_date,
      department || employee.department,
      job_title || employee.job_title,
      tech_level !== undefined ? tech_level : employee.tech_level,
      manager_id !== undefined ? manager_id : employee.manager_id,
      facility_id !== undefined ? facility_id : employee.facility_id,
      active !== undefined ? (active ? 1 : 0) : employee.active,
      phone !== undefined ? phone : employee.phone,
      employment_type !== undefined ? employment_type : employee.employment_type,
      is_leadership !== undefined ? (is_leadership ? 1 : 0) : employee.is_leadership,
      is_evaluator !== undefined ? (is_evaluator ? 1 : 0) : employee.is_evaluator,
      belt_level !== undefined ? belt_level : employee.belt_level,
      finalWorkEmail,
      finalPhoneNumber,
      finalAnniversaryDate,
      id
    );

    const updated = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    res.json({ employee: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/employees/:id — soft delete
router.delete('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  try {
    db.prepare('UPDATE employees SET active = 0 WHERE id = ?').run(id);
    res.json({ message: 'Employee deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/employees/:id/attendance
router.get('/:id/attendance', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const employee = db.prepare('SELECT id, manager_id FROM employees WHERE id = ?').get(id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });
  if (req.user.role === 'manager' && employee.manager_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const records = db.prepare(`
      SELECT a.*, f.name AS facility_name
      FROM attendance_log a
      LEFT JOIN facilities f ON a.facility_id = f.id
      WHERE a.employee_id = ?
      ORDER BY a.date_of_occurrence DESC, a.created_at DESC
    `).all(id);
    res.json({ data: records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/employees/:id/qa-log
router.get('/:id/qa-log', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const employee = db.prepare('SELECT id, manager_id FROM employees WHERE id = ?').get(id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });
  if (req.user.role === 'manager' && employee.manager_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const records = db.prepare(`
      SELECT q.*, f.name AS facility_name
      FROM qa_log q
      LEFT JOIN facilities f ON q.facility_id = f.id
      WHERE q.employee_id = ?
      ORDER BY q.date_of_incident DESC, q.created_at DESC
    `).all(id);
    res.json({ data: records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/employees/:id/disciplinary
router.get('/:id/disciplinary', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const employee = db.prepare('SELECT id, manager_id FROM employees WHERE id = ?').get(id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });
  if (req.user.role === 'manager' && employee.manager_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const records = db.prepare(`
      SELECT d.*, f.name AS facility_name
      FROM disciplinary_actions d
      LEFT JOIN facilities f ON d.facility_id = f.id
      WHERE d.employee_id = ?
      ORDER BY d.date_of_incident DESC, d.created_at DESC
    `).all(id);
    res.json({ data: records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/employees/:id/pip
router.get('/:id/pip', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const employee = db.prepare('SELECT id, manager_id FROM employees WHERE id = ?').get(id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });
  if (req.user.role === 'manager' && employee.manager_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const records = db.prepare(`
      SELECT pp.*, ev.evaluation_date, ev.evaluation_type
      FROM pip_plans pp
      JOIN evaluations ev ON pp.evaluation_id = ev.id
      WHERE ev.employee_id = ?
      ORDER BY pp.created_at DESC
    `).all(id);
    res.json({ data: records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/employees/:id/invite — send invite email (mock)
router.post('/:id/invite', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  // Try to send via mailer if configured, else mock
  try {
    const { sendEmail } = require('../utils/mailer');
    sendEmail({
      to: employee.email,
      subject: 'Welcome to SIPS HR Evaluation System',
      html: `<p>Hello ${employee.name},</p><p>You have been added to the SIPS HR Evaluation System. Your manager will schedule your performance evaluations through this platform.</p><p>Thank you.</p>`
    }).catch(err => console.error('Email send error:', err.message));
  } catch (e) {
    console.log(`[EMAIL MOCK] Invite to: ${employee.email}`);
  }

  res.json({ success: true, message: `Invite sent to ${employee.email}` });
});

// POST /api/employees/:id/invite-self-eval — admin/hr/manager triggers self-eval invite
router.post('/:id/invite-self-eval', requireRole('admin', 'hr', 'manager'), async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  // Manager scope check
  if (req.user.role === 'manager' && employee.manager_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const targetEmail = employee.work_email || employee.email;
  if (!targetEmail) {
    return res.status(400).json({ error: 'Employee has no work email on file' });
  }

  try {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    // Find existing user linked to this employee (by employee_id or by email)
    let user = db.prepare(`
      SELECT * FROM users
      WHERE employee_id = ? OR email = ?
      LIMIT 1
    `).get(id, targetEmail);

    if (user) {
      db.prepare(`
        UPDATE users
        SET invite_token = ?, invite_expires_at = ?, invite_used = 0, employee_id = ?
        WHERE id = ?
      `).run(token, expiresAt, id, user.id);
    } else {
      // Create new user with role 'employee' — no usable password
      const placeholderHash = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);
      const result = db.prepare(`
        INSERT INTO users (name, email, password_hash, role, department,
                           invite_token, invite_expires_at, invite_used, employee_id)
        VALUES (?, ?, ?, 'employee', ?, ?, ?, 0, ?)
      `).run(
        employee.name, targetEmail, placeholderHash,
        employee.department || null, token, expiresAt, id
      );
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    }

    const APP_URL = process.env.APP_URL || '';
    const link = `${APP_URL}/self-eval/invite/${token}`;

    const html = `
      <h2 style="color:#1d4ed8;">SIPS Healthcare — Self-Evaluation Invitation</h2>
      <p>Hello ${employee.name},</p>
      <p>You have been invited to complete a self-evaluation as part of your performance review process.</p>
      <p>Please click the link below to begin. This link is valid for <strong>48 hours</strong>.</p>
      <p><a href="${link}" style="background:#1d4ed8;color:white;padding:10px 16px;border-radius:6px;text-decoration:none;">Start Self-Evaluation</a></p>
      <p style="font-size:12px;color:#6b7280;">Or copy this link: ${link}</p>
      <p style="font-size:12px;color:#6b7280;">If you did not expect this email, please contact HR.</p>
    `;

    try {
      await sendEmail({
        to: targetEmail,
        subject: 'Self-Evaluation Invite — SIPS Healthcare',
        html
      });
    } catch (e) {
      console.error('Self-eval invite email error:', e.message);
    }

    res.json({ success: true, sent_to: targetEmail });
  } catch (err) {
    console.error('invite-self-eval error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/employees/bulk/invite-self-eval — send self-eval invites to multiple employees
router.post('/bulk/invite-self-eval', requireRole('admin', 'hr', 'manager'), async (req, res) => {
  const db = getDb();
  const { employee_ids } = req.body;
  if (!Array.isArray(employee_ids) || !employee_ids.length) {
    return res.status(400).json({ error: 'employee_ids array required' });
  }

  const results = [];
  for (const id of employee_ids) {
    try {
      const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
      if (!employee) { results.push({ id, status: 'skipped', reason: 'not found' }); continue; }

      // Manager scope check
      if (req.user.role === 'manager' && employee.manager_id !== req.user.id) {
        results.push({ id, status: 'skipped', reason: 'not in scope' });
        continue;
      }

      const targetEmail = employee.work_email || employee.email;
      if (!targetEmail) {
        results.push({ id, status: 'skipped', reason: 'no email' });
        continue;
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      // Find or create user
      let user = db.prepare(`
        SELECT * FROM users WHERE employee_id = ? OR email = ? LIMIT 1
      `).get(id, targetEmail);

      if (user) {
        db.prepare(`
          UPDATE users
          SET invite_token = ?, invite_expires_at = ?, invite_used = 0, employee_id = ?
          WHERE id = ?
        `).run(token, expiresAt, id, user.id);
      } else {
        const placeholderHash = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);
        db.prepare(`
          INSERT INTO users (name, email, password_hash, role, department,
                             invite_token, invite_expires_at, invite_used, employee_id)
          VALUES (?, ?, ?, 'employee', ?, ?, ?, 0, ?)
        `).run(
          employee.name, targetEmail, placeholderHash,
          employee.department || null, token, expiresAt, id
        );
      }

      const APP_URL = process.env.APP_URL || '';
      const link = `${APP_URL}/self-eval/invite/${token}`;
      const html = `
        <h2 style="color:#1d4ed8;">SIPS Healthcare — Self-Evaluation Invitation</h2>
        <p>Hello ${employee.name},</p>
        <p>You have been invited to complete a self-evaluation as part of your performance review process.</p>
        <p>Please click the link below to begin. This link is valid for <strong>48 hours</strong>.</p>
        <p><a href="${link}" style="background:#1d4ed8;color:white;padding:10px 16px;border-radius:6px;text-decoration:none;">Start Self-Evaluation</a></p>
        <p style="font-size:12px;color:#6b7280;">Or copy this link: ${link}</p>
      `;

      try {
        await sendEmail({
          to: targetEmail,
          subject: 'Self-Evaluation Invite — SIPS Healthcare',
          html
        });
        results.push({ id, status: 'sent', email: targetEmail });
      } catch (e) {
        results.push({ id, status: 'error', error: e.message });
      }
    } catch (err) {
      results.push({ id, status: 'error', error: err.message });
    }
  }

  res.json({
    total: employee_ids.length,
    sent: results.filter(r => r.status === 'sent').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    errors: results.filter(r => r.status === 'error').length,
    results
  });
});

// POST /api/employees/bulk/deactivate — deactivate multiple employees
router.post('/bulk/deactivate', requireRole('admin', 'hr'), (req, res) => {
  const db = getDb();
  const { employee_ids } = req.body;
  if (!Array.isArray(employee_ids) || !employee_ids.length) {
    return res.status(400).json({ error: 'employee_ids array required' });
  }

  let updated = 0;
  for (const id of employee_ids) {
    try {
      const r = db.prepare('UPDATE employees SET active = 0 WHERE id = ?').run(id);
      updated += r.changes;
    } catch (_) {}
  }
  res.json({ total: employee_ids.length, deactivated: updated });
});

module.exports = router;
