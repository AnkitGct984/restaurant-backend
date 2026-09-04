const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize, optionalProtect } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const {
  getAllMenuItems, getMenuItemById, getCategories,
  createMenuItem, updateMenuItem, deleteMenuItem,
  toggleAvailability, addReview
} = require('../controllers/menuController');

// Public routes
router.get('/', getAllMenuItems);
router.get('/categories', getCategories);
router.get('/:id', getMenuItemById);

// Protected routes
router.use(protect);

// Admin only
router.post('/',
  authorize('admin'),
  upload.single('image'),
  [
    body('name').trim().notEmpty().withMessage('Food name is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('price').isFloat({ min: 0 }).withMessage('Valid price is required'),
    body('description').trim().notEmpty().withMessage('Description is required')
  ],
  validate,
  createMenuItem
);

router.put('/:id',
  authorize('admin'),
  upload.single('image'),
  updateMenuItem
);

router.delete('/:id', authorize('admin'), deleteMenuItem);

// Admin + Waiter
router.patch('/:id/availability', authorize('admin', 'waiter'), toggleAvailability);

// Customer: add review
router.post('/:id/review',
  authorize('customer'),
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('comment').optional().isLength({ max: 500 })
  ],
  validate,
  addReview
);

module.exports = router;
