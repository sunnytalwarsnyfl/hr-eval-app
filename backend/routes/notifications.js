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

module.exports = router;
