const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const {
  getDashboardStats, getSalesReport, getPopularDishes,
  getAllUsers, createStaffUser, updateUser, deactivateUser,
  getRevenueBreakdown
} = require('../controllers/adminController');

router.use(protect, authorize('admin'));

// Dashboard
router.get('/dashboard', getDashboardStats);
router.get('/sales-report', getSalesReport);
router.get('/popular-dishes', getPopularDishes);
router.get('/revenue-breakdown', getRevenueBreakdown);

// User management
router.get('/users', getAllUsers);
router.post('/users/staff',
  [
    body('name').trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('role').isIn(['waiter', 'chef', 'admin']).withMessage('Invalid staff role')
  ],
  validate,
  createStaffUser
);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deactivateUser);

module.exports = router;
