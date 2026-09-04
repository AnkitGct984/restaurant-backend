const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: [
      'order_placed', 'order_confirmed', 'order_preparing', 'order_ready',
      'order_served', 'order_completed', 'order_cancelled',
      'reservation_confirmed', 'reservation_cancelled', 'reservation_reminder',
      'payment_success', 'payment_failed', 'payment_refunded',
      'low_inventory', 'new_order_kitchen', 'general'
    ],
    required: true
  },
  data: { type: mongoose.Schema.Types.Mixed }, // any extra data
  isRead: { type: Boolean, default: false },
  readAt: { type: Date }
}, {
  timestamps: true
});

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
