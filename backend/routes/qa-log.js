const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { audit } = require('../utils/auditLog');

router.use(authenticateToken);

// POST /api/qa-log/upload — multipart file upload for QA attachments
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({
    filename: req.file.filename,
    path: `/api/uploads/${req.file.filename}`,
    size: req.file.size
  });
});

// QA issue types and their point values (legacy free-text → points, kept for backward compat)
const QA_ISSUE_POINTS = {
  'Bio Burden: Visible debris on instruments or trays': 4,
  'Broken instruments in set: Nonfunctional or breached integrity': 4,
  'Incorrect instrument(s) in set: Adverse to Count sheet requirement': 2,
  'Missing instrument documented as found: Undocumented instruments': 2,
  'Missing tray filters: Missing tray filters': 2,
  'Incomplete trays: Missing instruments not identified as missing on count sheet': 2,
  'Incorrect tray on Case Carts: Adverse to preference card requirement': 2,
  'Incorrect decontamination process: Not using the proper decontamination process': 2,
};

// New canonical issue_type → points map
const QA_POINTS_MAP = {
  'Bio Burden': 4,
  'Broken Instruments in Set': 4,
  'Incorrect Instruments in Set': 2,
  'Missing Instrument Documented as Found': 2,
  'Missing Tray Filters': 2,
  'Incomplete Trays': 2,
  'Incorrect Tray on Case Carts': 2,
  'Incorrect Decontamination Process': 2
};

function getQAActionRequired(totalPoints) {
  if (totalPoints >= 10) return 'Termination';
  if (totalPoints >= 8) return 'Final Written Warning';
  if (totalPoints >= 6) return 'Written Warning with Additional Training';
  if (totalPoints >= 4) return 'Written Warning with Counseling';
  if (totalPoints >= 2) return 'Verbal Warning';
  return null;
}

