const Stripe = require('stripe');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const { AppError } = require('../middleware/errorHandler');
const { sendEmail, emailTemplates } = require('../config/email');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ── STRIPE ──────────────────────────────────────────────

// @POST /api/payments/stripe/create-intent
const createStripePaymentIntent = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId).populate('customer', 'name email');
    if (!order) return next(new AppError('Order not found.', 404));
    if (order.paymentStatus === 'paid') return next(new AppError('Order already paid.', 400));

    const amountInPaise = Math.round(order.grandTotal * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInPaise,
      currency: 'inr',
      metadata: {
        orderId: order.orderId,
        customerId: req.user._id.toString()
      },
      description: `Restaurant Order #${order.orderId}`
    });

    res.status(200).json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: order.grandTotal
      }
    });
  } catch (error) {
    next(error);
  }
};

// @POST /api/payments/stripe/confirm
const confirmStripePayment = async (req, res, next) => {
  try {
    const { orderId, paymentIntentId } = req.body;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      return next(new AppError('Payment not successful.', 400));
    }

    const order = await Order.findById(orderId).populate('customer', 'name email');
    if (!order) return next(new AppError('Order not found.', 404));

    const payment = await Payment.create({
      order: orderId,
      customer: req.user._id,
      amount: order.grandTotal,
      method: 'stripe',
      status: 'completed',
      gatewayPaymentId: paymentIntentId,
      invoice: {
        subtotal: order.subtotal,
        gst: order.gst,
        serviceCharge: order.serviceCharge,
        discount: order.discount,
        grandTotal: order.grandTotal
      }
    });

    await Order.findByIdAndUpdate(orderId, {
      paymentStatus: 'paid',
      paymentMethod: 'stripe'
    });

    await _postPaymentActions(order, payment, req);

    res.status(200).json({ success: true, message: 'Payment successful!', data: { payment } });
  } catch (error) {
    next(error);
  }
};

// ── RAZORPAY ─────────────────────────────────────────────

// @POST /api/payments/razorpay/create-order
const createRazorpayOrder = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return next(new AppError('Order not found.', 404));
    if (order.paymentStatus === 'paid') return next(new AppError('Order already paid.', 400));

    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(order.grandTotal * 100),
      currency: 'INR',
      receipt: order.orderId,
      notes: { orderId: order.orderId, customerId: req.user._id.toString() }
    });

    res.status(200).json({
      success: true,
      data: {
        rzpOrderId: rzpOrder.id,
        amount: order.grandTotal,
        currency: 'INR',
        key: process.env.RAZORPAY_KEY_ID
      }
    });
  } catch (error) {
    next(error);
  }
};

// @POST /api/payments/razorpay/verify
const verifyRazorpayPayment = async (req, res, next) => {
  try {
    const { orderId, rzpOrderId, rzpPaymentId, rzpSignature } = req.body;

    // Verify signature
    const body = rzpOrderId + '|' + rzpPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== rzpSignature) {
      return next(new AppError('Invalid payment signature. Payment verification failed.', 400));
    }

    const order = await Order.findById(orderId).populate('customer', 'name email');
    if (!order) return next(new AppError('Order not found.', 404));

    const payment = await Payment.create({
      order: orderId,
      customer: req.user._id,
      amount: order.grandTotal,
      method: 'razorpay',
      status: 'completed',
      gatewayOrderId: rzpOrderId,
      gatewayPaymentId: rzpPaymentId,
      gatewaySignature: rzpSignature,
      invoice: {
        subtotal: order.subtotal,
        gst: order.gst,
        serviceCharge: order.serviceCharge,
        discount: order.discount,
        grandTotal: order.grandTotal
      }
    });

    await Order.findByIdAndUpdate(orderId, {
      paymentStatus: 'paid',
      paymentMethod: 'razorpay'
    });

    await _postPaymentActions(order, payment, req);

    res.status(200).json({ success: true, message: 'Payment verified successfully!', data: { payment } });
  } catch (error) {
    next(error);
  }
};

// @POST /api/payments/cash - Admin/Waiter mark as cash paid
const markCashPayment = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId).populate('customer', 'name email');
    if (!order) return next(new AppError('Order not found.', 404));
    if (order.paymentStatus === 'paid') return next(new AppError('Already paid.', 400));

    const payment = await Payment.create({
      order: orderId,
      customer: order.customer._id,
      amount: order.grandTotal,
      method: 'cash',
      status: 'completed',
      invoice: {
        subtotal: order.subtotal,
        gst: order.gst,
        serviceCharge: order.serviceCharge,
        discount: order.discount,
        grandTotal: order.grandTotal
      }
    });

    await Order.findByIdAndUpdate(orderId, { paymentStatus: 'paid', paymentMethod: 'cash' });
    await _postPaymentActions(order, payment, req);

    res.status(200).json({ success: true, message: 'Cash payment recorded.', data: { payment } });
  } catch (error) {
    next(error);
  }
};

// @GET /api/payments
const getPayments = async (req, res, next) => {
  try {
    const filter = req.user.role === 'customer' ? { customer: req.user._id } : {};
    const { status, method, page = 1, limit = 10 } = req.query;
    if (status) filter.status = status;
    if (method) filter.method = method;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate('order', 'orderId items grandTotal status')
        .populate('customer', 'name email')
        .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Payment.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: { payments, pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) } }
    });
  } catch (error) {
    next(error);
  }
};

// @POST /api/payments/:id/refund - Admin
const initiateRefund = async (req, res, next) => {
  try {
    const { reason, amount } = req.body;
    const payment = await Payment.findById(req.params.id);
    if (!payment) return next(new AppError('Payment not found.', 404));
    if (payment.status !== 'completed') return next(new AppError('Only completed payments can be refunded.', 400));

    const refundAmount = amount || payment.amount;

    if (payment.method === 'stripe') {
      await stripe.refunds.create({
        payment_intent: payment.gatewayPaymentId,
        amount: Math.round(refundAmount * 100)
      });
    } else if (payment.method === 'razorpay') {
      await razorpay.payments.refund(payment.gatewayPaymentId, { amount: Math.round(refundAmount * 100) });
    }

    payment.status = refundAmount >= payment.amount ? 'refunded' : 'partially_refunded';
    payment.refundAmount = refundAmount;
    payment.refundReason = reason;
    payment.refundedAt = new Date();
    await payment.save();

    await Order.findByIdAndUpdate(payment.order, { paymentStatus: 'refunded' });

    res.status(200).json({ success: true, message: 'Refund initiated.', data: { payment } });
  } catch (error) {
    next(error);
  }
};

// Shared post-payment actions
const _postPaymentActions = async (order, payment, req) => {
  try {
    await Notification.create({
      recipient: order.customer._id,
      title: 'Payment Successful! 💳',
      message: `Payment of ₹${payment.amount} for order #${order.orderId} received.`,
      type: 'payment_success',
      data: { paymentId: payment._id, orderId: order._id }
    });

    const io = req.app.get('io');
    io.to(order.customer._id.toString()).emit('payment:success', { orderId: order.orderId, amount: payment.amount });

    const template = emailTemplates.paymentSuccess({
      amount: payment.amount,
      transactionId: payment.transactionId,
      orderId: order.orderId
    }, order.customer.name);
    await sendEmail({ to: order.customer.email, ...template });
  } catch (e) {
    console.error('Post-payment actions error:', e.message);
  }
};

module.exports = {
  createStripePaymentIntent, confirmStripePayment,
  createRazorpayOrder, verifyRazorpayPayment,
  markCashPayment, getPayments, initiateRefund
};
