const User = require('../models/User');
const Order = require('../models/Order');
const { AppError } = require('../middleware/errorHandler');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

// @GET /api/users/profile
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

// @PUT /api/users/profile
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id, { name, phone }, { new: true, runValidators: true }
    );
    res.status(200).json({ success: true, message: 'Profile updated.', data: { user } });
  } catch (error) {
    next(error);
  }
};

// @POST /api/users/avatar
const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No image uploaded.', 400));
    const user = await User.findById(req.user._id);

    // Delete old avatar
    if (user.avatar?.publicId) await deleteFromCloudinary(user.avatar.publicId);

    const { url, publicId } = await uploadToCloudinary(req.file.path, 'restaurant/avatars');
    user.avatar = { url, publicId };
    await user.save();

    res.status(200).json({ success: true, message: 'Avatar updated.', data: { avatar: user.avatar } });
  } catch (error) {
    next(error);
  }
};

// @GET /api/users/order-history
const getOrderHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      Order.find({ customer: req.user._id })
        .populate('items.menuItem', 'name image')
        .populate('table', 'tableNumber')
        .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Order.countDocuments({ customer: req.user._id })
    ]);

    res.status(200).json({
      success: true,
      data: { orders, pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) } }
    });
  } catch (error) {
    next(error);
  }
};

// @GET /api/users/loyalty
const getLoyaltyInfo = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('loyaltyPoints totalOrders totalSpent');
    const nextTier = user.loyaltyPoints < 500 ? { name: 'Silver', pointsNeeded: 500 - user.loyaltyPoints } :
      user.loyaltyPoints < 1000 ? { name: 'Gold', pointsNeeded: 1000 - user.loyaltyPoints } :
        user.loyaltyPoints < 2000 ? { name: 'Platinum', pointsNeeded: 2000 - user.loyaltyPoints } : null;

    const tier = user.loyaltyPoints >= 2000 ? 'Platinum' :
      user.loyaltyPoints >= 1000 ? 'Gold' :
        user.loyaltyPoints >= 500 ? 'Silver' : 'Bronze';

    res.status(200).json({
      success: true,
      data: {
        loyaltyPoints: user.loyaltyPoints,
        totalOrders: user.totalOrders,
        totalSpent: user.totalSpent,
        tier, nextTier
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile, uploadAvatar, getOrderHistory, getLoyaltyInfo };
