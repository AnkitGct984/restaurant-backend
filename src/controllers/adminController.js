const User = require('../models/User');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const MenuItem = require('../models/MenuItem');
const Reservation = require('../models/Reservation');
const Inventory = require('../models/Inventory');
const { AppError } = require('../middleware/errorHandler');

// @GET /api/admin/dashboard - Overview stats
const getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const [
      totalUsers, totalCustomers, totalStaff,
      todayOrders, todayRevenue,
      yesterdayRevenue,
      pendingOrders, activeOrders,
      totalMenuItems, availableItems,
      todayReservations, lowStockCount
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'customer', isActive: true }),
      User.countDocuments({ role: { $in: ['waiter', 'chef', 'admin'] }, isActive: true }),
      Order.countDocuments({ createdAt: { $gte: today } }),
      Payment.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: yesterday, $lt: today } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Order.countDocuments({ status: 'placed' }),
      Order.countDocuments({ status: { $in: ['confirmed', 'preparing', 'ready'] } }),
      MenuItem.countDocuments(),
      MenuItem.countDocuments({ isAvailable: true }),
      Reservation.countDocuments({ date: { $gte: today }, status: { $in: ['pending', 'confirmed'] } }),
      Inventory.countDocuments({ isLowStock: true })
    ]);

    const todayRev = todayRevenue[0]?.total || 0;
    const yestRev = yesterdayRevenue[0]?.total || 0;
    const revGrowth = yestRev > 0 ? (((todayRev - yestRev) / yestRev) * 100).toFixed(1) : 0;

    res.status(200).json({
      success: true,
      data: {
        users: { total: totalUsers, customers: totalCustomers, staff: totalStaff },
        orders: { today: todayOrders, pending: pendingOrders, active: activeOrders },
        revenue: { today: todayRev, yesterday: yestRev, growth: `${revGrowth}%` },
        menu: { total: totalMenuItems, available: availableItems },
        reservations: { todayTotal: todayReservations },
        inventory: { lowStockCount }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @GET /api/admin/sales-report
const getSalesReport = async (req, res, next) => {
  try {
    const { period = '7days', startDate, endDate } = req.query;

    let start, end = new Date();
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      const days = period === '30days' ? 30 : period === '90days' ? 90 : 7;
      start = new Date();
      start.setDate(start.getDate() - days);
    }

    const salesData = await Payment.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalRevenue: { $sum: '$amount' },
          totalTransactions: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    const ordersByType = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, status: 'completed' } },
      { $group: { _id: '$orderType', count: { $sum: 1 }, revenue: { $sum: '$grandTotal' } } }
    ]);

    const totalRevenue = salesData.reduce((sum, d) => sum + d.totalRevenue, 0);
    const totalTransactions = salesData.reduce((sum, d) => sum + d.totalTransactions, 0);

    res.status(200).json({
      success: true,
      data: { salesData, ordersByType, summary: { totalRevenue, totalTransactions, avgOrderValue: totalTransactions ? (totalRevenue / totalTransactions).toFixed(2) : 0 }, period: { start, end } }
    });
  } catch (error) {
    next(error);
  }
};

// @GET /api/admin/popular-dishes
const getPopularDishes = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const dishes = await MenuItem.find().sort({ totalOrdered: -1 }).limit(parseInt(limit))
      .select('name category price totalOrdered ratings image isAvailable');

    res.status(200).json({ success: true, data: { dishes } });
  } catch (error) {
    next(error);
  }
};

// @GET /api/admin/users
const getAllUsers = async (req, res, next) => {
  try {
    const { role, isActive, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(filter).select('-password -refreshToken').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: { users, pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) } }
    });
  } catch (error) {
    next(error);
  }
};

// @POST /api/admin/users/staff - Create staff
const createStaffUser = async (req, res, next) => {
  try {
    const { name, email, password, phone, role, employeeId, department, shift } = req.body;
    const allowedRoles = ['waiter', 'chef', 'admin'];
    if (!allowedRoles.includes(role)) return next(new AppError('Invalid staff role.', 400));

    const existing = await User.findOne({ email });
    if (existing) return next(new AppError('Email already exists.', 400));

    const user = await User.create({
      name, email, password, phone, role,
      employeeId, department, shift,
      isEmailVerified: true // Staff verified by admin
    });

    res.status(201).json({
      success: true,
      message: `${role} account created.`,
      data: { user: { _id: user._id, name, email, role } }
    });
  } catch (error) {
    next(error);
  }
};

// @PUT /api/admin/users/:id
const updateUser = async (req, res, next) => {
  try {
    const { name, phone, role, isActive, employeeId, department, shift } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, phone, role, isActive, employeeId, department, shift },
      { new: true, runValidators: true }
    ).select('-password -refreshToken');

    if (!user) return next(new AppError('User not found.', 404));
    res.status(200).json({ success: true, message: 'User updated.', data: { user } });
  } catch (error) {
    next(error);
  }
};

// @DELETE /api/admin/users/:id (soft delete)
const deactivateUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return next(new AppError('Cannot deactivate your own account.', 400));
    }
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!user) return next(new AppError('User not found.', 404));
    res.status(200).json({ success: true, message: 'User deactivated.' });
  } catch (error) {
    next(error);
  }
};

// @GET /api/admin/revenue-breakdown
const getRevenueBreakdown = async (req, res, next) => {
  try {
    const byMethod = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    const byCategory = await Order.aggregate([
      { $match: { status: 'completed' } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'menuitems', localField: 'items.menuItem', foreignField: '_id', as: 'menuDetails'
        }
      },
      { $unwind: '$menuDetails' },
      {
        $group: {
          _id: '$menuDetails.category',
          revenue: { $sum: '$items.subtotal' },
          count: { $sum: '$items.quantity' }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    res.status(200).json({ success: true, data: { byMethod, byCategory } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats, getSalesReport, getPopularDishes,
  getAllUsers, createStaffUser, updateUser, deactivateUser,
  getRevenueBreakdown
};
