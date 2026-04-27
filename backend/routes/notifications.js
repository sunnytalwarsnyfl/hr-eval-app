const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { sendEmail } = require('../utils/mailer');

router.use(authenticateToken);

// POST /api/notifications/send-reminders — admin/hr only
router.post('/send-reminders', requireRole('admin', 'hr'), async (req, res) => {
  const db = getDb();

  try {
    // Find employees with no eval in last 12 months (or never evaluated)
    const overdueEmployees = db.prepare(`
      SELECT
        e.id,
        e.name,
        e.email,
        e.department,
        e.manager_id,
        u.name AS manager_name,
        u.email AS manager_email,
        MAX(ev.evaluation_date) AS last_eval_date,
        CASE
          WHEN MAX(ev.evaluation_date) IS NULL THEN 9999
          ELSE CAST((julianday('now') - julianday(MAX(ev.evaluation_date))) AS INTEGER)
        END AS days_since_eval
      FROM employees e
      LEFT JOIN users u ON e.manager_id = u.id
      LEFT JOIN evaluations ev ON e.id = ev.employee_id AND ev.status != 'Draft'
      WHERE e.active = 1
      GROUP BY e.id
      HAVING days_since_eval >= 365
      ORDER BY e.manager_id, days_since_eval DESC
    `).all();

    if (overdueEmployees.length === 0) {
      return res.json({ success: true, message: 'No overdue employees found.', sent: 0 });
    }

    // Group by manager
    const byManager = {};
    for (const emp of overdueEmployees) {
      const key = emp.manager_id || 'unassigned';
      if (!byManager[key]) {
        byManager[key] = {
          manager_name: emp.manager_name || 'Unassigned',
          manager_email: emp.manager_email || null,
          employees: []
        };
      }
      byManager[key].employees.push(emp);
    }

    const results = [];

    for (const [managerId, group] of Object.entries(byManager)) {
      if (!group.manager_email) {
        results.push({ manager: group.manager_name, status: 'skipped — no email' });
        continue;
      }

      const employeeRows = group.employees.map(emp => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${emp.name}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${emp.department}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${emp.last_eval_date || 'Never'}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;color:#dc2626;">${emp.days_since_eval === 9999 ? 'Never evaluated' : `${emp.days_since_eval} days ago`}</td>
        </tr>
      `).join('');

      const html = `
        <h2 style="color:#1d4ed8;">SIPS HR — Employees Due for Performance Review</h2>
        <p>Hello ${group.manager_name},</p>
        <p>The following employees assigned to you are overdue for a performance evaluation (12+ months since last review):</p>
        <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb;">Employee</th>
              <th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb;">Department</th>
              <th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb;">Last Evaluation</th>
              <th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb;">Status</th>
            </tr>
          </thead>
          <tbody>${employeeRows}</tbody>
        </table>
        <p style="margin-top:16px;">Please log in to the <strong>SIPS HR Evaluation System</strong> to schedule evaluations at your earliest convenience.</p>
        <p style="color:#6b7280;font-size:12px;">This is an automated reminder from the SIPS HR Evaluation System.</p>
      `;

      try {
        await sendEmail({
          to: group.manager_email,
          subject: 'SIPS HR — Employees Due for Performance Review',
          html
        });
        results.push({ manager: group.manager_name, status: 'sent', count: group.employees.length });
      } catch (emailErr) {
        console.error('Email error:', emailErr.message);
        results.push({ manager: group.manager_name, status: 'error', error: emailErr.message });
      }
    }

    res.json({
      success: true,
      message: `Reminders processed for ${Object.keys(byManager).length} manager(s).`,
      overdueCount: overdueEmployees.length,
      results
    });
  } catch (err) {
    console.error('send-reminders error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/invite/:employeeId — send welcome invite to employee
router.post('/invite/:employeeId', requireRole('admin', 'hr', 'manager'), async (req, res) => {
  const db = getDb();
  const { employeeId } = req.params;

  try {
    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const html = `
      <h2 style="color:#1d4ed8;">Welcome to the SIPS HR Evaluation System</h2>
      <p>Hello ${employee.name},</p>
      <p>You have been registered in the <strong>SIPS HR Evaluation System</strong>. Your performance evaluations will be managed through this platform.</p>
      <p>If you have any questions, please contact your manager or HR department.</p>
      <p style="color:#6b7280;font-size:12px;">SIPS HR Evaluation System</p>
    `;

    await sendEmail({
      to: employee.email,
      subject: 'Welcome to SIPS HR Evaluation System',
      html
    });

    res.json({ success: true, message: `Invite sent to ${employee.email}` });
  } catch (err) {
    console.error('invite error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/reminder — admin/HR sends a manual reminder to a manager
router.post('/reminder', requireRole('admin', 'hr'), async (req, res) => {
  const db = getDb();
  const { employee_id, manager_id, message } = req.body;

  if (!employee_id || !manager_id) {
    return res.status(400).json({ error: 'employee_id and manager_id are required' });
  }

  try {
    const manager = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(manager_id);
    if (!manager) return res.status(404).json({ error: 'Manager not found' });
    if (!manager.email) return res.status(400).json({ error: 'Manager has no email on file' });

    const employee = db.prepare('SELECT id, name, department, job_title FROM employees WHERE id = ?').get(employee_id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const safeMessage = (message || '').toString();
    const html = `
      <h2 style="color:#1d4ed8;">SIPS HR — Manual Reminder</h2>
      <p>Hello ${manager.name},</p>
      <p>This is a reminder regarding employee <strong>${employee.name}</strong>${employee.department ? ' (' + employee.department + ')' : ''}.</p>
      <div style="background:#f9fafb;border-left:4px solid #1d4ed8;padding:12px;margin:12px 0;">
        ${safeMessage.replace(/\n/g, '<br>') || '<em>No additional message provided.</em>'}
      </div>
      <p>Please log in to the SIPS HR Evaluation System to take any required action.</p>
      <p style="color:#6b7280;font-size:12px;">Sent by ${req.user.name || req.user.email || 'HR'} via SIPS HR Evaluation System.</p>
    `;

    let emailStatus = 'sent';
    try {
      await sendEmail({
        to: manager.email,
        subject: `SIPS HR Reminder — ${employee.name}`,
        html
      });
    } catch (emailErr) {
      console.error('Reminder email error:', emailErr.message);
      emailStatus = 'error';
    }

    // Insert into eval_notifications
    let notificationId = null;
    try {
      const result = db.prepare(`
        INSERT INTO eval_notifications (
          employee_id, evaluation_id, notification_type,
          sent_to_role, sent_to_email, reminder_sent_manually, sent_by
        )
        VALUES (?, NULL, 'manual_reminder', 'manager', ?, 1, ?)
      `).run(employee_id, manager.email, req.user.id);
      notificationId = result.lastInsertRowid;
    } catch (insErr) {
      console.error('eval_notifications insert error:', insErr.message);
    }

    res.json({
      success: true,
      message: `Reminder sent to ${manager.name} <${manager.email}>`,
      notification_id: notificationId,
      email_status: emailStatus
    });
  } catch (err) {
    console.error('reminder error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/reminders/bulk — send manual reminders for multiple employees
router.post('/reminders/bulk', requireRole('admin', 'hr'), async (req, res) => {
  const db = getDb();
  const { reminders } = req.body; // [{ employee_id, manager_id, message }, ...]

  if (!Array.isArray(reminders) || reminders.length === 0) {
    return res.status(400).json({ error: 'reminders array required' });
  }

  const results = [];
  for (const item of reminders) {
    try {
      const manager = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(item.manager_id);
      const employee = db.prepare('SELECT id, name, department FROM employees WHERE id = ?').get(item.employee_id);

      if (!manager || !manager.email) {
        results.push({ employee_id: item.employee_id, status: 'skipped', reason: 'manager has no email' });
        continue;
      }
      if (!employee) {
        results.push({ employee_id: item.employee_id, status: 'skipped', reason: 'employee not found' });
        continue;
      }

      const safeMessage = (item.message || '').toString();
      const html = `
        <h2 style="color:#1d4ed8;">SIPS HR — Reminder</h2>
        <p>Hello ${manager.name},</p>
        <p>This is a reminder regarding employee <strong>${employee.name}</strong>${employee.department ? ' (' + employee.department + ')' : ''}.</p>
        <div style="background:#f9fafb;border-left:4px solid #1d4ed8;padding:12px;margin:12px 0;">
          ${safeMessage.replace(/\n/g, '<br>') || '<em>Evaluation due soon. Please log in to take action.</em>'}
        </div>
        <p>Please log in to the SIPS HR Evaluation System to take any required action.</p>
        <p style="color:#6b7280;font-size:12px;">Sent by ${req.user.name || req.user.email || 'HR'} via SIPS HR Evaluation System.</p>
      `;

      try {
        await sendEmail({
          to: manager.email,
          subject: `SIPS HR Reminder — ${employee.name}`,
          html
        });
      } catch (e) {
        console.error('bulk reminder email error:', e.message);
      }

      // Log notification
      try {
        db.prepare(`
          INSERT INTO eval_notifications (
            employee_id, notification_type,
            sent_to_role, sent_to_email, reminder_sent_manually, sent_by
          )
          VALUES (?, 'manual_reminder_bulk', 'manager', ?, 1, ?)
        `).run(item.employee_id, manager.email, req.user.id);
      } catch (_) {}

      results.push({ employee_id: item.employee_id, status: 'sent', manager: manager.name });
    } catch (err) {
      results.push({ employee_id: item.employee_id, status: 'error', error: err.message });
    }
  }

  res.json({
    success: true,
    total: reminders.length,
    sent: results.filter(r => r.status === 'sent').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    error: results.filter(r => r.status === 'error').length,
    results
  });
});

// GET /api/notifications/log — admin/HR only — returns recent eval_notifications
router.get('/log', requireRole('admin', 'hr'), (req, res) => {
  const db = getDb();
  const { limit = 100, employee_id, type } = req.query;

  let query = `
    SELECT n.*, e.name AS employee_name, e.department,
           u.name AS sent_by_name
    FROM eval_notifications n
    LEFT JOIN employees e ON n.employee_id = e.id
    LEFT JOIN users u ON n.sent_by = u.id
    WHERE 1=1
  `;
  const params = [];
  if (employee_id) {
    query += ' AND n.employee_id = ?';
    params.push(employee_id);
  }
  if (type) {
    query += ' AND n.notification_type = ?';
    params.push(type);
  }
  query += ' ORDER BY n.sent_at DESC LIMIT ?';
  params.push(Number(limit));

  try {
    const rows = db.prepare(query).all(...params);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
