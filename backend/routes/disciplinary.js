const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

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
      WHERE d.status = 'Incomplete'
        AND d.roll_off_date <= date('now', '+30 days')
        AND d.roll_off_date >= date('now')
      ORDER BY d.roll_off_date ASC
    `).all();
    res.json({ data: rows });
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
             f.name AS facility_name
      FROM disciplinary_actions d
      JOIN employees e ON d.employee_id = e.id
      LEFT JOIN facilities f ON e.facility_id = f.id
      WHERE d.id = ?
    `).get(req.params.id);

    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.json({ data: entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/disciplinary — create new entry
router.post('/', (req, res) => {
  const db = getDb();
  const { employee_id, date_of_incident, issue, details, accumulated_points, issuance_date, monitoring_period, type, status, next_step } = req.body;

  if (!employee_id || !date_of_incident) {
    return res.status(400).json({ error: 'employee_id and date_of_incident are required' });
  }

  const actualIssuanceDate = issuance_date || date_of_incident;

  // Auto-calculate roll_off_date as 30 calendar days from issuance_date
  const issDate = new Date(actualIssuanceDate);
  issDate.setDate(issDate.getDate() + 30);
  const roll_off_date = issDate.toISOString().split('T')[0];

  try {
    const result = db.prepare(`
      INSERT INTO disciplinary_actions (employee_id, date_of_incident, issue, details, accumulated_points, issuance_date, monitoring_period, type, status, roll_off_date, next_step, notification_sent, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      employee_id, date_of_incident, issue || null, details || null,
      accumulated_points || 0, actualIssuanceDate,
      monitoring_period || '30 Days', type || 'New', status || 'Incomplete',
      roll_off_date, next_step || null, req.user.id
    );

    const entry = db.prepare('SELECT * FROM disciplinary_actions WHERE id = ?').get(result.lastInsertRowid);

    // Send notification email
    const employee = db.prepare('SELECT name, email FROM employees WHERE id = ?').get(employee_id);
    try {
      const { sendEmail } = require('../utils/mailer');
      const emailBody = `<p>A new disciplinary action has been recorded for <strong>${employee.name}</strong>.</p>
        <p><strong>Date of Incident:</strong> ${date_of_incident}</p>
        <p><strong>Issue:</strong> ${issue || 'N/A'}</p>
        <p><strong>Details:</strong> ${details || 'N/A'}</p>
        <p><strong>Monitoring Period:</strong> ${monitoring_period || '30 Days'}</p>
        <p><strong>Roll-off Date:</strong> ${roll_off_date}</p>`;

      // Notify HR
      sendEmail({
        to: 'HR@sipsconsults.com',
        subject: `Disciplinary Action - ${employee.name}`,
        html: emailBody
      }).catch(err => console.error('Email error (HR):', err.message));

      // Notify the employee
      if (employee.email) {
        sendEmail({
          to: employee.email,
          subject: 'Disciplinary Action Notice',
          html: emailBody
        }).catch(err => console.error('Email error (employee):', err.message));
      }

      // Mark notification as sent
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

// PUT /api/disciplinary/:id — update entry
router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM disciplinary_actions WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { date_of_incident, issue, details, accumulated_points, issuance_date, monitoring_period, type, status, roll_off_date, next_step } = req.body;

  try {
    db.prepare(`
      UPDATE disciplinary_actions
      SET date_of_incident = ?, issue = ?, details = ?, accumulated_points = ?,
          issuance_date = ?, monitoring_period = ?, type = ?, status = ?,
          roll_off_date = ?, next_step = ?
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
