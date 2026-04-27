const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getDb } = require('./database');

const db = getDb();

// Clear existing data (in dependency order)
try {
  db.exec(`
    DELETE FROM tech_review_scores;
    DELETE FROM compliance_records;
    DELETE FROM eval_notifications;
    DELETE FROM audit_log;
    DELETE FROM attendance_log;
    DELETE FROM disciplinary_actions;
    DELETE FROM qa_log;
    DELETE FROM pip_plans;
    DELETE FROM eval_items;
    DELETE FROM eval_sections;
    DELETE FROM evaluations;
    DELETE FROM employees;
    DELETE FROM departments;
    DELETE FROM facilities;
    DELETE FROM users;
  `);
} catch (e) {
  console.warn('Seed cleanup skipped (table may not exist):', e.message);
}

try {
  db.exec(`
    DELETE FROM sqlite_sequence
    WHERE name IN ('users','employees','evaluations','eval_sections','eval_items','pip_plans','facilities','departments','attendance_log','qa_log','disciplinary_actions');
  `);
} catch (_) {}

// ─── FACILITIES ──────────────────────────────────────────────────────────────
const insFacility = db.prepare(`
  INSERT INTO facilities (name, address, city, state, contact_name, contact_email, contact_phone, active)
  VALUES (?, ?, ?, ?, ?, ?, ?, 1)
`);
const dallasId = insFacility.run('Dallas Medical Center', '123 Main St', 'Dallas', 'TX', 'Site Lead', 'dallas@sipsconsults.com', '972-555-0100').lastInsertRowid;
const houstonId = insFacility.run('Houston Surgical Center', '456 Park Ave', 'Houston', 'TX', 'Site Lead', 'houston@sipsconsults.com', '713-555-0200').lastInsertRowid;

// ─── DEPARTMENTS ─────────────────────────────────────────────────────────────
const insDept = db.prepare(`INSERT INTO departments (name, description, facility_id, active) VALUES (?, ?, ?, 1)`);
insDept.run('Sterile Processing — Dallas', 'SPD operations', dallasId);
insDept.run('QA — Dallas', 'Quality assurance', dallasId);
insDept.run('Administration — Dallas', 'Site administration', dallasId);
insDept.run('Sterile Processing — Houston', 'SPD operations', houstonId);
insDept.run('QA — Houston', 'Quality assurance', houstonId);
insDept.run('Administration — Houston', 'Site administration', houstonId);

// ─── USERS ───────────────────────────────────────────────────────────────────
const adminHash = bcrypt.hashSync('admin123', 10);
const hrHash = bcrypt.hashSync('hr123', 10);
const managerHash = bcrypt.hashSync('manager123', 10);

const insUser = db.prepare(`
  INSERT INTO users (name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?)
`);

const adminId = insUser.run('System Admin', 'admin@sipsconsults.com', adminHash, 'admin', 'Administration').lastInsertRowid;
const hrId = insUser.run('HR Manager', 'hr@sipsconsults.com', hrHash, 'hr', 'Human Resources').lastInsertRowid;
const managerId = insUser.run('Operations Manager', 'manager@sipsconsults.com', managerHash, 'manager', 'Sterile Processing').lastInsertRowid;

console.log('Users created:', { adminId, hrId, managerId });

// ─── EMPLOYEES ───────────────────────────────────────────────────────────────
const insEmp = db.prepare(`
  INSERT INTO employees (name, work_email, hire_date, anniversary_date, department, job_title, manager_id, facility_id, belt_level, employment_type, is_leadership, is_evaluator, phone_number, active)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
`);

// 6 employees: 2 White, 2 Yellow, 2 Green. Two are leaders/evaluators.
const emp1Id = insEmp.run('John Smith',     'john.smith@sipsconsults.com',     '2022-01-15', '2022-01-15', 'Sterile Processing — Dallas',  'Sterile Processing Technician', managerId, dallasId,  'Yellow', 'Permanent', 0, 0, '214-555-0101').lastInsertRowid;
const emp2Id = insEmp.run('Maria Garcia',   'maria.garcia@sipsconsults.com',   '2023-06-01', '2023-06-01', 'Sterile Processing — Dallas',  'Sterile Processing Technician', managerId, dallasId,  'White',  'Permanent', 0, 0, '214-555-0102').lastInsertRowid;
const emp3Id = insEmp.run('David Chen',     'david.chen@sipsconsults.com',     '2021-03-20', '2021-03-20', 'Sterile Processing — Dallas',  'Senior SPD Tech',               managerId, dallasId,  'Green',  'Permanent', 1, 1, '214-555-0103').lastInsertRowid;
const emp4Id = insEmp.run('Sarah Johnson',  'sarah.johnson@sipsconsults.com',  '2020-08-10', '2020-08-10', 'QA — Houston',                  'QA Technician',                 managerId, houstonId, 'Green',  'Permanent', 1, 1, '713-555-0104').lastInsertRowid;
const emp5Id = insEmp.run('Mike Williams',  'mike.williams@sipsconsults.com',  '2019-11-05', '2019-11-05', 'Sterile Processing — Houston', 'SPD Lead Tech',                 managerId, houstonId, 'Yellow', 'Temporary', 0, 0, '713-555-0105').lastInsertRowid;
const emp6Id = insEmp.run('Linda Patel',    'linda.patel@sipsconsults.com',    '2024-02-20', '2024-02-20', 'Sterile Processing — Houston', 'Sterile Processing Technician', managerId, houstonId, 'White',  'Permanent', 0, 0, '713-555-0106').lastInsertRowid;

