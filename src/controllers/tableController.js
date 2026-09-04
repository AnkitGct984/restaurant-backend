const Table = require('../models/Table');
const Reservation = require('../models/Reservation');
const { AppError } = require('../middleware/errorHandler');

// @GET /api/tables
const getAllTables = async (req, res, next) => {
  try {
    const { status, location, capacity } = req.query;
    const filter = { isActive: true };
    if (status) filter.status = status;
    if (location) filter.location = location;
    if (capacity) filter.capacity = { $gte: parseInt(capacity) };

    const tables = await Table.find(filter)
      .populate('currentOrder', 'orderId status grandTotal')
      .populate('currentReservation', 'bookingId customer date timeSlot')
      .sort({ tableNumber: 1 });

    res.status(200).json({ success: true, data: { tables, total: tables.length } });
  } catch (error) {
    next(error);
  }
};

// @GET /api/tables/availability - check availability for a date/time
const checkAvailability = async (req, res, next) => {
  try {
    const { date, timeSlot, guests } = req.query;
    if (!date || !timeSlot) return next(new AppError('Date and time slot are required.', 400));

    const reservationDate = new Date(date);

    // Find tables that are reserved at this time
    const reservedTableIds = await Reservation.distinct('table', {
      date: {
        $gte: new Date(reservationDate.setHours(0, 0, 0, 0)),
        $lte: new Date(reservationDate.setHours(23, 59, 59, 999))
      },
      timeSlot,
      status: { $in: ['pending', 'confirmed'] }
    });

    const filter = {
      isActive: true,
      status: { $ne: 'maintenance' },
      _id: { $nin: reservedTableIds }
    };
    if (guests) filter.capacity = { $gte: parseInt(guests) };

    const availableTables = await Table.find(filter).sort({ capacity: 1 });

    res.status(200).json({
      success: true,
      data: {
        availableTables,
        date, timeSlot,
        totalAvailable: availableTables.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// @GET /api/tables/:id
const getTableById = async (req, res, next) => {
  try {
    const table = await Table.findById(req.params.id)
      .populate('currentOrder')
      .populate('currentReservation');
    if (!table) return next(new AppError('Table not found.', 404));
    res.status(200).json({ success: true, data: { table } });
  } catch (error) {
    next(error);
  }
};

// @POST /api/tables - Admin
const createTable = async (req, res, next) => {
  try {
    const table = await Table.create(req.body);
    res.status(201).json({ success: true, message: 'Table created.', data: { table } });
  } catch (error) {
    next(error);
  }
};

// @PUT /api/tables/:id - Admin
const updateTable = async (req, res, next) => {
  try {
    const table = await Table.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!table) return next(new AppError('Table not found.', 404));
    res.status(200).json({ success: true, message: 'Table updated.', data: { table } });
  } catch (error) {
    next(error);
  }
};

// @PATCH /api/tables/:id/status - Admin/Waiter
const updateTableStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const table = await Table.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!table) return next(new AppError('Table not found.', 404));

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('table:statusUpdate', { tableId: table._id, tableNumber: table.tableNumber, status });

    res.status(200).json({ success: true, message: 'Table status updated.', data: { table } });
  } catch (error) {
    next(error);
  }
};

// @DELETE /api/tables/:id - Admin
const deleteTable = async (req, res, next) => {
  try {
    const table = await Table.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!table) return next(new AppError('Table not found.', 404));
    res.status(200).json({ success: true, message: 'Table removed.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllTables, checkAvailability, getTableById,
  createTable, updateTable, updateTableStatus, deleteTable
};
