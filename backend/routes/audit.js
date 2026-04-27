const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);
router.use(requireRole('admin', 'hr'));

// GET /api/audit — list audit log entries with filters
router.get('/', (req, res) => {
  const db = getDb();
  const { entity_type, entity_id, user_id, action, start_date, end_date, limit = 100 } = req.query;

  let query = `SELECT * FROM audit_log WHERE 1=1`;
  const params = [];

  if (entity_type) { query += ' AND entity_type = ?'; params.push(entity_type); }
  if (entity_id) { query += ' AND entity_id = ?'; params.push(entity_id); }
  if (user_id) { query += ' AND user_id = ?'; params.push(user_id); }
  if (action) { query += ' AND action = ?'; params.push(action); }
  if (start_date) { query += ' AND created_at >= ?'; params.push(start_date); }
  if (end_date) { query += ' AND created_at <= ?'; params.push(end_date + ' 23:59:59'); }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(Number(limit));

  try {
    const rows = db.prepare(query).all(...params);
    rows.forEach(r => {
      if (r.details) {
        try { r.details = JSON.parse(r.details); } catch (_) {}
      }
    });
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/audit/entity/:type/:id — full audit history for one entity
router.get('/entity/:type/:id', (req, res) => {
  const db = getDb();
  try {
    const rows = db.prepare(`
      SELECT * FROM audit_log
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC
    `).all(req.params.type, req.params.id);
    rows.forEach(r => {
      if (r.details) {
        try { r.details = JSON.parse(r.details); } catch (_) {}
      }
    });
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
