const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize, requireEmailVerified } = require('../middleware/auth');
const {
  createReservation, getReservations, getReservationById,
  cancelReservation, updateReservationStatus, getAvailableSlots
} = require('../controllers/reservationController');

router.use(protect);

// Available time slots (public after login)
router.get('/slots', getAvailableSlots);

// Create reservation - customer
router.post('/',
  authorize('customer'),
  requireEmailVerified,
  [
    body('tableId').notEmpty().withMessage('Table ID is required'),
    body('date').isISO8601().withMessage('Valid date is required'),
    body('startTime').notEmpty().withMessage('Start time is required'),
    body('endTime').notEmpty().withMessage('End time is required'),
    body('guests').isInt({ min: 1 }).withMessage('At least 1 guest required'),
    body('occasion').optional().isIn(['none', 'birthday', 'anniversary', 'business', 'romantic', 'other'])
  ],
  validate,
  createReservation
);

// Get all (admin/staff see all, customer sees own)
router.get('/', getReservations);
router.get('/:id', getReservationById);

// Cancel reservation
router.patch('/:id/cancel', cancelReservation);

// Admin / waiter update status
router.patch('/:id/status', authorize('admin', 'waiter'), updateReservationStatus);

module.exports = router;
