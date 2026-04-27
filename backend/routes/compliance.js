const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/compliance — list all, with ?employee_id filter
router.get('/', (req, res) => {
  const db = getDb();
  const { employee_id } = req.query;
  let query = `
    SELECT c.*, e.name AS employee_name
    FROM compliance_records c
    JOIN employees e ON c.employee_id = e.id
    WHERE 1=1
  `;
  const params = [];
  if (employee_id) {
    query += ' AND c.employee_id = ?';
    params.push(employee_id);
  }
  query += ' ORDER BY c.created_at DESC';
  try {
    const rows = db.prepare(query).all(...params);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/compliance — create
router.post('/', (req, res) => {
  const db = getDb();
  const { employee_id, requirement_type, expiration_date, renewed_date, notes } = req.body;
  if (!employee_id || !requirement_type) {
    return res.status(400).json({ error: 'employee_id and requirement_type required' });
  }

  // Calculate renewed_within_deadline
  let withinDeadline = null;
  if (expiration_date && renewed_date) {
    const exp = new Date(expiration_date);
    const ren = new Date(renewed_date);
    const cutoff = new Date(exp);
    cutoff.setDate(cutoff.getDate() + 5);
    withinDeadline = ren <= cutoff ? 1 : 0;
  }

  try {
    const result = db.prepare(`
      INSERT INTO compliance_records (employee_id, requirement_type, expiration_date, renewed_date, renewed_within_deadline, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(employee_id, requirement_type, expiration_date || null, renewed_date || null, withinDeadline, notes || null);

    const row = db.prepare('SELECT * FROM compliance_records WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ data: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/compliance/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM compliance_records WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { requirement_type, expiration_date, renewed_date, notes } = req.body;

  let withinDeadline = existing.renewed_within_deadline;
  if (expiration_date && renewed_date) {
    const exp = new Date(expiration_date);
    const ren = new Date(renewed_date);
    const cutoff = new Date(exp);
    cutoff.setDate(cutoff.getDate() + 5);
    withinDeadline = ren <= cutoff ? 1 : 0;
  }

  try {
    db.prepare(`
      UPDATE compliance_records
      SET requirement_type = ?, expiration_date = ?, renewed_date = ?, renewed_within_deadline = ?, notes = ?
      WHERE id = ?
    `).run(
      requirement_type || existing.requirement_type,
      expiration_date !== undefined ? expiration_date : existing.expiration_date,
      renewed_date !== undefined ? renewed_date : existing.renewed_date,
      withinDeadline,
      notes !== undefined ? notes : existing.notes,
      id
    );
    const updated = db.prepare('SELECT * FROM compliance_records WHERE id = ?').get(id);
    res.json({ data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/compliance/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM compliance_records WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  try {
    db.prepare('DELETE FROM compliance_records WHERE id = ?').run(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
