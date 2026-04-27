const cron = require('node-cron');
const { sendEmail } = require('../utils/mailer');

function daysBetween(date1, date2) {
  const ms = new Date(date1).getTime() - new Date(date2).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// JOB 1: Daily anniversary check — runs at 6 AM every day
async function runAnniversaryCheck(db) {
  console.log('[Scheduler] Running anniversary check...');
  const today = new Date();
  const triggers = [
    { days: 30, type30: 'self_eval_due_30', typeAnnual: 'annual_review_due_30' },
    { days: 15, type30: 'self_eval_due_15', typeAnnual: 'annual_review_due_15' },
    { days: 5, type30: 'self_eval_due_5', typeAnnual: 'annual_review_due_5' },
  ];

  // Get all active employees with anniversary_date set
  const employees = db.prepare(`
    SELECT e.*, u.email AS manager_email, u.name AS manager_name
    FROM employees e
    LEFT JOIN users u ON e.manager_id = u.id
    WHERE e.active = 1 AND e.anniversary_date IS NOT NULL
  `).all();

  let count = 0;
  for (const emp of employees) {
    const annivDate = new Date(emp.anniversary_date);
    const thisYearAnniv = new Date(today.getFullYear(), annivDate.getMonth(), annivDate.getDate());
    if (thisYearAnniv < today) {
      thisYearAnniv.setFullYear(today.getFullYear() + 1);
    }
    const daysUntil = daysBetween(thisYearAnniv, today);

    const trigger = triggers.find(t => t.days === daysUntil);
    if (!trigger) continue;

    // Check if we've already sent this notification today (idempotent)
    const existing = db.prepare(`
      SELECT id FROM eval_notifications
      WHERE employee_id = ? AND notification_type = ? AND date(sent_at) = date('now')
    `).get(emp.id, trigger.type30);

    if (existing) continue;

    // Self-eval reminder to employee
    if (emp.work_email || emp.email) {
      const empEmail = emp.work_email || emp.email;
      const subject = `Self-Evaluation Reminder: Due in ${trigger.days} days`;
      const html = `
        <p>Hi ${emp.name},</p>
        <p>Your annual self-evaluation is due in <strong>${trigger.days} days</strong> (anniversary date: ${thisYearAnniv.toISOString().split('T')[0]}).</p>
        <p>Please log in to complete your self-evaluation.</p>
        <p>Thanks,<br/>SIPS Healthcare HR</p>
      `;
      try { await sendEmail({ to: empEmail, subject, html }); } catch(e) { console.error('[Scheduler] email error:', e.message); }

      db.prepare(`
        INSERT INTO eval_notifications (employee_id, notification_type, sent_to_role, sent_to_email)
        VALUES (?, ?, 'employee', ?)
      `).run(emp.id, trigger.type30, empEmail);
      count++;
    }

    // Annual review reminder to manager
    if (emp.manager_email) {
      const subject = `Annual Review Due: ${emp.name} — ${trigger.days} days`;
      const html = `
        <p>Hi ${emp.manager_name},</p>
        <p>An annual review for <strong>${emp.name}</strong> is due in <strong>${trigger.days} days</strong> (anniversary date: ${thisYearAnniv.toISOString().split('T')[0]}).</p>
        <p>Please log in to start the evaluation.</p>
        <p>Thanks,<br/>SIPS Healthcare HR</p>
      `;
      try { await sendEmail({ to: emp.manager_email, subject, html }); } catch(e) { console.error('[Scheduler] email error:', e.message); }

      db.prepare(`
        INSERT INTO eval_notifications (employee_id, notification_type, sent_to_role, sent_to_email)
        VALUES (?, ?, 'manager', ?)
      `).run(emp.id, trigger.typeAnnual, emp.manager_email);
      count++;
    }
  }
  console.log(`[Scheduler] Anniversary check complete. Sent ${count} notifications.`);
}

// JOB 2: 48-hour attendance acknowledgment fallback — runs every 6 hours
async function runAttendanceFallback(db) {
  console.log('[Scheduler] Running attendance 48hr fallback...');

  // Find unacknowledged entries older than 48 hours where auto_notify_sent = 0
  const overdue = db.prepare(`
    SELECT a.*, e.name AS employee_name, e.work_email, e.email,
           u.email AS manager_email, u.name AS manager_name
    FROM attendance_log a
    JOIN employees e ON a.employee_id = e.id
    LEFT JOIN users u ON e.manager_id = u.id
    WHERE a.acknowledged_by_employee = 0
      AND a.auto_notify_sent = 0
      AND datetime(a.created_at, '+48 hours') < datetime('now')
  `).all();

  let count = 0;
  for (const entry of overdue) {
    const recipients = [];
    if (entry.manager_email) recipients.push(entry.manager_email);
    recipients.push('hr@sipsconsults.com');

    const subject = `Unacknowledged Attendance Entry — ${entry.employee_name}`;
    const html = `
      <p>An attendance entry for <strong>${entry.employee_name}</strong> from ${entry.date_of_occurrence} (${entry.occurrence_code || entry.occurrence_type || 'Attendance'}) has not been acknowledged within 48 hours.</p>
      <p>Description: ${entry.description || 'N/A'}</p>
      <p>Please follow up with the employee.</p>
    `;

    for (const to of recipients) {
      try { await sendEmail({ to, subject, html }); } catch(e) { console.error('[Scheduler] email error:', e.message); }
    }

    db.prepare('UPDATE attendance_log SET auto_notify_sent = 1 WHERE id = ?').run(entry.id);
    count++;
  }
  console.log(`[Scheduler] Attendance fallback complete. Notified for ${count} entries.`);
}

function startJobs(db) {
  // Anniversary check: 6 AM daily
  cron.schedule('0 6 * * *', () => {
    runAnniversaryCheck(db).catch(e => console.error('[Scheduler] Anniversary error:', e));
  });

  // Attendance fallback: every 6 hours
  cron.schedule('0 */6 * * *', () => {
    runAttendanceFallback(db).catch(e => console.error('[Scheduler] Fallback error:', e));
  });

  console.log('[Scheduler] Jobs started: anniversary (6 AM daily), attendance fallback (every 6 hours)');
}

// Allow manual trigger via API for admins/testing
async function triggerNow(db, jobName) {
  if (jobName === 'anniversary') return runAnniversaryCheck(db);
  if (jobName === 'attendance') return runAttendanceFallback(db);
  throw new Error('Unknown job: ' + jobName);
}

module.exports = { startJobs, triggerNow };
