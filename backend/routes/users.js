const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/users - list all users (admin/hr only)
router.get('/', requireRole('admin', 'hr'), (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, name, email, role, department, created_at FROM users ORDER BY name ASC').all();
  res.json({ users });
});

// GET /api/users/managers - get managers list (for employee form)
router.get('/managers', (req, res) => {
  const db = getDb();
  const managers = db.prepare(`
    SELECT id, name, email, department FROM users WHERE role IN ('manager','admin','hr') ORDER BY name ASC
  `).all();
  res.json({ managers });
});

// POST /api/users - create user (admin only)
router.post('/', requireRole('admin'), (req, res) => {
  const db = getDb();
  const { name, email, password, role, department } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?)
    `).run(name, email, hash, role, department || null);

    const user = db.prepare('SELECT id, name, email, role, department FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ user });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
