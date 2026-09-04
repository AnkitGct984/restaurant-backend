const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { sendEmail, emailTemplates } = require('../config/email');
const { AppError } = require('../middleware/errorHandler');

// Helper: generate tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d'
  });
  return { accessToken, refreshToken };
};

// @route  POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, role } = req.body;

    // Prevent self-assigning admin/chef/waiter
    const allowedRoles = ['customer'];
    const userRole = allowedRoles.includes(role) ? role : 'customer';

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('Email already registered. Please login.', 400));
    }

    const user = new User({ name, email, password, phone, role: userRole });

    // Generate email OTP
    const { otp, expireAt } = user.generateOTP();
    user.emailOtp = otp;
    user.emailOtpExpire = expireAt;
    await user.save();

    // Send verification email
    try {
      const template = emailTemplates.otpVerification(otp, name);
      await sendEmail({ to: email, ...template });
    } catch (emailError) {
      console.error('Email sending failed:', emailError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please verify your email with the OTP sent.',
      data: { userId: user._id, email: user.email }
    });
  } catch (error) {
    next(error);
  }
};

// @route  POST /api/auth/verify-email
const verifyEmail = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email }).select('+emailOtp +emailOtpExpire');
    if (!user) return next(new AppError('User not found.', 404));
    if (user.isEmailVerified) return next(new AppError('Email already verified.', 400));
    if (!user.emailOtp) return next(new AppError('No OTP found. Please request a new one.', 400));
    if (user.emailOtpExpire < Date.now()) return next(new AppError('OTP has expired. Please request a new one.', 400));
    if (user.emailOtp !== otp) return next(new AppError('Invalid OTP. Please try again.', 400));

    user.isEmailVerified = true;
    user.emailOtp = undefined;
    user.emailOtpExpire = undefined;
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshToken = refreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Email verified successfully! Welcome aboard! 🎉',
      data: {
        user: {
          _id: user._id, name: user.name, email: user.email,
          role: user.role, isEmailVerified: user.isEmailVerified
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

// @route  POST /api/auth/resend-otp
const resendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return next(new AppError('User not found.', 404));
    if (user.isEmailVerified) return next(new AppError('Email is already verified.', 400));

    const { otp, expireAt } = user.generateOTP();
    user.emailOtp = otp;
    user.emailOtpExpire = expireAt;
    await user.save();

    const template = emailTemplates.otpVerification(otp, user.name);
    await sendEmail({ to: email, ...template });

    res.status(200).json({ success: true, message: 'New OTP sent to your email.' });
  } catch (error) {
    next(error);
  }
};

// @route  POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) return next(new AppError('Invalid email or password.', 401));
    if (!user.isActive) return next(new AppError('Account is deactivated. Contact support.', 403));

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return next(new AppError('Invalid email or password.', 401));

    if (!user.isEmailVerified) {
      // Resend OTP
      const { otp, expireAt } = user.generateOTP();
      user.emailOtp = otp;
      user.emailOtpExpire = expireAt;
      await user.save();
      const template = emailTemplates.otpVerification(otp, user.name);
      await sendEmail({ to: email, ...template });

      return res.status(403).json({
        success: false,
        message: 'Email not verified. A new OTP has been sent to your email.',
        data: { requiresVerification: true, email: user.email }
      });
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshToken = refreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      message: `Welcome back, ${user.name}! 👋`,
      data: {
        user: {
          _id: user._id, name: user.name, email: user.email,
          phone: user.phone, role: user.role, avatar: user.avatar,
          isEmailVerified: user.isEmailVerified, loyaltyPoints: user.loyaltyPoints
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

// @route  POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      // Return success to prevent email enumeration
      return res.status(200).json({ success: true, message: 'If this email exists, a password reset OTP has been sent.' });
    }

    const { otp, expireAt } = user.generateOTP();
    user.passwordResetOtp = otp;
    user.passwordResetOtpExpire = expireAt;
    await user.save();

    const template = emailTemplates.forgotPassword(otp, user.name);
    await sendEmail({ to: email, ...template });

    res.status(200).json({
      success: true,
      message: 'Password reset OTP has been sent to your email.',
      data: { email: user.email }
    });
  } catch (error) {
    next(error);
  }
};

// @route  POST /api/auth/verify-reset-otp
const verifyResetOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email }).select('+passwordResetOtp +passwordResetOtpExpire');

    if (!user) return next(new AppError('User not found.', 404));
    if (!user.passwordResetOtp) return next(new AppError('No OTP requested. Please request a new one.', 400));
    if (user.passwordResetOtpExpire < Date.now()) return next(new AppError('OTP has expired. Please request a new one.', 400));
    if (user.passwordResetOtp !== otp) return next(new AppError('Invalid OTP.', 400));

    // Issue a short-lived reset token
    const resetToken = jwt.sign({ id: user._id, purpose: 'password_reset' }, process.env.JWT_SECRET, { expiresIn: '15m' });

    user.passwordResetOtp = undefined;
    user.passwordResetOtpExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'OTP verified. You can now reset your password.',
      data: { resetToken }
    });
  } catch (error) {
    next(error);
  }
};

// @route  POST /api/auth/reset-password
const resetPassword = async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.body;

    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    if (decoded.purpose !== 'password_reset') {
      return next(new AppError('Invalid reset token.', 400));
    }

    const user = await User.findById(decoded.id);
    if (!user) return next(new AppError('User not found.', 404));

    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: 'Password reset successfully. Please login with your new password.' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Reset token expired. Please request a new OTP.', 400));
    }
    next(error);
  }
};

// @route  POST /api/auth/refresh-token
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return next(new AppError('Refresh token required.', 401));

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== token) {
      return next(new AppError('Invalid refresh token.', 401));
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);
    user.refreshToken = newRefreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      data: { accessToken, refreshToken: newRefreshToken }
    });
  } catch (error) {
    next(new AppError('Invalid or expired refresh token.', 401));
  }
};

// @route  POST /api/auth/logout
const logout = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.refreshToken = undefined;
      await user.save();
    }
    res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    next(error);
  }
};

// @route  GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

// @route  PUT /api/auth/change-password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return next(new AppError('Current password is incorrect.', 400));

    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register, verifyEmail, resendOtp, login,
  forgotPassword, verifyResetOtp, resetPassword,
  refreshToken, logout, getMe, changePassword
};
