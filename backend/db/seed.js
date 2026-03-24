const bcrypt = require('bcryptjs');
const { getDb } = require('./database');

const db = getDb();

// Clear existing data
db.exec(`
  DELETE FROM pip_plans;
  DELETE FROM eval_items;
  DELETE FROM eval_sections;
  DELETE FROM evaluations;
  DELETE FROM employees;
  DELETE FROM users;
`);

// Reset autoincrement
db.exec(`
  DELETE FROM sqlite_sequence WHERE name IN ('users','employees','evaluations','eval_sections','eval_items','pip_plans');
`);

// Hash passwords
const adminHash = bcrypt.hashSync('admin123', 10);
const hrHash = bcrypt.hashSync('hr123', 10);
const managerHash = bcrypt.hashSync('manager123', 10);

// Insert users
const insertUser = db.prepare(`
  INSERT INTO users (name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?)
`);

const adminId = insertUser.run('System Admin', 'admin@company.com', adminHash, 'admin', 'Administration').lastInsertRowid;
const hrId = insertUser.run('HR Manager', 'hr@company.com', hrHash, 'hr', 'Human Resources').lastInsertRowid;
const managerId = insertUser.run('Operations Manager', 'manager@company.com', managerHash, 'manager', 'Sterile Processing').lastInsertRowid;

console.log('Users created:', { adminId, hrId, managerId });

