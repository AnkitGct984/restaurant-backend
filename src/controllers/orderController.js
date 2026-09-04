const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Table = require('../models/Table');
const Notification = require('../models/Notification');
const Inventory = require('../models/Inventory');
const { AppError } = require('../middleware/errorHandler');
const { sendEmail, emailTemplates } = require('../config/email');

const GST = parseFloat(process.env.GST_PERCENTAGE || 18) / 100;
const SERVICE = parseFloat(process.env.SERVICE_CHARGE_PERCENTAGE || 5) / 100;

// Calculate pricing
const calculatePricing = (items, discountPercent = 0) => {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const gst = parseFloat((subtotal * GST).toFixed(2));
  const serviceCharge = parseFloat((subtotal * SERVICE).toFixed(2));
  const discount = parseFloat(((subtotal * discountPercent) / 100).toFixed(2));
  const grandTotal = parseFloat((subtotal + gst + serviceCharge - discount).toFixed(2));
  return { subtotal, gst, serviceCharge, discount, grandTotal };
};

// @POST /api/orders
const placeOrder = async (req, res, next) => {
  try {
    const { tableId, reservationId, items, orderType = 'dine_in', specialInstructions, deliveryAddress, discountCode } = req.body;

    // Validate items and get current prices
    const orderItems = [];
    for (const item of items) {
      const menuItem = await MenuItem.findById(item.menuItemId);
      if (!menuItem) return next(new AppError(`Menu item not found: ${item.menuItemId}`, 404));
      if (!menuItem.isAvailable) return next(new AppError(`${menuItem.name} is currently unavailable.`, 400));

      orderItems.push({
        menuItem: menuItem._id,
        name: menuItem.name,
        price: menuItem.discountPrice || menuItem.price,
        quantity: item.quantity,
        customization: item.customization || ''
      });
    }

    const pricing = calculatePricing(orderItems);

    const order = await Order.create({
      customer: req.user._id,
      table: tableId || null,
      reservation: reservationId || null,
      items: orderItems,
      orderType,
      specialInstructions,
      deliveryAddress,
      ...pricing,
      timeline: [{ status: 'placed', updatedBy: req.user._id }]
    });

    // Update table status
    if (tableId) {
      await Table.findByIdAndUpdate(tableId, { status: 'occupied', currentOrder: order._id });
    }

    // Update menu item stats
    for (const item of orderItems) {
      await MenuItem.findByIdAndUpdate(item.menuItem, { $inc: { totalOrdered: item.quantity } });
    }

    await order.populate('customer', 'name email');

    // Notification to customer
    await Notification.create({
      recipient: req.user._id,
      title: 'Order Placed! 🛒',
      message: `Your order #${order.orderId} has been placed. Total: ₹${order.grandTotal}`,
      type: 'order_placed',
      data: { orderId: order._id }
    });

    // Notify kitchen
    const io = req.app.get('io');
    io.to('kitchen').emit('order:new', { order });
    io.to('admin').emit('order:new', { order });
    io.to(req.user._id.toString()).emit('notification:new', { type: 'order_placed', order });

    // Email
    try {
      const template = emailTemplates.orderConfirmed({
        orderId: order.orderId,
        items: orderItems,
        grandTotal: order.grandTotal
      }, req.user.name);
      await sendEmail({ to: req.user.email, ...template });
    } catch (e) { console.error('Email error:', e.message); }

    res.status(201).json({ success: true, message: 'Order placed successfully!', data: { order } });
  } catch (error) {
    next(error);
  }
};

// @GET /api/orders
const getOrders = async (req, res, next) => {
  try {
    const { status, orderType, page = 1, limit = 10, startDate, endDate } = req.query;
    const filter = {};

    if (req.user.role === 'customer') filter.customer = req.user._id;
    if (status) filter.status = status;
    if (orderType) filter.orderType = orderType;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('customer', 'name email phone')
        .populate('table', 'tableNumber')
        .populate('items.menuItem', 'name image category')
        .sort({ createdAt: -1 })
        .skip(skip).limit(parseInt(limit)),
      Order.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: { orders, pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) } }
    });
  } catch (error) {
    next(error);
  }
};

// @GET /api/orders/:id
const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('table', 'tableNumber location')
      .populate('waiter', 'name')
      .populate('items.menuItem', 'name image category');

    if (!order) return next(new AppError('Order not found.', 404));

    if (req.user.role === 'customer' && order.customer._id.toString() !== req.user._id.toString()) {
      return next(new AppError('Not authorized.', 403));
    }

    res.status(200).json({ success: true, data: { order } });
  } catch (error) {
    next(error);
  }
};

