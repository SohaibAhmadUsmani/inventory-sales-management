const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { register, login, getMe, forgotPassword, resetPassword } = require('../controllers/auth.controller');
const { protect, authorize } = require('../middleware/auth');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }
  next();
};

router.post('/register',
  protect,
  authorize('admin'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['admin', 'staff']).withMessage('Role must be admin or staff'),
  ],
  validate,
  register
);

router.post('/login',
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

router.get('/me', protect, getMe);

router.post('/forgot-password',
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
  ],
  validate,
  forgotPassword
);

router.post('/reset-password/:token',
  [
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  resetPassword
);

module.exports = router;
