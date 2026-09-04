const MenuItem = require('../models/MenuItem');
const { AppError } = require('../middleware/errorHandler');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

// @GET /api/menu - Public
const getAllMenuItems = async (req, res, next) => {
  try {
    const {
      category, isAvailable, isVegetarian, isVegan, isGlutenFree,
      minPrice, maxPrice, search, sortBy = 'createdAt', order = 'desc',
      page = 1, limit = 20, featured, popular
    } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (isAvailable !== undefined) filter.isAvailable = isAvailable === 'true';
    if (isVegetarian === 'true') filter.isVegetarian = true;
    if (isVegan === 'true') filter.isVegan = true;
    if (isGlutenFree === 'true') filter.isGlutenFree = true;
    if (featured === 'true') filter.isFeatured = true;
    if (popular === 'true') filter.isPopular = true;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortObj = { [sortBy]: sortOrder };

    const [items, total] = await Promise.all([
      MenuItem.find(filter).sort(sortObj).skip(skip).limit(parseInt(limit)),
      MenuItem.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: {
        items,
        pagination: {
          total, page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @GET /api/menu/:id
const getMenuItemById = async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id).populate('reviews.user', 'name avatar');
    if (!item) return next(new AppError('Menu item not found.', 404));
    res.status(200).json({ success: true, data: { item } });
  } catch (error) {
    next(error);
  }
};

// @GET /api/menu/categories
const getCategories = async (req, res, next) => {
  try {
    const categories = await MenuItem.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 }, avgPrice: { $avg: '$price' } } },
      { $sort: { count: -1 } }
    ]);
    res.status(200).json({ success: true, data: { categories } });
  } catch (error) {
    next(error);
  }
};

// @POST /api/menu - Admin
const createMenuItem = async (req, res, next) => {
  try {
    const itemData = { ...req.body, createdBy: req.user._id };

    // Handle image upload
    if (req.file) {
      const { url, publicId } = await uploadToCloudinary(req.file.path, 'restaurant/menu');
      itemData.image = { url, publicId };
    }

    const item = await MenuItem.create(itemData);
    res.status(201).json({ success: true, message: 'Menu item created successfully.', data: { item } });
  } catch (error) {
    next(error);
  }
};

// @PUT /api/menu/:id - Admin
const updateMenuItem = async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return next(new AppError('Menu item not found.', 404));

    const updateData = { ...req.body };

    if (req.file) {
      // Delete old image
      if (item.image?.publicId) await deleteFromCloudinary(item.image.publicId);
      const { url, publicId } = await uploadToCloudinary(req.file.path, 'restaurant/menu');
      updateData.image = { url, publicId };
    }

    const updated = await MenuItem.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    res.status(200).json({ success: true, message: 'Menu item updated.', data: { item: updated } });
  } catch (error) {
    next(error);
  }
};

// @DELETE /api/menu/:id - Admin
const deleteMenuItem = async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return next(new AppError('Menu item not found.', 404));
    if (item.image?.publicId) await deleteFromCloudinary(item.image.publicId);
    await item.deleteOne();
    res.status(200).json({ success: true, message: 'Menu item deleted.' });
  } catch (error) {
    next(error);
  }
};

// @PATCH /api/menu/:id/availability - Admin/Waiter
const toggleAvailability = async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return next(new AppError('Menu item not found.', 404));
    item.isAvailable = !item.isAvailable;
    await item.save();
    res.status(200).json({
      success: true,
      message: `Item is now ${item.isAvailable ? 'available' : 'unavailable'}.`,
      data: { isAvailable: item.isAvailable }
    });
  } catch (error) {
    next(error);
  }
};

// @POST /api/menu/:id/review - Customer
const addReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const item = await MenuItem.findById(req.params.id);
    if (!item) return next(new AppError('Menu item not found.', 404));

    // Remove old review if any
    item.reviews = item.reviews.filter(r => r.user.toString() !== req.user._id.toString());
    item.reviews.push({ user: req.user._id, rating, comment });

    // Recalculate average
    item.ratings.count = item.reviews.length;
    item.ratings.average = item.reviews.reduce((acc, r) => acc + r.rating, 0) / item.ratings.count;
    await item.save();

    res.status(200).json({ success: true, message: 'Review added.', data: { ratings: item.ratings } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllMenuItems, getMenuItemById, getCategories,
  createMenuItem, updateMenuItem, deleteMenuItem,
  toggleAvailability, addReview
};
