const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/employees
router.get('/', (req, res) => {
  const db = getDb();
  const { search, department, active } = req.query;

  let query = `
    SELECT
      e.*,
      u.name AS manager_name,
      ev.evaluation_date AS last_eval_date,
      ev.total_score AS last_score,
      ev.passed AS last_passed,
      ev.status AS last_status
    FROM employees e
    LEFT JOIN users u ON e.manager_id = u.id
    LEFT JOIN (
      SELECT employee_id, evaluation_date, total_score, passed, status,
             ROW_NUMBER() OVER (PARTITION BY employee_id ORDER BY evaluation_date DESC) AS rn
      FROM evaluations
      WHERE status != 'Draft'
    ) ev ON e.id = ev.employee_id AND ev.rn = 1
    WHERE 1=1
  `;

  const params = [];

  if (search) {
    query += ` AND (e.name LIKE ? OR e.email LIKE ? OR e.department LIKE ?)`;
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  if (department) {
    query += ` AND e.department = ?`;
    params.push(department);
  }

  if (active !== undefined) {
    query += ` AND e.active = ?`;
    params.push(active === 'true' ? 1 : 0);
  } else {
    query += ` AND e.active = 1`;
  }

  query += ` ORDER BY e.name ASC`;

  const employees = db.prepare(query).all(...params);
  res.json({ employees });
});

// GET /api/employees/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const employee = db.prepare(`
    SELECT e.*, u.name AS manager_name
    FROM employees e
    LEFT JOIN users u ON e.manager_id = u.id
    WHERE e.id = ?
  `).get(id);

  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  const evaluations = db.prepare(`
    SELECT ev.*, u.name AS evaluator_name
    FROM evaluations ev
    LEFT JOIN users u ON ev.evaluator_id = u.id
    WHERE ev.employee_id = ?
    ORDER BY ev.evaluation_date DESC
  `).all(id);

  const pipPlans = db.prepare(`
    SELECT pp.* FROM pip_plans pp
    JOIN evaluations ev ON pp.evaluation_id = ev.id
    WHERE ev.employee_id = ?
    ORDER BY pp.created_at DESC
  `).all(id);

  res.json({ employee, evaluations, pipPlans });
});

// POST /api/employees
router.post('/', (req, res) => {
  const db = getDb();
  const { name, email, hire_date, department, job_title, tech_level, manager_id } = req.body;

  if (!name || !email || !hire_date || !department || !job_title) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO employees (name, email, hire_date, department, job_title, tech_level, manager_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, email, hire_date, department, job_title, tech_level || null, manager_id || null);

    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ employee });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/employees/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { name, email, hire_date, department, job_title, tech_level, manager_id, active } = req.body;

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  try {
    db.prepare(`
      UPDATE employees
      SET name = ?, email = ?, hire_date = ?, department = ?, job_title = ?,
          tech_level = ?, manager_id = ?, active = ?
      WHERE id = ?
    `).run(
      name || employee.name,
      email || employee.email,
      hire_date || employee.hire_date,
      department || employee.department,
      job_title || employee.job_title,
      tech_level !== undefined ? tech_level : employee.tech_level,
      manager_id !== undefined ? manager_id : employee.manager_id,
      active !== undefined ? (active ? 1 : 0) : employee.active,
      id
    );

    const updated = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    res.json({ employee: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
