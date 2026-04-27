const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { triggerNow } = require('../jobs/scheduler');
const { getDb } = require('../db/database');

router.use(authenticateToken);
router.use(requireRole('admin'));

// POST /api/admin/jobs/run/:job — manually trigger a scheduled job
router.post('/jobs/run/:job', async (req, res) => {
  try {
    await triggerNow(getDb(), req.params.job);
    res.json({ success: true, message: `Job '${req.params.job}' executed` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
