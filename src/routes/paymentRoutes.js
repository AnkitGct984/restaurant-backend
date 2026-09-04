const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createStripePaymentIntent, confirmStripePayment,
  createRazorpayOrder, verifyRazorpayPayment,
  markCashPayment, getPayments, initiateRefund
} = require('../controllers/paymentController');

router.use(protect);

// Stripe
router.post('/stripe/create-intent', createStripePaymentIntent);
router.post('/stripe/confirm', confirmStripePayment);

// Razorpay
router.post('/razorpay/create-order', createRazorpayOrder);
router.post('/razorpay/verify', verifyRazorpayPayment);

// Cash payment (staff only)
router.post('/cash', authorize('admin', 'waiter'), markCashPayment);

// List payments
router.get('/', getPayments);

// Refund (admin only)
router.post('/:id/refund', authorize('admin'), initiateRefund);

module.exports = router;
