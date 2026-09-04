const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const reservationSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    unique: true,
    default: () => 'RES-' + uuidv4().substring(0, 8).toUpperCase()
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  table: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table',
    required: true
  },
  date: {
    type: Date,
    required: [true, 'Reservation date is required']
  },
  timeSlot: {
    type: String,
    required: [true, 'Time slot is required'],
    // e.g. "19:00 - 21:00"
  },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  guests: {
    type: Number,
    required: [true, 'Number of guests is required'],
    min: [1, 'At least 1 guest is required']
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'],
    default: 'pending'
  },
  specialRequests: { type: String, maxlength: 500 },
  occasion: {
    type: String,
    enum: ['none', 'birthday', 'anniversary', 'business', 'romantic', 'other'],
    default: 'none'
  },
  depositPaid: { type: Boolean, default: false },
  depositAmount: { type: Number, default: 0 },
  cancellationReason: { type: String },
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reminderSent: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Index for quick lookup
reservationSchema.index({ date: 1, table: 1 });
reservationSchema.index({ customer: 1, status: 1 });

module.exports = mongoose.model('Reservation', reservationSchema);