console.log('Employees created:', { emp1Id, emp2Id, emp3Id, emp4Id, emp5Id, emp6Id });

// Link manager user to leader employee David Chen
db.prepare(`UPDATE users SET employee_id = ? WHERE id = ?`).run(emp3Id, managerId);

// ─── ANNUAL REVIEW EVALUATION (Acknowledged, score 212/227) ──────────────────
const evalSections = [
  { name: 'Dependability',           max: 39, items: 13 },
  { name: 'Attendance',              max: 9,  items: 3  },
  { name: 'Policies & Procedures',   max: 24, items: 8  },
  { name: 'Communication Skills',    max: 36, items: 12 },
  { name: 'Productivity',            max: 20, items: 1  },
  { name: 'Safety / Injuries',       max: 15, items: 1  },
  { name: 'Production Quality',      max: 54, items: 18 },
  { name: 'Knowledge',               max: 30, items: 10 },
];

function seedEvaluation({ employeeId, evaluatorId, type, date, status, sectionScores, supervisor, employeeComments }) {
  const totalMax = evalSections.reduce((s, x) => s + x.max, 0);
  const totalScore = sectionScores.reduce((s, x) => s + x, 0);
  const passed = totalScore >= 211 ? 1 : 0;
  const evalId = db.prepare(`
    INSERT INTO evaluations (employee_id, evaluator_id, evaluation_type, evaluation_date, status, total_score, max_score, passing_score, passed, supervisor_comments, employee_comments)
    VALUES (?, ?, ?, ?, ?, ?, ?, 211, ?, ?, ?)
  `).run(employeeId, evaluatorId, type, date, status, totalScore, totalMax, passed, supervisor || null, employeeComments || null).lastInsertRowid;

  evalSections.forEach((sec, si) => {
    const sectionScore = sectionScores[si];
    const sectionId = db.prepare(`
      INSERT INTO eval_sections (evaluation_id, section_name, section_score, section_max) VALUES (?, ?, ?, ?)
    `).run(evalId, sec.name, sectionScore, sec.max).lastInsertRowid;
    const perItem = Math.floor(sectionScore / sec.items);
    const remainder = sectionScore - perItem * sec.items;
    const itemMax = Math.ceil(sec.max / sec.items);
    for (let i = 0; i < sec.items; i++) {
      const score = Math.min(perItem + (i < remainder ? 1 : 0), itemMax);
      db.prepare(`
        INSERT INTO eval_items (section_id, item_label, score, max_score) VALUES (?, ?, ?, ?)
      `).run(sectionId, `${sec.name} item ${i + 1}`, score, itemMax);
    }
  });
  return evalId;
}

const annualEvalId = seedEvaluation({
  employeeId: emp3Id,
  evaluatorId: managerId,
  type: 'Annual',
  date: '2026-01-15',
  status: 'Acknowledged',
  sectionScores: [37, 9, 23, 33, 20, 15, 51, 24], // sum = 212
  supervisor: 'Strong performer; consistently exceeds expectations.',
  employeeComments: 'Thank you for the feedback.'
});
db.prepare(`UPDATE evaluations SET acknowledged_by = ?, acknowledged_at = CURRENT_TIMESTAMP WHERE id = ?`).run('David Chen', annualEvalId);

// Failing eval to trigger PIP
const failedEvalId = seedEvaluation({
  employeeId: emp1Id,
  evaluatorId: managerId,
  type: 'Annual',
  date: '2026-02-01',
  status: 'Submitted',
  sectionScores: [30, 6, 18, 26, 10, 0, 38, 20], // sum = 148 (FAIL)
  supervisor: 'Multiple issues identified; PIP issued.',
});

// ─── PIP PLAN ────────────────────────────────────────────────────────────────
db.prepare(`
  INSERT INTO pip_plans (evaluation_id, action_plan, goals, expectations, timeline, next_pip_date, status, monitoring_period, type, facility_id)
  VALUES (?, ?, ?, ?, ?, ?, 'Active', '30 Days', 'New', ?)
`).run(
  failedEvalId,
  'Daily check-ins with supervisor; weekly skill review.',
  'Achieve 90% production quality within 30 days.',
  'Maintain 100% attendance and follow all safety protocols.',
  '30 days from issuance.',
  '2026-05-15',
  dallasId
);

// ─── TECH REVIEW EVALUATION ──────────────────────────────────────────────────
const techEvalId = db.prepare(`
  INSERT INTO evaluations (employee_id, evaluator_id, evaluation_type, evaluation_date, status, total_score, max_score, passing_score, passed, overall_score, belt_level_at_eval, pay_increase_rate)
  VALUES (?, ?, 'Tech Review', '2026-02-15', 'Submitted', 92, 100, 70, 1, 92, 'Green', 0.015)
`).run(emp4Id, managerId).lastInsertRowid;

