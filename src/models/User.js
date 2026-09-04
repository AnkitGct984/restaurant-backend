const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['customer', 'waiter', 'chef', 'admin'],
    default: 'customer'
  },
  avatar: {
    url: { type: String, default: '' },
    publicId: { type: String, default: '' }
  },
  isEmailVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },

  // OTP fields
  emailOtp: { type: String, select: false },
  emailOtpExpire: { type: Date, select: false },
  passwordResetOtp: { type: String, select: false },
  passwordResetOtpExpire: { type: Date, select: false },

  // Refresh token
  refreshToken: { type: String, select: false },

  // Customer specific
  loyaltyPoints: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },

  // Staff specific
  employeeId: { type: String },
  department: { type: String },
  shift: {
    type: String,
    enum: ['morning', 'afternoon', 'evening', 'night']
  }
}, {
  timestamps: true
});

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate OTP
userSchema.methods.generateOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expireMinutes = parseInt(process.env.OTP_EXPIRE_MINUTES) || 10;
  return { otp, expireAt: new Date(Date.now() + expireMinutes * 60 * 1000) };
};

module.exports = mongoose.model('User', userSchema);
