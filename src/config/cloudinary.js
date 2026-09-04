const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const path = require('path');
const fs = require('fs');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Local storage fallback
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) return cb(null, true);
  cb(new Error('Only image files are allowed (jpeg, jpg, png, webp, gif)'));
};

const upload = multer({
  storage: localStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter
});

const uploadToCloudinary = async (filePath, folder = 'restaurant') => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      transformation: [{ width: 800, height: 600, crop: 'limit', quality: 'auto' }]
    });
    // Delete local file after upload
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { url: result.secure_url, publicId: result.public_id };
  } catch (error) {
    throw new Error('Image upload failed: ' + error.message);
  }
};

const deleteFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error.message);
  }
};

module.exports = { upload, uploadToCloudinary, deleteFromCloudinary, cloudinary };
