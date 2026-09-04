const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const paymentSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    unique: true,
    default: () => 'PAY-' + uuidv4().substring(0, 10).toUpperCase()
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  method: {
    type: String,
    enum: ['cash', 'card', 'upi', 'stripe', 'razorpay', 'wallet'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'partially_refunded'],
    default: 'pending'
  },

  // Gateway specific
  gatewayOrderId: { type: String },       // Razorpay/Stripe order ID
  gatewayPaymentId: { type: String },     // Razorpay/Stripe payment ID
  gatewaySignature: { type: String },     // Razorpay signature

  // Invoice breakdown
  invoice: {
    subtotal: Number,
    gst: Number,
    serviceCharge: Number,
    discount: Number,
    grandTotal: Number,
    generatedAt: { type: Date, default: Date.now }
  },

  refundAmount: { type: Number, default: 0 },
  refundReason: { type: String },
  refundedAt: { type: Date },
  notes: { type: String },
  receiptUrl: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);
