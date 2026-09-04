const Reservation = require('../models/Reservation');
const Table = require('../models/Table');
const Notification = require('../models/Notification');
const { AppError } = require('../middleware/errorHandler');
const { sendEmail, emailTemplates } = require('../config/email');

// @POST /api/reservations - Customer
const createReservation = async (req, res, next) => {
  try {
    const { tableId, date, startTime, endTime, guests, specialRequests, occasion } = req.body;

    const table = await Table.findById(tableId);
    if (!table) return next(new AppError('Table not found.', 404));
    if (!table.isActive) return next(new AppError('Table is not available.', 400));
    if (table.capacity < guests) {
      return next(new AppError(`Table capacity is ${table.capacity}. Cannot accommodate ${guests} guests.`, 400));
    }

    const reservationDate = new Date(date);
    const timeSlot = `${startTime} - ${endTime}`;

    // Check for conflicts
    const conflict = await Reservation.findOne({
      table: tableId,
      date: {
        $gte: new Date(reservationDate.setHours(0, 0, 0, 0)),
        $lte: new Date(reservationDate.setHours(23, 59, 59, 999))
      },
      timeSlot,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (conflict) return next(new AppError('This table is already reserved for the selected time slot.', 409));

    const reservation = await Reservation.create({
      customer: req.user._id,
      table: tableId,
      date: new Date(date),
      timeSlot, startTime, endTime,
      guests, specialRequests, occasion,
      status: 'confirmed'
    });

    // Update table status
    await Table.findByIdAndUpdate(tableId, {
      status: 'reserved',
      currentReservation: reservation._id
    });

    await reservation.populate(['table', { path: 'customer', select: 'name email' }]);

    // Notification
    await Notification.create({
      recipient: req.user._id,
      title: 'Reservation Confirmed! 🎉',
      message: `Your table for ${guests} guests on ${new Date(date).toDateString()} at ${startTime} has been confirmed.`,
      type: 'reservation_confirmed',
      data: { reservationId: reservation._id }
    });

    // Email
    try {
      const template = emailTemplates.reservationConfirmed({
        date: new Date(date).toDateString(),
        timeSlot, guests,
        tableNumber: table.tableNumber,
        bookingId: reservation.bookingId
      }, req.user.name);
      await sendEmail({ to: req.user.email, ...template });
    } catch (e) { console.error('Email error:', e.message); }

    // Real-time
    const io = req.app.get('io');
    io.to('admin').emit('reservation:new', { reservation });
    io.to(req.user._id.toString()).emit('notification:new', {
      title: 'Reservation Confirmed!', type: 'reservation_confirmed'
    });

    res.status(201).json({ success: true, message: 'Reservation confirmed!', data: { reservation } });
  } catch (error) {
    next(error);
  }
};

// @GET /api/reservations - Customer gets own, Admin gets all
const getReservations = async (req, res, next) => {
  try {
    const { status, date, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (req.user.role === 'customer') filter.customer = req.user._id;
    if (status) filter.status = status;
    if (date) {
      const d = new Date(date);
      filter.date = {
        $gte: new Date(d.setHours(0, 0, 0, 0)),
        $lte: new Date(d.setHours(23, 59, 59, 999))
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [reservations, total] = await Promise.all([
      Reservation.find(filter)
        .populate('customer', 'name email phone')
        .populate('table', 'tableNumber capacity location')
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Reservation.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: {
        reservations,
        pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @GET /api/reservations/:id
const getReservationById = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('table');

    if (!reservation) return next(new AppError('Reservation not found.', 404));

    if (req.user.role === 'customer' && reservation.customer._id.toString() !== req.user._id.toString()) {
      return next(new AppError('Not authorized.', 403));
    }

    res.status(200).json({ success: true, data: { reservation } });
  } catch (error) {
    next(error);
  }
};

// @PATCH /api/reservations/:id/cancel - Customer/Admin
const cancelReservation = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) return next(new AppError('Reservation not found.', 404));
    if (req.user.role === 'customer' && reservation.customer.toString() !== req.user._id.toString()) {
      return next(new AppError('Not authorized.', 403));
    }
    if (['cancelled', 'completed'].includes(reservation.status)) {
      return next(new AppError(`Reservation is already ${reservation.status}.`, 400));
    }

    reservation.status = 'cancelled';
    reservation.cancellationReason = reason;
    await reservation.save();

    // Free the table
    await Table.findByIdAndUpdate(reservation.table, {
      status: 'available',
      currentReservation: null
    });

    const io = req.app.get('io');
    io.emit('reservation:cancelled', { reservationId: reservation._id });

    res.status(200).json({ success: true, message: 'Reservation cancelled.', data: { reservation } });
  } catch (error) {
    next(error);
  }
};

// @PATCH /api/reservations/:id/status - Admin/Waiter
const updateReservationStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id, { status }, { new: true }
    ).populate('customer', 'name email');

    if (!reservation) return next(new AppError('Reservation not found.', 404));

    res.status(200).json({ success: true, message: 'Status updated.', data: { reservation } });
  } catch (error) {
    next(error);
  }
};

// @GET /api/reservations/slots - Get available time slots for a date
const getAvailableSlots = async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return next(new AppError('Date is required.', 400));

    // Standard slots
    const allSlots = [
      { start: '12:00', end: '14:00', label: '12:00 PM - 2:00 PM' },
      { start: '14:00', end: '16:00', label: '2:00 PM - 4:00 PM' },
      { start: '16:00', end: '18:00', label: '4:00 PM - 6:00 PM' },
      { start: '18:00', end: '20:00', label: '6:00 PM - 8:00 PM' },
      { start: '20:00', end: '22:00', label: '8:00 PM - 10:00 PM' },
      { start: '22:00', end: '00:00', label: '10:00 PM - 12:00 AM' }
    ];

    const d = new Date(date);
    const reservationsOnDate = await Reservation.find({
      date: {
        $gte: new Date(d.setHours(0, 0, 0, 0)),
        $lte: new Date(d.setHours(23, 59, 59, 999))
      },
      status: { $in: ['pending', 'confirmed'] }
    }).distinct('timeSlot');

    const totalTables = await Table.countDocuments({ isActive: true, status: { $ne: 'maintenance' } });

    const slots = await Promise.all(allSlots.map(async (slot) => {
      const slotLabel = `${slot.start} - ${slot.end}`;
      const reservedCount = await Reservation.countDocuments({
        date: {
          $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
          $lte: new Date(new Date(date).setHours(23, 59, 59, 999))
        },
        timeSlot: slotLabel,
        status: { $in: ['pending', 'confirmed'] }
      });

      return {
        ...slot,
        timeSlot: slotLabel,
        availableTables: totalTables - reservedCount,
        isAvailable: totalTables - reservedCount > 0
      };
    }));

    res.status(200).json({ success: true, data: { slots, date } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReservation, getReservations, getReservationById,
  cancelReservation, updateReservationStatus, getAvailableSlots
};
