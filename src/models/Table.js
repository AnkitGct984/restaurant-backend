const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  tableNumber: {
    type: Number,
    required: true,
    unique: true
  },
  capacity: {
    type: Number,
    required: [true, 'Capacity is required'],
    min: [1, 'Capacity must be at least 1']
  },
  location: {
    type: String,
    enum: ['indoor', 'outdoor', 'rooftop', 'private', 'bar'],
    default: 'indoor'
  },
  status: {
    type: String,
    enum: ['available', 'occupied', 'reserved', 'maintenance'],
    default: 'available'
  },
  isActive: { type: Boolean, default: true },
  currentOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  currentReservation: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', default: null },
  features: [{
    type: String,
    enum: ['window_view', 'near_stage', 'private', 'accessible', 'booth']
  }],
  description: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.model('Table', tableSchema);
