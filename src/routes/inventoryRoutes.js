const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const {
  getAllInventory, getInventoryItem, createInventoryItem,
  updateInventoryItem, restockItem, deleteInventoryItem,
  getLowStockAlerts
} = require('../controllers/inventoryController');

router.use(protect, authorize('admin', 'chef'));

router.get('/', getAllInventory);
router.get('/alerts/low-stock', getLowStockAlerts);
router.get('/:id', getInventoryItem);

router.post('/',
  authorize('admin'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('unit').notEmpty().withMessage('Unit is required'),
    body('currentStock').isFloat({ min: 0 }).withMessage('Valid stock quantity required'),
    body('minimumStock').isFloat({ min: 0 }).withMessage('Minimum stock required'),
    body('unitPrice').isFloat({ min: 0 }).withMessage('Valid unit price required')
  ],
  validate,
  createInventoryItem
);

router.put('/:id', authorize('admin'), updateInventoryItem);
router.delete('/:id', authorize('admin'), deleteInventoryItem);

// Restock - admin or chef
router.post('/:id/restock',
  [
    body('quantity').isFloat({ min: 0.1 }).withMessage('Quantity must be positive'),
    body('pricePerUnit').isFloat({ min: 0 }).withMessage('Valid price required')
  ],
  validate,
  restockItem
);

module.exports = router;
