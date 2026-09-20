const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT == 465,  // 👈 465 ke liye true, 587 ke liye false
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000,  // 👈 10 second timeout (pehle infinite tha, isliye hang ho raha tha)
    greetingTimeout: 10000,
    socketTimeout: 10000
  });
};

const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = createTransporter();
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    text
  };
  const info = await transporter.sendMail(mailOptions);
  console.log(`📧 Email sent: ${info.messageId}`);
  return info;
};

// Email Templates
const emailTemplates = {
  otpVerification: (otp, name) => ({
    subject: '🔐 Email Verification - Restaurant Management System',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #e74c3c, #c0392b); padding: 30px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .body { padding: 40px; text-align: center; }
          .otp-box { background: #f8f9fa; border: 2px dashed #e74c3c; border-radius: 10px; padding: 20px; margin: 30px 0; }
          .otp { font-size: 48px; font-weight: bold; color: #e74c3c; letter-spacing: 10px; }
          .footer { background: #2c3e50; color: #ecf0f1; text-align: center; padding: 20px; font-size: 12px; }
          .warning { color: #e74c3c; font-size: 13px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🍽️ Restaurant Management System</h1>
          </div>
          <div class="body">
            <h2>Hello, ${name}! 👋</h2>
            <p>Please verify your email address using the OTP below:</p>
            <div class="otp-box">
              <div class="otp">${otp}</div>
              <p style="margin:0;color:#666;">One-Time Password</p>
            </div>
            <p>This OTP is valid for <strong>${process.env.OTP_EXPIRE_MINUTES || 10} minutes</strong>.</p>
            <p class="warning">⚠️ Never share this OTP with anyone. Our team will never ask for it.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Restaurant Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  forgotPassword: (otp, name) => ({
    subject: '🔑 Password Reset OTP - Restaurant Management System',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #3498db, #2980b9); padding: 30px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .body { padding: 40px; text-align: center; }
          .otp-box { background: #f8f9fa; border: 2px dashed #3498db; border-radius: 10px; padding: 20px; margin: 30px 0; }
          .otp { font-size: 48px; font-weight: bold; color: #3498db; letter-spacing: 10px; }
          .footer { background: #2c3e50; color: #ecf0f1; text-align: center; padding: 20px; font-size: 12px; }
          .warning { color: #e74c3c; font-size: 13px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🍽️ Password Reset Request</h1>
          </div>
          <div class="body">
            <h2>Hello, ${name}! 👋</h2>
            <p>We received a request to reset your password. Use the OTP below:</p>
            <div class="otp-box">
              <div class="otp">${otp}</div>
              <p style="margin:0;color:#666;">Password Reset OTP</p>
            </div>
            <p>This OTP is valid for <strong>${process.env.OTP_EXPIRE_MINUTES || 10} minutes</strong>.</p>
            <p>If you did not request a password reset, please ignore this email.</p>
            <p class="warning">⚠️ Never share this OTP with anyone.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Restaurant Management System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  reservationConfirmed: (reservation, name) => ({
    subject: '✅ Reservation Confirmed - Restaurant Management System',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #27ae60, #2ecc71); padding: 30px; text-align: center; }
          .header h1 { color: white; margin: 0; }
          .body { padding: 40px; }
          .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
          .label { color: #666; font-weight: bold; }
          .value { color: #2c3e50; }
          .footer { background: #2c3e50; color: #ecf0f1; text-align: center; padding: 20px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>✅ Reservation Confirmed!</h1></div>
          <div class="body">
            <p>Dear ${name},</p>
            <p>Your table reservation has been confirmed. Here are the details:</p>
            <div class="detail-row"><span class="label">📅 Date:</span><span class="value">${reservation.date}</span></div>
            <div class="detail-row"><span class="label">⏰ Time:</span><span class="value">${reservation.timeSlot}</span></div>
            <div class="detail-row"><span class="label">🪑 Table:</span><span class="value">Table #${reservation.tableNumber}</span></div>
            <div class="detail-row"><span class="label">👥 Guests:</span><span class="value">${reservation.guests}</span></div>
            <div class="detail-row"><span class="label">🎫 Booking ID:</span><span class="value">${reservation.bookingId}</span></div>
          </div>
          <div class="footer"><p>© ${new Date().getFullYear()} Restaurant Management System</p></div>
        </div>
      </body>
      </html>
    `
  }),

  orderConfirmed: (order, name) => ({
    subject: `🛒 Order #${order.orderId} Confirmed!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; }
          .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #e67e22, #d35400); padding: 30px; text-align: center; }
          .header h1 { color: white; margin: 0; }
          .body { padding: 40px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #e67e22; color: white; padding: 10px; text-align: left; }
          td { padding: 10px; border-bottom: 1px solid #eee; }
          .total { font-size: 18px; font-weight: bold; color: #e74c3c; }
          .footer { background: #2c3e50; color: #ecf0f1; text-align: center; padding: 20px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>🍽️ Order Confirmed!</h1></div>
          <div class="body">
            <p>Dear ${name},</p>
            <p>Your order <strong>#${order.orderId}</strong> has been placed successfully.</p>
            <table>
              <thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead>
              <tbody>
                ${order.items.map(item => `<tr><td>${item.name}</td><td>${item.quantity}</td><td>₹${item.price}</td></tr>`).join('')}
              </tbody>
            </table>
            <p class="total">Grand Total: ₹${order.grandTotal}</p>
          </div>
          <div class="footer"><p>© ${new Date().getFullYear()} Restaurant Management System</p></div>
        </div>
      </body>
      </html>
    `
  }),

  paymentSuccess: (payment, name) => ({
    subject: `💳 Payment Successful - ₹${payment.amount}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; }
          .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 10px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #27ae60, #2ecc71); padding: 30px; text-align: center; }
          .header h1 { color: white; margin: 0; }
          .body { padding: 40px; text-align: center; }
          .amount { font-size: 48px; font-weight: bold; color: #27ae60; }
          .footer { background: #2c3e50; color: #ecf0f1; text-align: center; padding: 20px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>✅ Payment Successful!</h1></div>
          <div class="body">
            <p>Dear ${name},</p>
            <p>Your payment has been received successfully.</p>
            <div class="amount">₹${payment.amount}</div>
            <p>Transaction ID: <strong>${payment.transactionId}</strong></p>
            <p>Order ID: <strong>#${payment.orderId}</strong></p>
            <p>Thank you for dining with us! 🍽️</p>
          </div>
          <div class="footer"><p>© ${new Date().getFullYear()} Restaurant Management System</p></div>
        </div>
      </body>
      </html>
    `
  })
};

module.exports = { sendEmail, emailTemplates };
