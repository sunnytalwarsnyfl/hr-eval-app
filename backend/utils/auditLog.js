const { getDb } = require('../db/database');

// Logs an action to the audit_log table
// req: Express request object (used for user info, IP, user-agent)
// action: 'create' | 'update' | 'delete' | 'approve' | 'sign' | 'login' | 'logout' | etc.
// entityType: 'evaluation' | 'employee' | 'disciplinary' | 'qa_log' | 'attendance' | 'pip' | 'user' | 'settings' | 'auth'
// entityId: numeric ID of the entity (or null for non-entity actions like login)
// details: object — will be JSON.stringified
function audit(req, action, entityType, entityId = null, details = null) {
  try {
    const db = getDb();
    const ip = req.ip || req.headers?.['x-forwarded-for'] || req.connection?.remoteAddress || null;
    const ua = req.headers?.['user-agent'] || null;
    const detailsStr = details ? JSON.stringify(details) : null;

    db.prepare(`
      INSERT INTO audit_log (user_id, user_name, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user?.id || null,
      req.user?.name || null,
      req.user?.role || null,
      action,
      entityType,
      entityId,
      detailsStr,
      ip,
      ua
    );
  } catch (e) {
    console.error('[Audit] Failed to log:', e.message);
  }
}

module.exports = { audit };