// @PATCH /api/orders/:id/status
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body;
    const order = await Order.findById(req.params.id).populate('customer', 'name email');

    if (!order) return next(new AppError('Order not found.', 404));

    const allowedTransitions = {
      placed: ['confirmed', 'cancelled'],
      confirmed: ['preparing', 'cancelled'],
      preparing: ['ready'],
      ready: ['served'],
      served: ['completed'],
      completed: [],
      cancelled: []
    };

    if (!allowedTransitions[order.status].includes(status)) {
      return next(new AppError(`Cannot transition from '${order.status}' to '${status}'.`, 400));
    }

    order.status = status;
    order.timeline.push({ status, updatedBy: req.user._id, note });
    await order.save();

    // If completed, deduct inventory
    if (status === 'completed' && !order.isInventoryDeducted) {
      await deductInventory(order);
      order.isInventoryDeducted = true;
      await order.save();
    }

    // If table served/completed, free table
    if (['completed', 'cancelled'].includes(status) && order.table) {
      await Table.findByIdAndUpdate(order.table, { status: 'available', currentOrder: null });
    }

    // Notification
    const notifMap = {
      confirmed: { title: 'Order Confirmed ✅', type: 'order_confirmed' },
      preparing: { title: 'Order is Being Prepared 👨‍🍳', type: 'order_preparing' },
      ready: { title: 'Order Ready! 🍽️', type: 'order_ready' },
      served: { title: 'Order Served!', type: 'order_served' },
      completed: { title: 'Order Completed! ⭐', type: 'order_completed' },
      cancelled: { title: 'Order Cancelled ❌', type: 'order_cancelled' }
    };

    if (notifMap[status]) {
      await Notification.create({
        recipient: order.customer._id,
        title: notifMap[status].title,
        message: `Your order #${order.orderId} is ${status}.`,
        type: notifMap[status].type,
        data: { orderId: order._id }
      });
    }

    const io = req.app.get('io');
    io.to(order.customer._id.toString()).emit('order:statusUpdate', { orderId: order._id, status, orderId_str: order.orderId });
    io.to('kitchen').emit('order:statusUpdate', { orderId: order._id, status });
    io.to('admin').emit('order:statusUpdate', { orderId: order._id, status });

    res.status(200).json({ success: true, message: `Order status updated to '${status}'.`, data: { order } });
  } catch (error) {
    next(error);
  }
};

// @PATCH /api/orders/:id/cancel
const cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return next(new AppError('Order not found.', 404));

    if (req.user.role === 'customer' && order.customer.toString() !== req.user._id.toString()) {
      return next(new AppError('Not authorized.', 403));
    }

    if (!['placed', 'confirmed'].includes(order.status)) {
      return next(new AppError('Order cannot be cancelled at this stage.', 400));
    }

    order.status = 'cancelled';
    order.timeline.push({ status: 'cancelled', updatedBy: req.user._id, note: req.body.reason });
    await order.save();

    if (order.table) {
      await Table.findByIdAndUpdate(order.table, { status: 'available', currentOrder: null });
    }

    const io = req.app.get('io');
    io.to('kitchen').emit('order:cancelled', { orderId: order._id });

    res.status(200).json({ success: true, message: 'Order cancelled.', data: { order } });
  } catch (error) {
    next(error);
  }
};

// @GET /api/orders/:id/invoice
const getInvoice = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('table', 'tableNumber')
      .populate('items.menuItem', 'name category');

    if (!order) return next(new AppError('Order not found.', 404));

    const invoice = {
      invoiceNumber: `INV-${order.orderId}`,
      generatedAt: new Date(),
      customer: order.customer,
      table: order.table,
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.price * item.quantity,
        customization: item.customization
      })),
      subtotal: order.subtotal,
      gstPercentage: parseFloat(process.env.GST_PERCENTAGE || 18),
      gst: order.gst,
      serviceChargePercentage: parseFloat(process.env.SERVICE_CHARGE_PERCENTAGE || 5),
      serviceCharge: order.serviceCharge,
      discount: order.discount,
      grandTotal: order.grandTotal,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      orderDate: order.createdAt
    };

    res.status(200).json({ success: true, data: { invoice } });
  } catch (error) {
    next(error);
  }
};

// Helper: deduct inventory
const deductInventory = async (order) => {
  try {
    for (const item of order.items) {
      const menuItem = await MenuItem.findById(item.menuItem).populate('inventoryItems.item');
      if (menuItem?.inventoryItems?.length) {
        for (const inv of menuItem.inventoryItems) {
          const totalUsed = inv.quantityUsed * item.quantity;
          await Inventory.findByIdAndUpdate(inv.item._id, {
            $inc: { currentStock: -totalUsed },
            $push: {
              usageHistory: {
                quantity: totalUsed,
                usedFor: menuItem.name,
                orderId: order.orderId
              }
            }
          });
        }
      }
    }
  } catch (error) {
    console.error('Inventory deduction error:', error.message);
  }
};

module.exports = { placeOrder, getOrders, getOrderById, updateOrderStatus, cancelOrder, getInvoice };
