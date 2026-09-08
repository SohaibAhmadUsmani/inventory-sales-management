const router = require('express').Router();
const { getActivityLogs } = require('../controllers/activityLog.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin'));
router.get('/', getActivityLogs);

module.exports = router;
