const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAllTables, checkAvailability, getTableById,
  createTable, updateTable, updateTableStatus, deleteTable
} = require('../controllers/tableController');

// Public - check availability for reservation
router.get('/availability', checkAvailability);
router.get('/', protect, getAllTables);
router.get('/:id', protect, getTableById);

// Admin routes
router.use(protect, authorize('admin'));
router.post('/', createTable);
router.put('/:id', updateTable);
router.delete('/:id', deleteTable);

// Admin + Waiter
router.patch('/:id/status', protect, authorize('admin', 'waiter'), updateTableStatus);

module.exports = router;
