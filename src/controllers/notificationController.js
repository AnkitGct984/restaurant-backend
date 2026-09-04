const Notification = require('../models/Notification');
const { AppError } = require('../middleware/errorHandler');

// @GET /api/notifications
const getNotifications = async (req, res, next) => {
  try {
    const { isRead, page = 1, limit = 20 } = req.query;
    const filter = { recipient: req.user._id };
    if (isRead !== undefined) filter.isRead = isRead === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: req.user._id, isRead: false })
    ]);

    res.status(200).json({
      success: true,
      data: { notifications, unreadCount, pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) } }
    });
  } catch (error) {
    next(error);
  }
};

// @PATCH /api/notifications/:id/read
const markAsRead = async (req, res, next) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!notif) return next(new AppError('Notification not found.', 404));
    res.status(200).json({ success: true, message: 'Marked as read.', data: { notification: notif } });
  } catch (error) {
    next(error);
  }
};

// @PATCH /api/notifications/read-all
const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    res.status(200).json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    next(error);
  }
};

// @DELETE /api/notifications/:id
const deleteNotification = async (req, res, next) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
    res.status(200).json({ success: true, message: 'Notification deleted.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead, deleteNotification };
