const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getKitchenOrders, updateItemStatus, markOrderReady, getKitchenStats
} = require('../controllers/kitchenController');

router.use(protect, authorize('admin', 'chef', 'waiter'));

router.get('/orders', getKitchenOrders);
router.get('/stats', getKitchenStats);
router.patch('/orders/:id/item-status', updateItemStatus);
router.patch('/orders/:id/ready', markOrderReady);

module.exports = router;
