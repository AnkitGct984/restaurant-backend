const cron = require('node-cron');
const Reservation = require('../models/Reservation');
const { checkAndNotifyLowStock } = require('../controllers/inventoryController');

const startCronJobs = (io) => {
  // Every hour: check low stock
  cron.schedule('0 * * * *', async () => {
    console.log('⏰ Cron: Checking low stock...');
    await checkAndNotifyLowStock(io);
  });

  // Every day at 10am: send reservation reminders
  cron.schedule('0 10 * * *', async () => {
    console.log('⏰ Cron: Sending reservation reminders...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const upcoming = await Reservation.find({
      date: { $gte: tomorrow, $lt: dayAfter },
      status: 'confirmed',
      reminderSent: false
    }).populate('customer', 'name email');

    for (const res of upcoming) {
      try {
        const { sendEmail } = require('../config/email');
        await sendEmail({
          to: res.customer.email,
          subject: '⏰ Reservation Reminder - Tomorrow!',
          html: `<p>Dear ${res.customer.name}, reminder for your reservation tomorrow at ${res.startTime} for ${res.guests} guests. Booking ID: ${res.bookingId}</p>`
        });
        res.reminderSent = true;
        await res.save();
      } catch (e) {
        console.error('Reminder email failed:', e.message);
      }
    }
  });

  // Every day at midnight: mark no-show reservations
  cron.schedule('0 0 * * *', async () => {
    console.log('⏰ Cron: Marking no-show reservations...');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await Reservation.updateMany(
      { date: { $gte: yesterday, $lt: today }, status: 'confirmed' },
      { status: 'no_show' }
    );
  });

  console.log('⏰ Cron jobs started');
};

module.exports = { startCronJobs };
