const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { getUsers, getUser, updateUser, deleteUser, updateProfile } = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }
  next();
};

router.use(protect);

router.put(
  '/profile',
  [
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Please provide a valid email'),
    body('password')
      .optional({ checkFalsy: true })
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ],
  validate,
  updateProfile
);

router.use(authorize('admin'));
router.route('/').get(getUsers);
router
  .route('/:id')
  .get(getUser)
  .put(
    [
      body('email').optional({ checkFalsy: true }).isEmail().withMessage('Please provide a valid email'),
      body('role').optional().isIn(['admin', 'staff']).withMessage('Role must be admin or staff'),
      body('password')
        .optional({ checkFalsy: true })
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
    ],
    validate,
    updateUser
  )
  .delete(deleteUser);

module.exports = router;

