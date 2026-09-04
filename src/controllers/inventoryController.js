const Inventory = require('../models/Inventory');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');

// @GET /api/inventory
const getAllInventory = async (req, res, next) => {
  try {
    const { category, isLowStock, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (isLowStock === 'true') filter.isLowStock = true;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [items, total] = await Promise.all([
      Inventory.find(filter).sort({ name: 1 }).skip(skip).limit(parseInt(limit)),
      Inventory.countDocuments(filter)
    ]);

    const totalValue = items.reduce((sum, i) => sum + (i.totalValue || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        items, totalValue,
        pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @GET /api/inventory/:id
const getInventoryItem = async (req, res, next) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) return next(new AppError('Inventory item not found.', 404));
    res.status(200).json({ success: true, data: { item } });
  } catch (error) {
    next(error);
  }
};

// @POST /api/inventory
const createInventoryItem = async (req, res, next) => {
  try {
    const item = await Inventory.create(req.body);
    res.status(201).json({ success: true, message: 'Inventory item created.', data: { item } });
  } catch (error) {
    next(error);
  }
};

// @PUT /api/inventory/:id
const updateInventoryItem = async (req, res, next) => {
  try {
    const item = await Inventory.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return next(new AppError('Item not found.', 404));
    res.status(200).json({ success: true, message: 'Inventory item updated.', data: { item } });
  } catch (error) {
    next(error);
  }
};

// @POST /api/inventory/:id/restock - Add stock (purchase)
const restockItem = async (req, res, next) => {
  try {
    const { quantity, pricePerUnit, supplier, invoiceNumber } = req.body;
    const item = await Inventory.findById(req.params.id);
    if (!item) return next(new AppError('Inventory item not found.', 404));

    item.currentStock += quantity;
    item.purchaseHistory.push({
      quantity,
      pricePerUnit,
      totalCost: quantity * pricePerUnit,
      supplier,
      invoiceNumber,
      purchasedBy: req.user._id
    });
    await item.save();

    // Remove low stock notification if now above minimum
    if (!item.isLowStock) {
      const io = req.app.get('io');
      io.to('admin').emit('inventory:restocked', { itemId: item._id, name: item.name, currentStock: item.currentStock });
    }

    res.status(200).json({ success: true, message: `Restocked ${quantity} ${item.unit} of ${item.name}.`, data: { item } });
  } catch (error) {
    next(error);
  }
};

// @DELETE /api/inventory/:id
const deleteInventoryItem = async (req, res, next) => {
  try {
    const item = await Inventory.findByIdAndDelete(req.params.id);
    if (!item) return next(new AppError('Item not found.', 404));
    res.status(200).json({ success: true, message: 'Inventory item deleted.' });
  } catch (error) {
    next(error);
  }
};

// @GET /api/inventory/alerts/low-stock
const getLowStockAlerts = async (req, res, next) => {
  try {
    const lowStockItems = await Inventory.find({ isLowStock: true }).sort({ currentStock: 1 });
    res.status(200).json({
      success: true,
      data: { items: lowStockItems, count: lowStockItems.length }
    });
  } catch (error) {
    next(error);
  }
};

// Cron-friendly: notify admins about low stock
const checkAndNotifyLowStock = async (io) => {
  try {
    const lowStockItems = await Inventory.find({ isLowStock: true });
    if (lowStockItems.length === 0) return;

    const admins = await User.find({ role: 'admin', isActive: true });
    for (const admin of admins) {
      await Notification.create({
        recipient: admin._id,
        title: '⚠️ Low Stock Alert',
        message: `${lowStockItems.length} item(s) are running low on stock.`,
        type: 'low_inventory',
        data: { items: lowStockItems.map(i => ({ name: i.name, stock: i.currentStock, unit: i.unit })) }
      });
    }

    if (io) io.to('admin').emit('inventory:lowStock', { items: lowStockItems });
  } catch (error) {
    console.error('Low stock check error:', error.message);
  }
};

module.exports = {
  getAllInventory, getInventoryItem, createInventoryItem,
  updateInventoryItem, restockItem, deleteInventoryItem,
  getLowStockAlerts, checkAndNotifyLowStock
};