const insTechScore = db.prepare(`
  INSERT INTO tech_review_scores (evaluation_id, section, item_label, score, score_value, points_possible)
  VALUES (?, ?, ?, ?, ?, 1.0)
`);
['Decontamination & Infection Control','Inspection, Assembly, Packaging & Sterilization','Equipment Operation & Technical Competency','Documentation, Traceability & Distribution','Workflow, Communication & Accountability','Culture, Engagement & Professional Ownership','Attendance & Compliance','Measurement & Data Mastery'].forEach((sec) => {
  for (let n = 0; n < 5; n++) {
    insTechScore.run(techEvalId, sec, `${sec} item ${n + 1}`, 'Meets', 0.95);
  }
});

// ─── ATTENDANCE LOG (1 rolled off, 2 active) ─────────────────────────────────
const insAtt = db.prepare(`
  INSERT INTO attendance_log (employee_id, facility_id, date_of_occurrence, occurrence_code, occurrence_type, description_type, description, points, accumulated_points, roll_off_date, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
insAtt.run(emp1Id, dallasId, '2025-08-01', 'A',   'Call-Out', 'Sick/Medical', 'Flu',         1.0, 1.0,  '2026-02-01', managerId); // rolled off
insAtt.run(emp1Id, dallasId, '2026-03-15', 'T30', 'Tardy',    'Personal',     'Late 20 min', 0.5, 0.5,  '2026-09-15', managerId); // active
insAtt.run(emp1Id, dallasId, '2026-04-01', 'T15', 'Tardy',    'Personal',     'Late 10 min', 0.25,0.75, '2026-10-01', managerId); // active

// ─── QA LOG ──────────────────────────────────────────────────────────────────
const insQa = db.prepare(`
  INSERT INTO qa_log (employee_id, facility_id, date_of_incident, issue_type, issue_points, accumulated_points, action_taken, status, description, roll_off_date, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
insQa.run(emp1Id, dallasId, '2026-03-10', 'Bio Burden',                   4, 4, 'Written Warning with Counseling',          'Incomplete', 'Visible debris on retractor.', '2027-03-10', managerId);
insQa.run(emp1Id, dallasId, '2026-03-20', 'Incorrect Instruments in Set', 2, 6, 'Written Warning with Additional Training', 'Incomplete', 'Wrong forceps in set.',        '2027-03-20', managerId);

// ─── DISCIPLINARY (Approved) ────────────────────────────────────────────────
const discToken = crypto.randomBytes(32).toString('hex');
db.prepare(`
  INSERT INTO disciplinary_actions (employee_id, facility_id, initiated_by, hr_approved_by, hr_approved_at, date_of_incident, issuance_date, violation_types, action_level, details, improvement_plan, monitoring_period, type, status, roll_off_date, employee_sign_token)
  VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, '2026-03-25', '2026-03-25', ?, '1st Warning', ?, ?, '30 Days', 'New', 'Approved', '2026-04-24', ?)
`).run(
  emp1Id, dallasId, managerId, hrId,
  JSON.stringify(['Quality (QA)']),
  'Multiple QA violations within a 30-day period.',
  'Daily quality check-ins with supervisor; complete decontamination refresher training.',
  discToken
);

// ─── COMPLIANCE RECORDS ──────────────────────────────────────────────────────
const insCompliance = db.prepare(`
  INSERT INTO compliance_records (employee_id, requirement_type, expiration_date, renewed_date, renewed_within_deadline, points_value, notes)
  VALUES (?, ?, ?, ?, ?, 2.0, ?)
`);
insCompliance.run(emp3Id, 'BLS',           '2026-12-31', '2025-12-15', 1, 'Renewed on time');
insCompliance.run(emp3Id, 'Hepatitis B',   '2025-06-30', '2025-06-28', 1, 'Renewed on time');
insCompliance.run(emp3Id, 'Physical Exam', '2026-09-01', '2025-08-30', 1, 'Renewed on time');

// ─── UNUSED SELF-EVAL INVITE ─────────────────────────────────────────────────
const inviteToken = crypto.randomBytes(32).toString('hex');
const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
const placeholderHash = bcrypt.hashSync('PLACEHOLDER_' + Math.random(), 10);
db.prepare(`
  INSERT INTO users (name, email, password_hash, role, employee_id, invite_token, invite_expires_at, invite_used)
  VALUES (?, ?, ?, 'employee', ?, ?, ?, 0)
`).run('Maria Garcia', 'maria.garcia.invite@sipsconsults.com', placeholderHash, emp2Id, inviteToken, inviteExpires);

console.log('Seed complete.');
console.log('  Login credentials:');
console.log('    admin@sipsconsults.com / admin123');
console.log('    hr@sipsconsults.com    / hr123');
console.log('    manager@sipsconsults.com / manager123');
console.log(`  Self-eval invite link: /self-eval/invite/${inviteToken}`);
