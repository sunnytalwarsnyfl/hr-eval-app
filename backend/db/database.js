const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'hr_eval.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

function runMigrations(db) {
  // Migration: Add 'Tech Review' to evaluation_type CHECK constraint
  // SQLite doesn't support ALTER CHECK, so we recreate the table if needed
  try {
    // Test if 'Tech Review' is already allowed
    const testStmt = db.prepare("SELECT 1 WHERE 'Tech Review' IN ('Annual','Mid-Year','90-Day','PIP Follow-up','Tech Review')");
    testStmt.get();

    // Check if we can insert a Tech Review type (the CHECK constraint would block it)
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='evaluations'").get();
    if (tableInfo && tableInfo.sql && !tableInfo.sql.includes('Tech Review')) {
      db.pragma('foreign_keys = OFF');
      db.exec('BEGIN TRANSACTION');
      db.exec(`CREATE TABLE evaluations_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL REFERENCES employees(id),
        evaluator_id INTEGER NOT NULL REFERENCES users(id),
        evaluation_type TEXT NOT NULL CHECK(evaluation_type IN ('Annual','Mid-Year','90-Day','PIP Follow-up','Tech Review')),
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
      )`);
      db.exec('INSERT INTO evaluations_new SELECT * FROM evaluations');
      db.exec('DROP TABLE evaluations');
      db.exec('ALTER TABLE evaluations_new RENAME TO evaluations');
      db.exec('COMMIT');
      db.pragma('foreign_keys = ON');
    }
  } catch (e) {
    // Migration already applied or not needed
    try { db.exec('ROLLBACK'); } catch (_) {}
    db.pragma('foreign_keys = ON');
  }
}

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    // Initialize schema
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schema);
    // Run migrations
    runMigrations(db);
  }
  return db;
}

module.exports = { getDb };
