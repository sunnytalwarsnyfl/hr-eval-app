const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

function getAttendancePoints(occurrenceCode) {
  const map = {
    'A': 1.0, 'A3': 1.0, 'AA': 0.0, 'N': 1.0,
    'S': 0.0, 'W': 0.0, 'TT': 1.0,
    'T15': 0.25, 'T30': 0.50, 'T120': 0.75, 'T121': 1.0,
    'E15': 0.25, 'E30': 0.50, 'E120': 0.75, 'E121': 1.0
  };
  return map[occurrenceCode] ?? 0;
}

router.use(authenticateToken);

// GET /api/attendance/summary — per-employee accumulated points summary
router.get('/summary', (req, res) => {
  const db = getDb();
  try {
    const rows = db.prepare(`
      SELECT e.id AS employee_id, e.name, e.department, e.job_title,
             f.name AS facility_name,
             COALESCE(SUM(a.accumulated_points), 0) AS total_active_points,
             COUNT(a.id) AS occurrence_count
      FROM employees e
      LEFT JOIN facilities f ON e.facility_id = f.id
      LEFT JOIN attendance_log a ON a.employee_id = e.id AND a.roll_off_date > date('now')
      WHERE e.active = 1
      GROUP BY e.id
      HAVING total_active_points > 0
      ORDER BY total_active_points DESC
    `).all();
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/attendance — list all entries
router.get('/', (req, res) => {
  const db = getDb();
  const { employee_id } = req.query;

  let query = `
    SELECT a.*,
           e.name AS employee_name, e.department, e.job_title,
           f.name AS facility_name
    FROM attendance_log a
    JOIN employees e ON a.employee_id = e.id
    LEFT JOIN facilities f ON e.facility_id = f.id
    WHERE 1=1
  `;
  const params = [];

  if (employee_id) {
    query += ` AND a.employee_id = ?`;
    params.push(employee_id);
  }

  query += ` ORDER BY a.created_at DESC`;

  try {
    const entries = db.prepare(query).all(...params);
    res.json({ data: entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/attendance/:id — single entry
router.get('/:id', (req, res) => {
  const db = getDb();
  try {
    const entry = db.prepare(`
      SELECT a.*,
             e.name AS employee_name, e.department, e.job_title,
             f.name AS facility_name
      FROM attendance_log a
      JOIN employees e ON a.employee_id = e.id
      LEFT JOIN facilities f ON e.facility_id = f.id
      WHERE a.id = ?
    `).get(req.params.id);

    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.json({ data: entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/attendance — create new entry
router.post('/', (req, res) => {
  const db = getDb();
  const {
    employee_id, date_of_occurrence, occurrence_type, description,
    accumulated_points, next_step,
    occurrence_code, time_of_request, description_type, facility_id
  } = req.body;

  if (!employee_id || !date_of_occurrence) {
    return res.status(400).json({ error: 'employee_id and date_of_occurrence are required' });
  }

  // Auto-calculate roll_off_date as 6 months from date_of_occurrence
  const occDate = new Date(date_of_occurrence);
  occDate.setMonth(occDate.getMonth() + 6);
  const roll_off_date = occDate.toISOString().split('T')[0];

  // Determine points: prefer occurrence_code lookup; fall back to accumulated_points for backward compat
  let points;
  if (occurrence_code) {
    points = getAttendancePoints(occurrence_code);
  } else if (accumulated_points !== undefined && accumulated_points !== null) {
    points = Number(accumulated_points) || 0;
  } else {
    points = 0;
  }

  // Calculate accumulated active points for this employee (using new `points` column when present, else legacy accumulated_points)
  const activePoints = db.prepare(`
    SELECT COALESCE(SUM(COALESCE(points, accumulated_points, 0)), 0) AS total
    FROM attendance_log
    WHERE employee_id = ? AND roll_off_date > date('now')
  `).get(employee_id);

  const newAccumulated = (activePoints.total || 0) + points;

  // Resolve facility_id: explicit body wins; else fall back to employee's facility
  let resolvedFacilityId = facility_id;
  if (!resolvedFacilityId) {
    const emp = db.prepare('SELECT facility_id FROM employees WHERE id = ?').get(employee_id);
    resolvedFacilityId = emp ? emp.facility_id : null;
  }

  try {
    const result = db.prepare(`
      INSERT INTO attendance_log (
        employee_id, date_of_occurrence, occurrence_type, description,
        accumulated_points, points, roll_off_date, next_step, created_by,
        occurrence_code, time_of_request, description_type, facility_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      employee_id, date_of_occurrence, occurrence_type || null, description || null,
      points, points, roll_off_date, next_step || null, req.user.id,
      occurrence_code || null, time_of_request || null, description_type || null, resolvedFacilityId || null
    );

    const entry = db.prepare('SELECT * FROM attendance_log WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ data: entry, accumulated_total: newAccumulated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/attendance/:id/acknowledge — employee acknowledgment
router.post('/:id/acknowledge', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM attendance_log WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  try {
    db.prepare(`
      UPDATE attendance_log
      SET acknowledged_by_employee = 1, acknowledged_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
    const updated = db.prepare('SELECT * FROM attendance_log WHERE id = ?').get(id);
    res.json({ data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/attendance/:id — update entry
router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM attendance_log WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { date_of_occurrence, occurrence_type, description, accumulated_points, roll_off_date, next_step } = req.body;

  try {
    db.prepare(`
      UPDATE attendance_log
      SET date_of_occurrence = ?, occurrence_type = ?, description = ?,
          accumulated_points = ?, roll_off_date = ?, next_step = ?
      WHERE id = ?
    `).run(
      date_of_occurrence || existing.date_of_occurrence,
      occurrence_type !== undefined ? occurrence_type : existing.occurrence_type,
      description !== undefined ? description : existing.description,
      accumulated_points !== undefined ? accumulated_points : existing.accumulated_points,
      roll_off_date || existing.roll_off_date,
      next_step !== undefined ? next_step : existing.next_step,
      id
    );

    const updated = db.prepare('SELECT * FROM attendance_log WHERE id = ?').get(id);
    res.json({ data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/attendance/:id — delete entry
router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM attendance_log WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  try {
    db.prepare('DELETE FROM attendance_log WHERE id = ?').run(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
