const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, department: user.department },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000
  });

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department
    }
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, name, email, role, department FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

module.exports = router;
