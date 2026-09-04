const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Food name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['starter', 'main_course', 'dessert', 'beverage', 'soup', 'salad', 'bread', 'combo', 'special']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  discountPrice: {
    type: Number,
    default: null
  },
  image: {
    url: { type: String, default: '' },
    publicId: { type: String, default: '' }
  },
  isAvailable: { type: Boolean, default: true },
  isVegetarian: { type: Boolean, default: false },
  isVegan: { type: Boolean, default: false },
  isGlutenFree: { type: Boolean, default: false },
  spiceLevel: {
    type: String,
    enum: ['none', 'mild', 'medium', 'hot', 'extra_hot'],
    default: 'none'
  },
  preparationTime: {
    type: Number, // in minutes
    default: 15
  },
  calories: { type: Number },
  allergens: [{ type: String }],
  ingredients: [{ type: String }],
  tags: [{ type: String }],

  // Inventory link
  inventoryItems: [{
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
    quantityUsed: { type: Number, default: 1 }
  }],

  // Ratings
  ratings: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  reviews: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],

  // Analytics
  totalOrdered: { type: Number, default: 0 },
  isPopular: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

// Virtual for effective price
menuItemSchema.virtual('effectivePrice').get(function () {
  return this.discountPrice || this.price;
});

module.exports = mongoose.model('MenuItem', menuItemSchema);
