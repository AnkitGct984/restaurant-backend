const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Ingredient name is required'],
    trim: true,
    unique: true
  },
  category: {
    type: String,
    enum: ['vegetable', 'fruit', 'meat', 'seafood', 'dairy', 'grain', 'spice', 'beverage', 'oil', 'other'],
    required: true
  },
  unit: {
    type: String,
    enum: ['kg', 'g', 'l', 'ml', 'piece', 'dozen', 'pack', 'box'],
    required: true
  },
  currentStock: {
    type: Number,
    required: true,
    min: [0, 'Stock cannot be negative']
  },
  minimumStock: {
    type: Number,
    required: true,
    default: 10
  },
  maximumStock: { type: Number },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalValue: { type: Number },

  // Supplier info
  supplier: {
    name: { type: String },
    contactPerson: { type: String },
    phone: { type: String },
    email: { type: String },
    address: { type: String }
  },

  // Purchase orders
  purchaseHistory: [{
    quantity: Number,
    pricePerUnit: Number,
    totalCost: Number,
    supplier: String,
    purchasedAt: { type: Date, default: Date.now },
    purchasedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    invoiceNumber: String
  }],

  // Usage history
  usageHistory: [{
    quantity: Number,
    usedFor: String,
    usedAt: { type: Date, default: Date.now },
    orderId: String
  }],

  isLowStock: { type: Boolean, default: false },
  expiryDate: { type: Date },
  storageLocation: { type: String },
  notes: { type: String }
}, {
  timestamps: true
});

// Auto-calculate totalValue and isLowStock
inventorySchema.pre('save', function (next) {
  this.totalValue = this.currentStock * this.unitPrice;
  this.isLowStock = this.currentStock <= this.minimumStock;
  next();
});

module.exports = mongoose.model('Inventory', inventorySchema);
