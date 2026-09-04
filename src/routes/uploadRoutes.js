const express = require('express');
const router = express.Router();
const path = require('path');
const { protect, authorize } = require('../middleware/auth');
const { upload, uploadToCloudinary } = require('../config/cloudinary');
const { AppError } = require('../middleware/errorHandler');

router.use(protect);

// Generic single image upload (admin use)
router.post('/image',
  authorize('admin'),
  upload.single('image'),
  async (req, res, next) => {
    try {
      if (!req.file) return next(new AppError('No file uploaded.', 400));
      const folder = req.query.folder || 'restaurant/general';
      const { url, publicId } = await uploadToCloudinary(req.file.path, folder);
      res.status(200).json({
        success: true,
        message: 'Image uploaded successfully.',
        data: { url, publicId }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Multiple images upload
router.post('/images',
  authorize('admin'),
  upload.array('images', 5),
  async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) return next(new AppError('No files uploaded.', 400));
      const folder = req.query.folder || 'restaurant/general';
      const uploads = await Promise.all(
        req.files.map(file => uploadToCloudinary(file.path, folder))
      );
      res.status(200).json({
        success: true,
        message: `${uploads.length} image(s) uploaded.`,
        data: { images: uploads }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
