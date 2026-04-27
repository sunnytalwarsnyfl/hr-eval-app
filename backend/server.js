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
app.use('/api/admin', require('./routes/admin'));
app.use('/api/compliance', require('./routes/compliance'));
app.use('/api/audit', require('./routes/audit'));

// Static serve uploaded files (auth-protected)
const { UPLOAD_DIR } = require('./middleware/upload');
const { authenticateToken } = require('./middleware/auth');
app.use('/api/uploads', authenticateToken, express.static(UPLOAD_DIR));

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

  // departments.facility_id
  const deptCols = db.prepare("PRAGMA table_info(departments)").all();
  if (!deptCols.find(c => c.name === 'facility_id')) {
    db.exec(`ALTER TABLE departments ADD COLUMN facility_id INTEGER REFERENCES facilities(id)`);
    console.log('Migration: added facility_id to departments');
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

  // employees: anniversary_date, work_email, phone_number columns
  const empCols3 = db.prepare("PRAGMA table_info(employees)").all();
  if (!empCols3.find(c => c.name === 'anniversary_date')) {
    db.exec(`ALTER TABLE employees ADD COLUMN anniversary_date DATE`);
    db.exec(`ALTER TABLE employees ADD COLUMN work_email TEXT`);
    db.exec(`ALTER TABLE employees ADD COLUMN phone_number TEXT`);
    db.exec(`UPDATE employees SET work_email = email, anniversary_date = hire_date, phone_number = phone WHERE work_email IS NULL`);
    console.log('Migration: added employee anniversary_date, work_email, phone_number');
  }

  // Drop legacy email/tech_level columns from employees and add CHECK constraints
  const empTableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='employees'").get()?.sql || '';
  const needsEmpRebuild = empTableSql.includes('email TEXT UNIQUE NOT NULL') || empTableSql.includes('tech_level') || !empTableSql.includes("CHECK(employment_type IN");
  if (needsEmpRebuild) {
    try {
      db.pragma('foreign_keys = OFF');
      db.exec('BEGIN TRANSACTION');
      db.exec(`CREATE TABLE employees_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        hire_date DATE NOT NULL,
        department TEXT NOT NULL,
        job_title TEXT NOT NULL,
        manager_id INTEGER REFERENCES users(id),
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        facility_id INTEGER REFERENCES facilities(id),
        phone TEXT,
        employment_type TEXT DEFAULT 'Permanent' CHECK(employment_type IN ('Permanent','Temporary')),
        is_leadership INTEGER DEFAULT 0,
        is_evaluator INTEGER DEFAULT 0,
        belt_level TEXT CHECK(belt_level IS NULL OR belt_level IN ('White','Yellow','Green','Blue','Brown','Black')),
        anniversary_date DATE,
        work_email TEXT,
        phone_number TEXT
      )`);
      // Backfill: prefer work_email over email; prefer belt_level over tech_level mapping; keep all data
      const existingCols = db.prepare("PRAGMA table_info(employees)").all().map(c => c.name);
      const cols = ['id','name','hire_date','department','job_title','manager_id','active','created_at'];
      const optionalCols = ['facility_id','phone','employment_type','is_leadership','is_evaluator','belt_level','anniversary_date','work_email','phone_number'];
      optionalCols.forEach(c => { if (existingCols.includes(c)) cols.push(c); });

      const selectCols = cols.map(c => {
        if (c === 'work_email' && existingCols.includes('email')) {
          return `COALESCE(work_email, email) AS work_email`;
        }
        if (c === 'belt_level' && existingCols.includes('tech_level')) {
          return `COALESCE(belt_level, CASE tech_level WHEN 'Tech 1' THEN 'White' WHEN 'Tech 3' THEN 'Yellow' WHEN 'Tech 4' THEN 'Green' WHEN 'QA Tech' THEN 'Blue' ELSE NULL END) AS belt_level`;
        }
        if (c === 'employment_type') {
          return `COALESCE(employment_type, 'Permanent') AS employment_type`;
        }
        return c;
      });
      db.exec(`INSERT INTO employees_new (${cols.join(',')}) SELECT ${selectCols.join(',')} FROM employees`);
      db.exec('DROP TABLE employees');
      db.exec('ALTER TABLE employees_new RENAME TO employees');
      db.exec('COMMIT');
      db.pragma('foreign_keys = ON');
      console.log('Migration: rebuilt employees table — dropped legacy email/tech_level, added CHECK constraints');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch (_) {}
      db.pragma('foreign_keys = ON');
      console.error('Employees rebuild error:', e.message);
    }
  }

  // users: invite_token, invite_expires_at, invite_used, employee_id, last_login
  const userCols = db.prepare("PRAGMA table_info(users)").all();
  if (!userCols.find(c => c.name === 'invite_token')) {
    db.exec(`ALTER TABLE users ADD COLUMN invite_token TEXT`);
    db.exec(`ALTER TABLE users ADD COLUMN invite_expires_at DATETIME`);
    db.exec(`ALTER TABLE users ADD COLUMN invite_used INTEGER DEFAULT 0`);
    db.exec(`ALTER TABLE users ADD COLUMN employee_id INTEGER REFERENCES employees(id)`);
    db.exec(`ALTER TABLE users ADD COLUMN last_login DATETIME`);
    console.log('Migration: added user invite/employee link columns');
  }

  // attendance_log new columns
  const attCols = db.prepare("PRAGMA table_info(attendance_log)").all();
  if (!attCols.find(c => c.name === 'occurrence_code')) {
    db.exec(`ALTER TABLE attendance_log ADD COLUMN facility_id INTEGER REFERENCES facilities(id)`);
    db.exec(`ALTER TABLE attendance_log ADD COLUMN time_of_request TEXT`);
    db.exec(`ALTER TABLE attendance_log ADD COLUMN occurrence_code TEXT`);
    db.exec(`ALTER TABLE attendance_log ADD COLUMN description_type TEXT`);
    db.exec(`ALTER TABLE attendance_log ADD COLUMN points REAL DEFAULT 0`);
    db.exec(`ALTER TABLE attendance_log ADD COLUMN acknowledged_by_employee INTEGER DEFAULT 0`);
    db.exec(`ALTER TABLE attendance_log ADD COLUMN acknowledged_at DATETIME`);
    db.exec(`ALTER TABLE attendance_log ADD COLUMN auto_notify_sent INTEGER DEFAULT 0`);
    console.log('Migration: added attendance occurrence_code columns');
  }

  // qa_log new columns
  const qaCols = db.prepare("PRAGMA table_info(qa_log)").all();
  if (!qaCols.find(c => c.name === 'issue_type')) {
    db.exec(`ALTER TABLE qa_log ADD COLUMN facility_id INTEGER REFERENCES facilities(id)`);
    db.exec(`ALTER TABLE qa_log ADD COLUMN issue_type TEXT`);
    db.exec(`ALTER TABLE qa_log ADD COLUMN issue_points REAL DEFAULT 0`);
    db.exec(`ALTER TABLE qa_log ADD COLUMN attachment_path TEXT`);
    db.exec(`ALTER TABLE qa_log ADD COLUMN employee_initials TEXT`);
    db.exec(`ALTER TABLE qa_log ADD COLUMN manager_initials TEXT`);
    db.exec(`ALTER TABLE qa_log ADD COLUMN action_taken TEXT`);
    db.exec(`ALTER TABLE qa_log ADD COLUMN disciplinary_triggered INTEGER DEFAULT 0`);
    console.log('Migration: added qa_log issue_type columns');
  }

  // disciplinary_actions new columns (for full write-up workflow)
  const discCols = db.prepare("PRAGMA table_info(disciplinary_actions)").all();
  if (!discCols.find(c => c.name === 'action_level')) {
    db.exec(`ALTER TABLE disciplinary_actions ADD COLUMN facility_id INTEGER REFERENCES facilities(id)`);
    db.exec(`ALTER TABLE disciplinary_actions ADD COLUMN initiated_by INTEGER REFERENCES users(id)`);
    db.exec(`ALTER TABLE disciplinary_actions ADD COLUMN violation_types TEXT`);
    db.exec(`ALTER TABLE disciplinary_actions ADD COLUMN action_level TEXT`);
    db.exec(`ALTER TABLE disciplinary_actions ADD COLUMN improvement_plan TEXT`);
    db.exec(`ALTER TABLE disciplinary_actions ADD COLUMN consequence_if_continued TEXT`);
    db.exec(`ALTER TABLE disciplinary_actions ADD COLUMN consequence_type TEXT`);
    db.exec(`ALTER TABLE disciplinary_actions ADD COLUMN suspension_days INTEGER`);
    db.exec(`ALTER TABLE disciplinary_actions ADD COLUMN policy_attached INTEGER DEFAULT 0`);
    db.exec(`ALTER TABLE disciplinary_actions ADD COLUMN attachment_path TEXT`);
    db.exec(`ALTER TABLE disciplinary_actions ADD COLUMN employee_statement TEXT`);
    db.exec(`ALTER TABLE disciplinary_actions ADD COLUMN employee_signature TEXT`);
    db.exec(`ALTER TABLE disciplinary_actions ADD COLUMN employee_signed_at DATETIME`);
    db.exec(`ALTER TABLE disciplinary_actions ADD COLUMN manager_signature TEXT`);
    db.exec(`ALTER TABLE disciplinary_actions ADD COLUMN manager_signed_at DATETIME`);
    db.exec(`ALTER TABLE disciplinary_actions ADD COLUMN hr_approved_by INTEGER REFERENCES users(id)`);
    db.exec(`ALTER TABLE disciplinary_actions ADD COLUMN hr_approved_at DATETIME`);
    db.exec(`ALTER TABLE disciplinary_actions ADD COLUMN employee_notified_at DATETIME`);
    db.exec(`ALTER TABLE disciplinary_actions ADD COLUMN acknowledged_at DATETIME`);
    console.log('Migration: added disciplinary_actions write-up columns');
  }

  if (!discCols.find(c => c.name === 'employee_sign_token')) {
    db.exec(`ALTER TABLE disciplinary_actions ADD COLUMN employee_sign_token TEXT`);
  }

  // Fix disciplinary_actions status CHECK constraint
  const discTableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='disciplinary_actions'").get()?.sql || '';
  const needsDiscRebuild = discTableSql.includes("CHECK(status IN ('Complete - Met Expectations','Incomplete'))");
  if (needsDiscRebuild) {
    try {
      db.pragma('foreign_keys = OFF');
      db.exec('BEGIN TRANSACTION');

      // Get existing columns
      const existingCols = db.prepare("PRAGMA table_info(disciplinary_actions)").all().map(c => c.name);

      // Build new table — superset of existing schema with relaxed status CHECK
      db.exec(`CREATE TABLE disciplinary_actions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL REFERENCES employees(id),
        date_of_incident DATE NOT NULL,
        issue TEXT,
        details TEXT,
        accumulated_points INTEGER DEFAULT 0,
        issuance_date DATE,
        monitoring_period TEXT DEFAULT '30 Days',
        type TEXT DEFAULT 'New',
        status TEXT DEFAULT 'Pending HR Review',
        roll_off_date DATE,
        next_step TEXT,
        notification_sent INTEGER DEFAULT 0,
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        facility_id INTEGER REFERENCES facilities(id),
        initiated_by INTEGER REFERENCES users(id),
        violation_types TEXT,
        action_level TEXT,
        improvement_plan TEXT,
        consequence_if_continued TEXT,
        consequence_type TEXT,
        suspension_days INTEGER,
        policy_attached INTEGER DEFAULT 0,
        attachment_path TEXT,
        employee_statement TEXT,
        employee_signature TEXT,
        employee_signed_at DATETIME,
        manager_signature TEXT,
        manager_signed_at DATETIME,
        hr_approved_by INTEGER REFERENCES users(id),
        hr_approved_at DATETIME,
        employee_notified_at DATETIME,
        acknowledged_at DATETIME,
        employee_sign_token TEXT
      )`);

      // Copy only columns that exist in the old table
      const newCols = db.prepare("PRAGMA table_info(disciplinary_actions_new)").all().map(c => c.name);
      const commonCols = newCols.filter(c => existingCols.includes(c));
      db.exec(`INSERT INTO disciplinary_actions_new (${commonCols.join(',')}) SELECT ${commonCols.join(',')} FROM disciplinary_actions`);
      db.exec('DROP TABLE disciplinary_actions');
      db.exec('ALTER TABLE disciplinary_actions_new RENAME TO disciplinary_actions');
      db.exec('COMMIT');
      db.pragma('foreign_keys = ON');
      console.log('Migration: rebuilt disciplinary_actions — relaxed status CHECK to allow Pending HR Review/Approved/Active/Extended');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch (_) {}
      db.pragma('foreign_keys = ON');
      console.error('Disciplinary rebuild error:', e.message);
    }
  }

  // pip_plans new columns
  const pipCols2 = db.prepare("PRAGMA table_info(pip_plans)").all();
  if (!pipCols2.find(c => c.name === 'monitoring_period')) {
    db.exec(`ALTER TABLE pip_plans ADD COLUMN facility_id INTEGER REFERENCES facilities(id)`);
    db.exec(`ALTER TABLE pip_plans ADD COLUMN monitoring_period TEXT DEFAULT '30 Days'`);
    db.exec(`ALTER TABLE pip_plans ADD COLUMN type TEXT DEFAULT 'New'`);
    db.exec(`ALTER TABLE pip_plans ADD COLUMN hr_reviewed_at DATETIME`);
    db.exec(`ALTER TABLE pip_plans ADD COLUMN notification_sent INTEGER DEFAULT 0`);
    console.log('Migration: added pip_plans columns');
  }

  // Migrate pip_plans status to allow new values
  const pipPlansInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='pip_plans'").get();
  if (pipPlansInfo && pipPlansInfo.sql && pipPlansInfo.sql.includes("CHECK(status IN")) {
    try {
      db.pragma('foreign_keys = OFF');
      db.exec('BEGIN TRANSACTION');
      db.exec(`CREATE TABLE pip_plans_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        evaluation_id INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
        action_plan TEXT,
        goals TEXT,
        expectations TEXT,
        timeline TEXT,
        next_pip_date DATE,
        status TEXT DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        facility_id INTEGER REFERENCES facilities(id),
        monitoring_period TEXT DEFAULT '30 Days',
        type TEXT DEFAULT 'New',
        hr_reviewed_at DATETIME,
        notification_sent INTEGER DEFAULT 0
      )`);
      // Copy only columns that exist in old table
      const oldCols = db.prepare("PRAGMA table_info(pip_plans)").all().map(c => c.name);
      const commonCols = ['id','evaluation_id','action_plan','goals','expectations','timeline','next_pip_date','status','created_at']
        .concat(oldCols.includes('facility_id') ? ['facility_id'] : [])
        .concat(oldCols.includes('monitoring_period') ? ['monitoring_period'] : [])
        .concat(oldCols.includes('type') ? ['type'] : [])
        .concat(oldCols.includes('hr_reviewed_at') ? ['hr_reviewed_at'] : [])
        .concat(oldCols.includes('notification_sent') ? ['notification_sent'] : []);
      db.exec(`INSERT INTO pip_plans_new (${commonCols.join(',')}) SELECT ${commonCols.join(',')} FROM pip_plans`);
      db.exec('DROP TABLE pip_plans');
      db.exec('ALTER TABLE pip_plans_new RENAME TO pip_plans');
      db.exec('COMMIT');
      db.pragma('foreign_keys = ON');
      console.log('Migration: removed pip_plans status CHECK to allow new values');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch (_) {}
      db.pragma('foreign_keys = ON');
      console.error('PIP migration error:', e.message);
    }
  }

  // evaluations new columns
  const evalCols = db.prepare("PRAGMA table_info(evaluations)").all();
  if (!evalCols.find(c => c.name === 'evaluation_subtype')) {
    db.exec(`ALTER TABLE evaluations ADD COLUMN evaluation_subtype TEXT`);
    db.exec(`ALTER TABLE evaluations ADD COLUMN initiated_by INTEGER REFERENCES users(id)`);
    db.exec(`ALTER TABLE evaluations ADD COLUMN self_eval_submitted_at DATETIME`);
    db.exec(`ALTER TABLE evaluations ADD COLUMN hr_reviewed_at DATETIME`);
    db.exec(`ALTER TABLE evaluations ADD COLUMN hr_reviewed_by INTEGER REFERENCES users(id)`);
    db.exec(`ALTER TABLE evaluations ADD COLUMN attendance_occurrences INTEGER`);
    db.exec(`ALTER TABLE evaluations ADD COLUMN disciplinary_count INTEGER`);
    db.exec(`ALTER TABLE evaluations ADD COLUMN compliance_status TEXT`);
    db.exec(`ALTER TABLE evaluations ADD COLUMN belt_level_at_eval TEXT`);
    db.exec(`ALTER TABLE evaluations ADD COLUMN overall_score REAL`);
    db.exec(`ALTER TABLE evaluations ADD COLUMN pay_increase_rate REAL`);
    db.exec(`ALTER TABLE evaluations ADD COLUMN bonus_percentage REAL`);
    console.log('Migration: added evaluations workflow columns');
  }

  // New tables: tech_review_scores, compliance_records, eval_notifications
  db.exec(`CREATE TABLE IF NOT EXISTS tech_review_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evaluation_id INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    section TEXT NOT NULL,
    item_label TEXT NOT NULL,
    score TEXT,
    score_value REAL,
    points_possible REAL DEFAULT 1.0
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS compliance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    requirement_type TEXT NOT NULL,
    expiration_date DATE,
    renewed_date DATE,
    renewed_within_deadline INTEGER,
    points_value REAL DEFAULT 2.0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS eval_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    evaluation_id INTEGER REFERENCES evaluations(id),
    notification_type TEXT NOT NULL,
    sent_to_role TEXT,
    sent_to_email TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    opened INTEGER DEFAULT 0,
    reminder_sent_manually INTEGER DEFAULT 0,
    sent_by INTEGER REFERENCES users(id)
  )`);
  console.log('Migration: ensured tech_review_scores, compliance_records, eval_notifications tables');

  // Audit log table
  db.exec(`CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    user_name TEXT,
    user_role TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at)`);
  console.log('Migration: ensured audit_log table');
} catch(e) { console.error('Migration error:', e.message); }

// Start scheduled jobs
try {
  const { startJobs } = require('./jobs/scheduler');
  startJobs(getDb());
} catch (e) {
  console.error('Scheduler start error:', e.message);
}

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
