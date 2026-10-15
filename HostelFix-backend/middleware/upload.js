const multer = require("multer")

// Memory storage to process buffer with Sharp before storage
const storage = multer.memoryStorage()

const fileFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
  if (allowedMimes.includes(file.mimetype.toLowerCase())) {
    cb(null, true)
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, and WebP images are allowed."), false)
  }
}

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
    files: 5, // Up to 5 files per request
  },
  fileFilter,
})

module.exports = upload
