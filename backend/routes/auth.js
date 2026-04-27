const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const { sendEmail } = require('../utils/mailer');

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

// =====================================================================
// Self-eval invite endpoints (public — no authentication)
// =====================================================================

// GET /api/auth/invite/:token — validate invite token
router.get('/invite/:token', (req, res) => {
  const db = getDb();
  const { token } = req.params;
  try {
    const user = db.prepare(`
      SELECT u.id, u.name, u.email, u.employee_id, u.invite_expires_at, u.invite_used,
             e.name AS employee_name, e.department, e.job_title
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE u.invite_token = ?
    `).get(token);

    if (!user) {
      return res.json({ valid: false, error: 'Invite not found' });
    }
    if (user.invite_used) {
      return res.json({ valid: false, error: 'Invite already used' });
    }
    if (user.invite_expires_at) {
      const expires = new Date(user.invite_expires_at);
      if (expires < new Date()) {
        return res.json({ valid: false, error: 'Invite expired or already used' });
      }
    }

    res.json({
      valid: true,
      employee_name: user.employee_name || user.name,
      employee_id: user.employee_id,
      department: user.department,
      job_title: user.job_title
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/invite/accept — submit self-eval
router.post('/invite/accept', (req, res) => {
  const db = getDb();
  const { token, sections, comments, career_interest, career_interest_detail, concerns } = req.body;

  if (!token) return res.status(400).json({ error: 'token required' });

  try {
    const user = db.prepare('SELECT * FROM users WHERE invite_token = ?').get(token);
    if (!user) return res.status(404).json({ valid: false, error: 'Invite not found' });
    if (user.invite_used) return res.status(400).json({ valid: false, error: 'Invite already used' });
    if (user.invite_expires_at && new Date(user.invite_expires_at) < new Date()) {
      return res.status(400).json({ valid: false, error: 'Invite expired' });
    }

    const employee = user.employee_id
      ? db.prepare('SELECT * FROM employees WHERE id = ?').get(user.employee_id)
      : null;

    if (!employee) {
      return res.status(400).json({ error: 'No employee linked to this invite' });
    }

    // Compute scores from sections if available
    let totalScore = 0;
    let maxScore = 0;
    if (Array.isArray(sections)) {
      sections.forEach(sec => {
        (sec.items || []).forEach(it => {
          const s = Number(it.score) || 0;
          totalScore += s;
          maxScore += 3; // each item scored 0-3
        });
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    // Create evaluation row
    const evalCols = db.prepare("PRAGMA table_info(evaluations)").all().map(c => c.name);
    const insertCols = ['employee_id', 'evaluator_id', 'evaluation_date', 'evaluation_type', 'total_score', 'max_score', 'status'];
    const insertVals = [employee.id, user.id, today, 'Self-Evaluation', totalScore, maxScore, 'Submitted'];

    if (evalCols.includes('evaluation_subtype')) { insertCols.push('evaluation_subtype'); insertVals.push('self_eval'); }
    if (evalCols.includes('initiated_by')) { insertCols.push('initiated_by'); insertVals.push(user.id); }
    if (evalCols.includes('self_eval_submitted_at')) { insertCols.push('self_eval_submitted_at'); insertVals.push(nowIso); }
    if (evalCols.includes('comments')) { insertCols.push('comments'); insertVals.push(comments || null); }

    const placeholders = insertCols.map(() => '?').join(',');
    const result = db.prepare(
      `INSERT INTO evaluations (${insertCols.join(',')}) VALUES (${placeholders})`
    ).run(...insertVals);

    const evaluationId = result.lastInsertRowid;

    // Insert items into tech_review_scores if table exists
    try {
      const stmt = db.prepare(`
        INSERT INTO tech_review_scores (evaluation_id, section, item_label, score, score_value, points_possible)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      if (Array.isArray(sections)) {
        sections.forEach(sec => {
          (sec.items || []).forEach(it => {
            stmt.run(
              evaluationId,
              sec.title || sec.name || '',
              it.label || it.name || '',
              String(it.score ?? ''),
              Number(it.score) || 0,
              3
            );
          });
        });
      }
    } catch (e) {
      console.error('Section insert error:', e.message);
    }

    // Store career interest / concerns into a notes field if available, else log
    const extraNotes = [
      concerns ? `Concerns: ${concerns}` : '',
      career_interest ? `Career Interest: ${career_interest}` : '',
      career_interest_detail ? `Career Detail: ${career_interest_detail}` : ''
    ].filter(Boolean).join('\n');

    if (extraNotes) {
      try {
        if (evalCols.includes('comments')) {
          const cur = db.prepare('SELECT comments FROM evaluations WHERE id = ?').get(evaluationId);
          const newComments = [cur?.comments, extraNotes].filter(Boolean).join('\n\n');
          db.prepare('UPDATE evaluations SET comments = ? WHERE id = ?').run(newComments, evaluationId);
        }
      } catch (e) { /* ignore */ }
    }

    // Mark invite as used
    db.prepare('UPDATE users SET invite_used = 1 WHERE id = ?').run(user.id);

    // Notify HR + manager
    try {
      const subject = `Self-Evaluation Submitted - ${employee.name}`;
      const html = `<p><strong>${employee.name}</strong> has submitted a self-evaluation.</p>
                    <p>Department: ${employee.department || ''}</p>
                    <p>Date: ${today}</p>
                    <p>Score: ${totalScore} / ${maxScore}</p>`;

      sendEmail({ to: 'HR@sipsconsults.com', subject, html })
        .catch(err => console.error('Email error (HR):', err.message));

      if (employee.manager_id) {
        const manager = db.prepare('SELECT email, name FROM users WHERE id = ?').get(employee.manager_id);
        if (manager?.email) {
          sendEmail({ to: manager.email, subject, html })
            .catch(err => console.error('Email error (manager):', err.message));
        }
      }
    } catch (e) { /* ignore */ }

    res.json({ evaluation_id: evaluationId, success: true });
  } catch (err) {
    console.error('invite accept error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/invite/set-password — public, employee creates account post-self-eval
router.post('/invite/set-password', async (req, res) => {
  const db = getDb();
  const { token, password } = req.body;

  if (!token || !password || password.length < 8) {
    return res.status(400).json({ error: 'Token and password (min 8 chars) required' });
  }

  // Token must be marked as used (self-eval just submitted)
  const user = db.prepare(`
    SELECT * FROM users WHERE invite_token = ? AND invite_used = 1
  `).get(token);

  if (!user) return res.status(400).json({ error: 'Invalid or unused token' });

  try {
    const hash = await bcrypt.hash(password, 10);
    db.prepare(`
      UPDATE users SET password_hash = ?, invite_token = NULL, invite_expires_at = NULL
      WHERE id = ?
    `).run(hash, user.id);

    res.json({ success: true, message: 'Account created. You can now log in.' });
  } catch (err) {
    console.error('set-password error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