// Insert employees
const insertEmployee = db.prepare(`
  INSERT INTO employees (name, email, hire_date, department, job_title, tech_level, manager_id)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const emp1Id = insertEmployee.run('John Smith', 'john.smith@company.com', '2022-01-15', 'Sterile Processing', 'Sterile Processing Technician', 'Tech 3', managerId).lastInsertRowid;
const emp2Id = insertEmployee.run('Maria Garcia', 'maria.garcia@company.com', '2023-06-01', 'Sterile Processing', 'Sterile Processing Technician', 'Tech 1', managerId).lastInsertRowid;
const emp3Id = insertEmployee.run('David Chen', 'david.chen@company.com', '2021-03-20', 'Sterile Processing', 'Senior Sterile Processing Tech', 'Tech 4', managerId).lastInsertRowid;
const emp4Id = insertEmployee.run('Sarah Johnson', 'sarah.johnson@company.com', '2020-08-10', 'IT', 'IT Support Specialist', 'Tech 4', managerId).lastInsertRowid;
const emp5Id = insertEmployee.run('Mike Williams', 'mike.williams@company.com', '2019-11-05', 'QA', 'QA Technician', 'QA Tech', managerId).lastInsertRowid;

console.log('Employees created:', { emp1Id, emp2Id, emp3Id, emp4Id, emp5Id });

// Section definitions for seeding
const EVAL_SECTIONS = [
  { name: "Dependability", maxScore: 39, itemCount: 13, scoring: "standard" },
  { name: "Attendance", maxScore: 9, itemCount: 3, scoring: "standard" },
  { name: "Policies & Procedures", maxScore: 24, itemCount: 8, scoring: "standard" },
  { name: "Communication Skills", maxScore: 36, itemCount: 12, scoring: "standard" },
  { name: "Productivity", maxScore: 20, itemCount: 1, scoring: "productivity" },
  { name: "Safety / Injuries", maxScore: 15, itemCount: 1, scoring: "safety" },
  { name: "Production Quality", maxScore: 54, itemCount: 18, scoring: "standard" },
  { name: "Knowledge", maxScore: 30, itemCount: 10, scoring: "standard" }
];

const ITEM_LABELS = {
  "Dependability": [
    "Always starts and ends work at scheduled time",
    "Always informs supervisor before going on break",
    "Always visible in work area during shift",
    "Is reliable in work habits",
    "Completes assignments and tasks in a timely manner",
    "Adapts to changes in the work environment",
    "Participates and supports Performance Improvement activities",
    "Makes appropriate and logical decisions",
    "Self-starter, works with minimal supervision",
    "Responds appropriately in emergency situations",
    "Properly reports equipment problems",
    "Properly reports issues",
    "Maintains professional demeanor at all times"
  ],
  "Attendance": [
    "Reports to work on time; ready to begin at start of shift",
    "Returns from lunch and breaks on time",
    "Attendance and absences record"
  ],
  "Policies & Procedures": [
    "Adheres to company policies and procedures",
    "Properly requests and uses PTO policy",
    "Adheres to privacy and confidentiality policy",
    "Consistently maintains appropriate professional appearance",
    "Completes and submits time worked accurately",
    "Always wears facility identification badge",
    "Adheres to fire and safety policies",
    "Does not discuss private matters in public areas of facility"
  ],
  "Communication Skills": [
    "Communicates effectively through verbal and written communications",
    "Adheres to facility phone etiquette and expectations",
    "Demonstrates active listening skills with customers and colleagues",
    "Listens to others without becoming defensive or angry",
    "Verbalizes concerns in a positive manner",
    "Respectfully uses nonverbal communication (eye contact, body language)",
    "Is courteous, respectful, and professional to customers and co-workers",
    "Responds to customer requests willingly without impatience",
    "Communicates and interacts with co-workers positively",
    "Promotes positive work relationships with co-workers and supervisors",
    "Interacts respectfully regardless of gender, race, or culture",
    "Works cooperatively and avoids negative or distracting behaviors"
  ],
  "Productivity": ["Productivity performance for tech level"],
  "Safety / Injuries": ["No on-the-job injuries or incidents during this period"],
  "Production Quality": [
    "Holds self accountable for completion of assignments in timely fashion",
    "Completes work left from previous shifts and reports incomplete tasks",
    "Provides unsolicited assistance to co-workers",
    "Responds in timely manner for requested items or supplies",
    "Works in an organized manner",
    "Maintains a clean and safe work area",
    "Records and runs Bowie Dick test and records results",
    "Identifies effective decontamination methods correctly",
    "Effectively removes all visible bio burden",
    "Documents missing instruments",
    "Documents missing instruments as found",
    "Properly inspects and handles broken instruments",
    "Places correct instruments in sets or substitutes appropriately",
    "Handles missing tray filters correctly",
    "Demonstrates accuracy and thoroughness",
    "Correctly identifies and handles instruments",
    "Provides customer satisfaction",
    "Overall quality of work achieved"
  ],
  "Knowledge": [
    "Properly operates all equipment",
    "Prevents injury to self and others",
    "Accurately uses the instrument tracking system",
    "Identifies proper cleaning methods (manual, mechanical, sonic)",
    "Correctly identifies instruments",
    "Properly operates steam autoclave",
    "Properly operates ETO sterilizer",
    "Properly operates washer-decontaminator",
    "Properly operates ultrasonic machine",
    "Properly operates drying cabinet"
  ]
};

function getMaxPerItem(sectionName, scoring) {
  if (scoring === 'productivity') return 20;
  if (scoring === 'safety') return 15;
  return 3;
}

function createEvaluation(employeeId, evaluatorId, type, date, status, sections, supervisorComments, employeeComments, nextEvalDate, acknowledged) {
  const insertEval = db.prepare(`
    INSERT INTO evaluations (employee_id, evaluator_id, evaluation_type, evaluation_date, status, total_score, max_score, passing_score, passed, supervisor_comments, employee_comments, acknowledged_by, acknowledged_at, next_eval_date)
    VALUES (?, ?, ?, ?, ?, ?, 227, 211, ?, ?, ?, ?, ?, ?)
  `);

  const insertSection = db.prepare(`
    INSERT INTO eval_sections (evaluation_id, section_name, section_score, section_max, notes)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO eval_items (section_id, item_label, score, max_score, evaluator_note)
    VALUES (?, ?, ?, ?, ?)
  `);

  let totalScore = 0;
  sections.forEach(s => { totalScore += s.sectionScore; });

  const passed = totalScore >= 211 ? 1 : 0;

  const evalId = insertEval.run(
    employeeId, evaluatorId, type, date, status,
    totalScore, passed,
    supervisorComments || null,
    employeeComments || null,
    acknowledged ? 'Acknowledged by Employee' : null,
    acknowledged ? date + ' 10:00:00' : null,
    nextEvalDate || null
  ).lastInsertRowid;

  sections.forEach(s => {
    const sectionId = insertSection.run(evalId, s.name, s.sectionScore, s.maxScore, s.notes || null).lastInsertRowid;
    s.items.forEach(item => {
      insertItem.run(sectionId, item.label, item.score, item.maxScore, item.note || null);
    });
  });

  return evalId;
}

// ============================
// Evaluation 1: John Smith - Annual - FAIL (total ~195) with PIP
// ============================
const johnSections = EVAL_SECTIONS.map(sec => {
  const labels = ITEM_LABELS[sec.name];
  let items = [];
  let sectionScore = 0;

  if (sec.scoring === 'standard') {
    // Give scores of 1-2 (below average) to get failing total
    items = labels.map((label, i) => {
      const score = i % 3 === 0 ? 1 : (i % 3 === 1 ? 2 : 1);
      sectionScore += score;
      return { label, score, maxScore: 3 };
    });
  } else if (sec.scoring === 'productivity') {
    const score = 10; // Meets/Needs Improvement
    sectionScore = score;
    items = labels.map(label => ({ label, score, maxScore: 20 }));
  } else if (sec.scoring === 'safety') {
    const score = 0; // Had incidents
    sectionScore = score;
    items = labels.map(label => ({ label, score, maxScore: 15 }));
  }

  return { name: sec.name, maxScore: sec.maxScore, sectionScore, items };
});

// Calculate and verify total for John
let johnTotal = johnSections.reduce((sum, s) => sum + s.sectionScore, 0);
console.log('John total score:', johnTotal);

const eval1Id = createEvaluation(
  emp1Id, managerId,
  'Annual', '2025-12-15', 'Submitted',
  johnSections,
  'John has shown areas needing significant improvement. A Performance Improvement Plan has been initiated to support his development. Attendance issues and safety incidents have been noted.',
  'I understand the areas where I need to improve and am committed to meeting expectations.',
  '2026-06-15',
  false
);

// Add PIP plan for John
const insertPip = db.prepare(`
  INSERT INTO pip_plans (evaluation_id, action_plan, goals, expectations, timeline, next_pip_date)
  VALUES (?, ?, ?, ?, ?, ?)
`);

insertPip.run(
  eval1Id,
  'Employee will attend additional training sessions on sterile processing protocols. Weekly check-ins with supervisor for first 90 days. Review all safety procedures and demonstrate competency.',
  '1. Zero safety incidents for next 90 days. 2. Improve attendance to 95%+ on-time rate. 3. Achieve productivity targets for Tech 3 level. 4. Score 211+ on next evaluation.',
  'Employee must demonstrate consistent improvement in all flagged areas. Failure to meet PIP goals may result in further disciplinary action.',
  '90 days from evaluation date',
  '2026-03-15'
);

console.log('John evaluation created with PIP:', eval1Id);

// ============================
// Evaluation 2: David Chen - Annual - PASS (total ~220) Acknowledged
// ============================
const davidSections = EVAL_SECTIONS.map(sec => {
  const labels = ITEM_LABELS[sec.name];
  let items = [];
  let sectionScore = 0;

  if (sec.scoring === 'standard') {
    items = labels.map((label, i) => {
      const score = i % 4 === 0 ? 3 : (i % 4 === 1 ? 3 : (i % 4 === 2 ? 2 : 3));
      sectionScore += score;
      return { label, score, maxScore: 3 };
    });
  } else if (sec.scoring === 'productivity') {
    const score = 20; // Exceeds
    sectionScore = score;
    items = labels.map(label => ({ label, score, maxScore: 20 }));
  } else if (sec.scoring === 'safety') {
    const score = 15; // No incidents
    sectionScore = score;
    items = labels.map(label => ({ label, score, maxScore: 15 }));
  }

  return { name: sec.name, maxScore: sec.maxScore, sectionScore, items };
});

let davidTotal = davidSections.reduce((sum, s) => sum + s.sectionScore, 0);
console.log('David total score:', davidTotal);

const eval2Id = createEvaluation(
  emp3Id, managerId,
  'Annual', '2025-11-20', 'Acknowledged',
  davidSections,
  'David consistently exceeds expectations in all areas. He is a valued team member who demonstrates leadership qualities and mentors newer technicians.',
  'I am grateful for this positive evaluation. I look forward to continued growth in my role.',
  '2026-11-20',
  true
);

console.log('David evaluation created:', eval2Id);

// ============================
// Evaluation 3: Maria Garcia - 90-Day - Draft (partial scores)
// ============================
const mariaSections = EVAL_SECTIONS.map((sec, idx) => {
  const labels = ITEM_LABELS[sec.name];
  let items = [];
  let sectionScore = 0;

  // Only fill first 3 sections fully, rest partially
  if (idx < 3) {
    if (sec.scoring === 'standard') {
      items = labels.map((label, i) => {
        const score = 2;
        sectionScore += score;
        return { label, score, maxScore: 3 };
      });
    } else if (sec.scoring === 'productivity') {
      const score = 10;
      sectionScore = score;
      items = labels.map(label => ({ label, score, maxScore: 20 }));
    } else if (sec.scoring === 'safety') {
      const score = 15;
      sectionScore = score;
      items = labels.map(label => ({ label, score, maxScore: 15 }));
    }
  } else {
    // Partial - score 0 (not yet scored)
    items = labels.map(label => ({ label, score: 0, maxScore: sec.scoring === 'productivity' ? 20 : sec.scoring === 'safety' ? 15 : 3 }));
    sectionScore = 0;
  }

  return { name: sec.name, maxScore: sec.maxScore, sectionScore, items };
});

const eval3Id = createEvaluation(
  emp2Id, managerId,
  '90-Day', '2026-01-10', 'Draft',
  mariaSections,
  null, null,
  '2026-07-10',
  false
);

console.log('Maria evaluation created (draft):', eval3Id);

// ============================
// Mike Williams - Overdue evaluation (last was 2024-01-01)
// ============================
const mikeSections = EVAL_SECTIONS.map(sec => {
  const labels = ITEM_LABELS[sec.name];
  let items = [];
  let sectionScore = 0;

  if (sec.scoring === 'standard') {
    items = labels.map((label) => {
      const score = 2;
      sectionScore += score;
      return { label, score, maxScore: 3 };
    });
  } else if (sec.scoring === 'productivity') {
    const score = 20;
    sectionScore = score;
    items = labels.map(label => ({ label, score, maxScore: 20 }));
  } else if (sec.scoring === 'safety') {
    const score = 15;
    sectionScore = score;
    items = labels.map(label => ({ label, score, maxScore: 15 }));
  }

  return { name: sec.name, maxScore: sec.maxScore, sectionScore, items };
});

let mikeTotal = mikeSections.reduce((sum, s) => sum + s.sectionScore, 0);
console.log('Mike total score:', mikeTotal);

const eval4Id = createEvaluation(
  emp5Id, managerId,
  'Annual', '2024-01-01', 'Acknowledged',
  mikeSections,
  'Mike performs his duties adequately and meets basic expectations.',
  'Thank you for the evaluation.',
  '2025-01-01',
  true
);

console.log('Mike evaluation created:', eval4Id);

// Update evaluations updated_at
db.prepare(`UPDATE evaluations SET updated_at = evaluation_date`).run();

console.log('\nSeed completed successfully!');
console.log('\nTest credentials:');
console.log('  admin@company.com / admin123');
console.log('  hr@company.com / hr123');
console.log('  manager@company.com / manager123');
