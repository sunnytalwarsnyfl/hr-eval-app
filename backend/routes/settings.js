const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

// ─── DEPARTMENTS ─────────────────────────────────────────────────────────────

router.get('/departments', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM departments ORDER BY name ASC').all();
  res.json({ departments: rows });
});

router.post('/departments', requireRole('admin', 'hr'), (req, res) => {
  const db = getDb();
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const result = db.prepare(
      'INSERT INTO departments (name, description) VALUES (?, ?)'
    ).run(name.trim(), description || null);
    const row = db.prepare('SELECT * FROM departments WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ department: row });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Department already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/departments/:id', requireRole('admin', 'hr'), (req, res) => {
  const db = getDb();
  const { name, description, active } = req.body;
  const existing = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  try {
    db.prepare(
      'UPDATE departments SET name = ?, description = ?, active = ? WHERE id = ?'
    ).run(
      name || existing.name,
      description !== undefined ? description : existing.description,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      req.params.id
    );
    res.json({ department: db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id) });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Department name already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/departments/:id', requireRole('admin'), (req, res) => {
  const db = getDb();
  db.prepare('UPDATE departments SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Department deactivated' });
});

// ─── FACILITIES ───────────────────────────────────────────────────────────────

router.get('/facilities', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM facilities ORDER BY name ASC').all();
  res.json({ facilities: rows });
});

router.post('/facilities', requireRole('admin', 'hr'), (req, res) => {
  const db = getDb();
  const { name, address, city, state, contact_name, contact_email, contact_phone } = req.body;
  if (!name) return res.status(400).json({ error: 'Facility name is required' });
  try {
    const result = db.prepare(`
      INSERT INTO facilities (name, address, city, state, contact_name, contact_email, contact_phone)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name.trim(), address || null, city || null, state || null,
           contact_name || null, contact_email || null, contact_phone || null);
    const row = db.prepare('SELECT * FROM facilities WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ facility: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/facilities/:id', requireRole('admin', 'hr'), (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM facilities WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { name, address, city, state, contact_name, contact_email, contact_phone, active } = req.body;
  try {
    db.prepare(`
      UPDATE facilities SET name = ?, address = ?, city = ?, state = ?,
        contact_name = ?, contact_email = ?, contact_phone = ?, active = ?
      WHERE id = ?
    `).run(
      name || existing.name,
      address !== undefined ? address : existing.address,
      city !== undefined ? city : existing.city,
      state !== undefined ? state : existing.state,
      contact_name !== undefined ? contact_name : existing.contact_name,
      contact_email !== undefined ? contact_email : existing.contact_email,
      contact_phone !== undefined ? contact_phone : existing.contact_phone,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      req.params.id
    );
    res.json({ facility: db.prepare('SELECT * FROM facilities WHERE id = ?').get(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/facilities/:id', requireRole('admin'), (req, res) => {
  const db = getDb();
  db.prepare('UPDATE facilities SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Facility deactivated' });
});

// ─── USERS ────────────────────────────────────────────────────────────────────

router.get('/users', requireRole('admin', 'hr'), (req, res) => {
  const db = getDb();
  const users = db.prepare(
    'SELECT id, name, email, role, department, created_at FROM users ORDER BY name ASC'
  ).all();
  res.json({ users });
});

router.post('/users', requireRole('admin'), (req, res) => {
  const db = getDb();
  const { name, email, password, role, department } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password and role are required' });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?)'
    ).run(name, email, hash, role, department || null);
    const user = db.prepare('SELECT id, name, email, role, department FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ user });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id', requireRole('admin'), (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { name, email, role, department, password } = req.body;
  try {
    const hash = password ? bcrypt.hashSync(password, 10) : existing.password_hash;
    db.prepare(
      'UPDATE users SET name = ?, email = ?, role = ?, department = ?, password_hash = ? WHERE id = ?'
    ).run(
      name || existing.name,
      email || existing.email,
      role || existing.role,
      department !== undefined ? department : existing.department,
      hash,
      req.params.id
    );
    const updated = db.prepare('SELECT id, name, email, role, department FROM users WHERE id = ?').get(req.params.id);
    res.json({ user: updated });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', requireRole('admin'), (req, res) => {
  const db = getDb();
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'User deleted' });
});

module.exports = router;
