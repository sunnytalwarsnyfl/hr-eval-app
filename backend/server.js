const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

// Auto-seed on first deploy if DB is fresh
const { getDb } = require('./db/database');
const dbPath = process.env.DB_PATH || path.join(__dirname, 'db', 'hr_eval.db');
const isNewDb = !fs.existsSync(dbPath) || fs.statSync(dbPath).size < 1024;
if (isNewDb) {
  try { require('./db/seed'); console.log('Database seeded.'); } catch(e) { console.error('Seed error:', e.message); }
}

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// In dev allow Vite dev server; in prod same-origin so no CORS needed
if (!isProd) {
  app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'], credentials: true }));
}
app.use(express.json());
app.use(cookieParser());

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/evaluations', require('./routes/evaluations'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/pip', require('./routes/pip'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/disciplinary', require('./routes/disciplinary'));
app.use('/api/qa-log', require('./routes/qa-log'));

// Runtime migrations
try {
  const db = getDb();

  // pip_plans.status
  const pipCols = db.prepare("PRAGMA table_info(pip_plans)").all();
  if (!pipCols.find(c => c.name === 'status')) {
    db.exec(`ALTER TABLE pip_plans ADD COLUMN status TEXT DEFAULT 'Active'`);
    console.log('Migration: added status to pip_plans');
  }

  // employees.facility_id
  const empCols = db.prepare("PRAGMA table_info(employees)").all();
  if (!empCols.find(c => c.name === 'facility_id')) {
    db.exec(`ALTER TABLE employees ADD COLUMN facility_id INTEGER REFERENCES facilities(id)`);
    console.log('Migration: added facility_id to employees');
  }

  // Seed default departments if table is empty
  const deptCount = db.prepare('SELECT COUNT(*) as c FROM departments').get();
  if (deptCount.c === 0) {
    const defaults = ['Sterile Processing', 'IT', 'QA', 'Administration', 'Other'];
    const ins = db.prepare('INSERT OR IGNORE INTO departments (name) VALUES (?)');
    defaults.forEach(n => ins.run(n));
    console.log('Migration: seeded default departments');
  }

  // employees new columns
  const empCols2 = db.prepare("PRAGMA table_info(employees)").all();
  if (!empCols2.find(c => c.name === 'phone')) {
    db.exec(`ALTER TABLE employees ADD COLUMN phone TEXT`);
    db.exec(`ALTER TABLE employees ADD COLUMN employment_type TEXT DEFAULT 'Permanent'`);
    db.exec(`ALTER TABLE employees ADD COLUMN is_leadership INTEGER DEFAULT 0`);
    db.exec(`ALTER TABLE employees ADD COLUMN is_evaluator INTEGER DEFAULT 0`);
    db.exec(`ALTER TABLE employees ADD COLUMN belt_level TEXT`);
    console.log('Migration: added new employee columns');
  }

  // Create attendance_log table if not exists
  db.exec(`CREATE TABLE IF NOT EXISTS attendance_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    date_of_occurrence DATE NOT NULL,
    occurrence_type TEXT,
    description TEXT,
    accumulated_points INTEGER DEFAULT 0,
    roll_off_date DATE,
    next_step TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create disciplinary_actions table if not exists
  db.exec(`CREATE TABLE IF NOT EXISTS disciplinary_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    date_of_incident DATE NOT NULL,
    issue TEXT,
    details TEXT,
    accumulated_points INTEGER DEFAULT 0,
    issuance_date DATE,
    monitoring_period TEXT DEFAULT '30 Days',
    type TEXT DEFAULT 'New',
    status TEXT DEFAULT 'Incomplete',
    roll_off_date DATE,
    next_step TEXT,
    notification_sent INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create qa_log table if not exists
  db.exec(`CREATE TABLE IF NOT EXISTS qa_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    date_of_incident DATE NOT NULL,
    issue TEXT,
    description TEXT,
    accumulated_points INTEGER DEFAULT 0,
    roll_off_date DATE,
    status TEXT DEFAULT 'Incomplete',
    action_step TEXT,
    notification_sent INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
} catch(e) { console.error('Migration error:', e.message); }

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve React build in production
if (isProd) {
  const publicDir = path.join(__dirname, 'public');
  app.use(express.static(publicDir));
  // All non-API routes → React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
