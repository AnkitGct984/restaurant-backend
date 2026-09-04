const express = require('express');
const router = express.Router();
const { protect, requireEmailVerified } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const {
  getProfile, updateProfile, uploadAvatar,
  getOrderHistory, getLoyaltyInfo
} = require('../controllers/userController');

router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.post('/avatar', upload.single('avatar'), uploadAvatar);
router.get('/order-history', getOrderHistory);
router.get('/loyalty', getLoyaltyInfo);

module.exports = router;
