const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const orderItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true
  },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  customization: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'preparing', 'ready', 'served', 'cancelled'],
    default: 'pending'
  },
  subtotal: { type: Number }
}, { _id: true });

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true,
    default: () => 'ORD-' + uuidv4().substring(0, 8).toUpperCase()
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  table: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table'
  },
  reservation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reservation'
  },
  waiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  items: [orderItemSchema],
  orderType: {
    type: String,
    enum: ['dine_in', 'takeaway', 'delivery'],
    default: 'dine_in'
  },
  status: {
    type: String,
    enum: ['placed', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled'],
    default: 'placed'
  },

  // Pricing
  subtotal: { type: Number, required: true },
  gst: { type: Number, default: 0 },
  serviceCharge: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  discountCode: { type: String },
  grandTotal: { type: Number, required: true },

  // Payment
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'stripe', 'razorpay', 'wallet'],
    default: 'cash'
  },

  // Delivery info
  deliveryAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  estimatedDeliveryTime: { type: Date },

  // Timeline
  timeline: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: String
  }],

  specialInstructions: { type: String, maxlength: 500 },
  rating: { type: Number, min: 1, max: 5 },
  feedback: { type: String },
  isInventoryDeducted: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Pre-save: calculate subtotals
orderSchema.pre('save', function (next) {
  this.items.forEach(item => {
    item.subtotal = item.price * item.quantity;
  });
  next();
});

orderSchema.index({ customer: 1, status: 1 });
orderSchema.index({ orderId: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
