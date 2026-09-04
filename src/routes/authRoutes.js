const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  register, verifyEmail, resendOtp, login,
  forgotPassword, verifyResetOtp, resetPassword,
  refreshToken, logout, getMe, changePassword
} = require('../controllers/authController');

// Register
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 50 }),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional().matches(/^[0-9]{10}$/).withMessage('Phone must be 10 digits')
], validate, register);

// Verify email OTP
router.post('/verify-email', [
  body('email').isEmail().normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
], validate, verifyEmail);

// Resend OTP
router.post('/resend-otp', [
  body('email').isEmail().normalizeEmail()
], validate, resendOtp);

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
], validate, login);

// Forgot password
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], validate, forgotPassword);

// Verify reset OTP
router.post('/verify-reset-otp', [
  body('email').isEmail().normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 })
], validate, verifyResetOtp);

// Reset password
router.post('/reset-password', [
  body('resetToken').notEmpty(),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], validate, resetPassword);

// Refresh token
router.post('/refresh-token', refreshToken);

// Protected
router.use(protect);
router.post('/logout', logout);
router.get('/me', getMe);
router.put('/change-password', [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], validate, changePassword);

module.exports = router;
