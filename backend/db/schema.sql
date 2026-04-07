-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','hr','manager','employee')),
  department TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  hire_date DATE NOT NULL,
  department TEXT NOT NULL,
  job_title TEXT NOT NULL,
  tech_level TEXT CHECK(tech_level IN ('Tech 1','Tech 3','Tech 4','QA Tech')),
  manager_id INTEGER REFERENCES users(id),
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Evaluations table
CREATE TABLE IF NOT EXISTS evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  evaluator_id INTEGER NOT NULL REFERENCES users(id),
  evaluation_type TEXT NOT NULL CHECK(evaluation_type IN ('Annual','Mid-Year','90-Day','PIP Follow-up','Tech Review','Self-Evaluation')),
  evaluation_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Submitted','Acknowledged')),
  total_score INTEGER DEFAULT 0,
  max_score INTEGER DEFAULT 227,
  passing_score INTEGER DEFAULT 211,
  passed INTEGER,
  supervisor_comments TEXT,
  employee_comments TEXT,
  acknowledged_by TEXT,
  acknowledged_at DATETIME,
  next_eval_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Eval sections
CREATE TABLE IF NOT EXISTS eval_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_id INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  section_name TEXT NOT NULL,
  section_score INTEGER DEFAULT 0,
  section_max INTEGER NOT NULL,
  notes TEXT
);

-- Eval items
CREATE TABLE IF NOT EXISTS eval_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES eval_sections(id) ON DELETE CASCADE,
  item_label TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  max_score INTEGER NOT NULL,
  evaluator_note TEXT
);

-- PIP Plans
CREATE TABLE IF NOT EXISTS pip_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_id INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  action_plan TEXT,
  goals TEXT,
  expectations TEXT,
  timeline TEXT,
  next_pip_date DATE,
  status TEXT DEFAULT 'Active' CHECK(status IN ('Active','Completed','Extended')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Facilities (client sites)
CREATE TABLE IF NOT EXISTS facilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Attendance Log
CREATE TABLE IF NOT EXISTS attendance_log (
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
);

-- Disciplinary Action
CREATE TABLE IF NOT EXISTS disciplinary_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  date_of_incident DATE NOT NULL,
  issue TEXT,
  details TEXT,
  accumulated_points INTEGER DEFAULT 0,
  issuance_date DATE,
  monitoring_period TEXT DEFAULT '30 Days',
  type TEXT DEFAULT 'New' CHECK(type IN ('New','Extension')),
  status TEXT DEFAULT 'Incomplete' CHECK(status IN ('Complete - Met Expectations','Incomplete')),
  roll_off_date DATE,
  next_step TEXT,
  notification_sent INTEGER DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- QA Log
CREATE TABLE IF NOT EXISTS qa_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  date_of_incident DATE NOT NULL,
  issue TEXT,
  description TEXT,
  accumulated_points INTEGER DEFAULT 0,
  roll_off_date DATE,
  status TEXT DEFAULT 'Incomplete' CHECK(status IN ('Complete - Met Expectations','Incomplete')),
  action_step TEXT,
  notification_sent INTEGER DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Eval templates
CREATE TABLE IF NOT EXISTS eval_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  department TEXT,
  sections_json TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
