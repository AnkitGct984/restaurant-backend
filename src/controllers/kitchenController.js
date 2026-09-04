const Order = require('../models/Order');
const { AppError } = require('../middleware/errorHandler');

// @GET /api/kitchen/orders - Active kitchen orders
const getKitchenOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({
      status: { $in: ['placed', 'confirmed', 'preparing'] }
    })
      .populate('customer', 'name')
      .populate('table', 'tableNumber')
      .populate('items.menuItem', 'name category preparationTime')
      .sort({ createdAt: 1 }); // oldest first

    res.status(200).json({ success: true, data: { orders, count: orders.length } });
  } catch (error) {
    next(error);
  }
};

// @PATCH /api/kitchen/orders/:id/item-status - Update individual item status
const updateItemStatus = async (req, res, next) => {
  try {
    const { itemId, status } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return next(new AppError('Order not found.', 404));

    const item = order.items.id(itemId);
    if (!item) return next(new AppError('Item not found.', 404));

    item.status = status;
    await order.save();

    // Auto-update order status based on items
    const allReady = order.items.every(i => i.status === 'ready');
    const anyPreparing = order.items.some(i => i.status === 'preparing');

    if (allReady) {
      order.status = 'ready';
      order.timeline.push({ status: 'ready', updatedBy: req.user._id });
      await order.save();
    } else if (anyPreparing && order.status === 'confirmed') {
      order.status = 'preparing';
      order.timeline.push({ status: 'preparing', updatedBy: req.user._id });
      await order.save();
    }

    const io = req.app.get('io');
    io.to('kitchen').emit('kitchen:itemUpdate', { orderId: order._id, itemId, status, orderStatus: order.status });
    io.to(order.customer.toString()).emit('order:statusUpdate', { orderId: order._id, status: order.status });

    res.status(200).json({ success: true, message: 'Item status updated.', data: { order } });
  } catch (error) {
    next(error);
  }
};

// @PATCH /api/kitchen/orders/:id/ready
const markOrderReady = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('customer', 'name');
    if (!order) return next(new AppError('Order not found.', 404));

    order.status = 'ready';
    order.items.forEach(item => { if (item.status !== 'cancelled') item.status = 'ready'; });
    order.timeline.push({ status: 'ready', updatedBy: req.user._id });
    await order.save();

    const io = req.app.get('io');
    io.to('waiter').emit('order:ready', { orderId: order._id, orderId_str: order.orderId, tableId: order.table });
    io.to(order.customer._id.toString()).emit('order:statusUpdate', {
      orderId: order._id, status: 'ready', message: 'Your order is ready! 🍽️'
    });

    res.status(200).json({ success: true, message: 'Order marked as ready.', data: { order } });
  } catch (error) {
    next(error);
  }
};

// @GET /api/kitchen/stats
const getKitchenStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pending, preparing, ready, completedToday] = await Promise.all([
      Order.countDocuments({ status: 'placed' }),
      Order.countDocuments({ status: { $in: ['confirmed', 'preparing'] } }),
      Order.countDocuments({ status: 'ready' }),
      Order.countDocuments({ status: 'completed', createdAt: { $gte: today } })
    ]);

    res.status(200).json({
      success: true,
      data: { stats: { pending, preparing, ready, completedToday } }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getKitchenOrders, updateItemStatus, markOrderReady, getKitchenStats };