// GET /api/qa-log — list all with employee info
router.get('/', (req, res) => {
  const db = getDb();
  const { employee_id, status } = req.query;

  let query = `
    SELECT q.*,
           e.name AS employee_name, e.department, e.job_title, e.email AS employee_email,
           f.name AS facility_name
    FROM qa_log q
    JOIN employees e ON q.employee_id = e.id
    LEFT JOIN facilities f ON e.facility_id = f.id
    WHERE 1=1
  `;
  const params = [];

  // Manager scope: only their employees' QA records
  if (req.user.role === 'manager') {
    query += ` AND e.manager_id = ?`;
    params.push(req.user.id);
  }

  if (employee_id) {
    query += ` AND q.employee_id = ?`;
    params.push(employee_id);
  }
  if (status) {
    query += ` AND q.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY q.created_at DESC`;

  try {
    const entries = db.prepare(query).all(...params);
    res.json({ data: entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/qa-log/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  try {
    const entry = db.prepare(`
      SELECT q.*,
             e.name AS employee_name, e.department, e.job_title, e.email AS employee_email,
             f.name AS facility_name
      FROM qa_log q
      JOIN employees e ON q.employee_id = e.id
      LEFT JOIN facilities f ON e.facility_id = f.id
      WHERE q.id = ?
    `).get(req.params.id);

    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.json({ data: entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/qa-log — create new entry
router.post('/', (req, res) => {
  const db = getDb();
  const {
    employee_id, date_of_incident,
    issue, description, status,
    action_step, action_taken,
    issue_type, facility_id,
    attachment_path, employee_initials, manager_initials
  } = req.body;
  let { roll_off_date } = req.body;

  if (!employee_id || !date_of_incident) {
    return res.status(400).json({ error: 'employee_id and date_of_incident are required' });
  }

  // Determine points: prefer new issue_type → QA_POINTS_MAP; fall back to legacy free-text issue
  let issuePoints = 0;
  if (issue_type && QA_POINTS_MAP[issue_type] !== undefined) {
    issuePoints = QA_POINTS_MAP[issue_type];
  } else if (issue && QA_ISSUE_POINTS[issue] !== undefined) {
    issuePoints = QA_ISSUE_POINTS[issue];
  }

  // Roll off date: 12 months from date_of_incident (override only if explicitly provided)
  if (!roll_off_date) {
    const d = new Date(date_of_incident);
    d.setMonth(d.getMonth() + 12);
    roll_off_date = d.toISOString().split('T')[0];
  }

  // Calculate accumulated active QA points for this employee (12-month rolling window)
  const activeRow = db.prepare(`
    SELECT COALESCE(SUM(COALESCE(issue_points, accumulated_points, 0)), 0) AS total
    FROM qa_log
    WHERE employee_id = ? AND roll_off_date > date('now')
  `).get(employee_id);
  const accumulatedTotal = (activeRow.total || 0) + issuePoints;

  // Determine action from threshold
  const computedAction = getQAActionRequired(accumulatedTotal);
  const finalActionTaken = action_taken || computedAction || null;
  const disciplinaryTriggered = accumulatedTotal >= 6 ? 1 : 0;

  // Resolve facility_id from employee if not given
  let resolvedFacilityId = facility_id;
  if (!resolvedFacilityId) {
    const emp = db.prepare('SELECT facility_id FROM employees WHERE id = ?').get(employee_id);
    resolvedFacilityId = emp ? emp.facility_id : null;
  }

  try {
    const result = db.prepare(`
      INSERT INTO qa_log (
        employee_id, date_of_incident, issue, description,
        accumulated_points, roll_off_date, status, action_step,
        notification_sent, created_by,
        facility_id, issue_type, issue_points, attachment_path,
        employee_initials, manager_initials, action_taken, disciplinary_triggered
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      employee_id, date_of_incident, issue || null, description || null,
      issuePoints, roll_off_date, status || 'Incomplete',
      action_step || null, req.user.id,
      resolvedFacilityId || null, issue_type || null, issuePoints,
      attachment_path || null, employee_initials || null, manager_initials || null,
      finalActionTaken, disciplinaryTriggered
    );

    const entry = db.prepare('SELECT * FROM qa_log WHERE id = ?').get(result.lastInsertRowid);

    // Send notification to the employee's manager
    const employee = db.prepare('SELECT name, manager_id FROM employees WHERE id = ?').get(employee_id);
    if (employee && employee.manager_id) {
      const manager = db.prepare('SELECT name, email FROM users WHERE id = ?').get(employee.manager_id);
      if (manager && manager.email) {
        try {
          const { sendEmail } = require('../utils/mailer');
          sendEmail({
            to: manager.email,
            subject: `QA Log Entry - ${employee.name}`,
            html: `<p>A new QA log entry has been created for <strong>${employee.name}</strong>.</p>
              <p><strong>Date of Incident:</strong> ${date_of_incident}</p>
              <p><strong>Issue Type:</strong> ${issue_type || issue || 'N/A'}</p>
              <p><strong>Points:</strong> ${issuePoints}</p>
              <p><strong>Total Active Points:</strong> ${accumulatedTotal}</p>
              <p><strong>Action Required:</strong> ${finalActionTaken || 'None'}</p>
              <p><strong>Description:</strong> ${description || 'N/A'}</p>`
          }).catch(err => console.error('Email error (manager):', err.message));

          db.prepare('UPDATE qa_log SET notification_sent = 1 WHERE id = ?').run(entry.id);
          entry.notification_sent = 1;
        } catch (e) {
          console.log(`[EMAIL MOCK] QA notification to manager for employee ${employee_id}`);
        }
      }
    }

    try { audit(req, 'create', 'qa_log', entry.id, { issue_type, employee_id }); } catch (_) {}
    res.status(201).json({ data: entry, accumulated_total: accumulatedTotal, action_required: finalActionTaken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/qa-log/:id — update entry
router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM qa_log WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { date_of_incident, issue, description, accumulated_points, roll_off_date, status, action_step } = req.body;

  // Recalculate points if issue changed
  let points = accumulated_points;
  if (points === undefined) {
    if (issue !== undefined && issue !== existing.issue) {
      points = issue ? (QA_ISSUE_POINTS[issue] || 0) : 0;
    } else {
      points = existing.accumulated_points;
    }
  }

  try {
    db.prepare(`
      UPDATE qa_log
      SET date_of_incident = ?, issue = ?, description = ?, accumulated_points = ?,
          roll_off_date = ?, status = ?, action_step = ?
      WHERE id = ?
    `).run(
      date_of_incident || existing.date_of_incident,
      issue !== undefined ? issue : existing.issue,
      description !== undefined ? description : existing.description,
      points,
      roll_off_date !== undefined ? roll_off_date : existing.roll_off_date,
      status || existing.status,
      action_step !== undefined ? action_step : existing.action_step,
      id
    );

    const updated = db.prepare('SELECT * FROM qa_log WHERE id = ?').get(id);
    try { audit(req, 'update', 'qa_log', Number(id)); } catch (_) {}
    res.json({ data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/qa-log/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM qa_log WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  try {
    db.prepare('DELETE FROM qa_log WHERE id = ?').run(req.params.id);
    try { audit(req, 'delete', 'qa_log', Number(req.params.id)); } catch (_) {}
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
