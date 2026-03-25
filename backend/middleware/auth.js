const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'hr-eval-secret-key-change-in-prod';

function authenticateToken(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

function requireManagerOrAbove(req, res, next) {
  if (!['manager', 'hr', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

module.exports = { authenticateToken, requireRole, requireManagerOrAbove, JWT_SECRET };
