const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize, requireEmailVerified } = require('../middleware/auth');
const {
  placeOrder, getOrders, getOrderById,
  updateOrderStatus, cancelOrder, getInvoice
} = require('../controllers/orderController');

router.use(protect);

// Place order
router.post('/',
  requireEmailVerified,
  [
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.menuItemId').notEmpty().withMessage('Menu item ID required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('orderType').optional().isIn(['dine_in', 'takeaway', 'delivery'])
  ],
  validate,
  placeOrder
);

router.get('/', getOrders);
router.get('/:id', getOrderById);
router.get('/:id/invoice', getInvoice);

// Cancel (customer cancels own, admin cancels any)
router.patch('/:id/cancel', cancelOrder);

// Update status - admin, waiter, chef
router.patch('/:id/status',
  authorize('admin', 'waiter', 'chef'),
  [body('status').notEmpty().withMessage('Status is required')],
  validate,
  updateOrderStatus
);

module.exports = router;
