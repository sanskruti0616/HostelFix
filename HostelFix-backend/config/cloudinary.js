const cloudinary = require("cloudinary").v2
const path = require("path")
const fs = require("fs")
require("dotenv").config()

const hasCloudinaryCredentials = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
)

if (hasCloudinaryCredentials) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  })
} else {
  console.warn(
    "[Cloudinary] Credentials not fully configured. Using backend secure local storage for uploads."
  )
}

// Ensure local upload fallback directory exists
const UPLOADS_DIR = path.join(__dirname, "..", "public", "uploads")
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

/**
 * Upload a buffer to Cloudinary or fallback storage
 */
async function uploadImageBuffer(buffer, options = {}) {
  const folder = options.folder || "hostelfix/evidence"

  if (hasCloudinaryCredentials) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "image",
          format: options.format || "webp",
          transformation: [{ quality: "auto:good" }, { fetch_format: "auto" }],
        },
        (error, result) => {
          if (error) return reject(error)
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
            storageProvider: "cloudinary",
          })
        }
      )
      uploadStream.end(buffer)
    })
  }

  // Local filesystem fallback
  const filename = `${folder.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.webp`
  const filePath = path.join(UPLOADS_DIR, filename)

  await fs.promises.writeFile(filePath, buffer)

  return {
    url: `/uploads/${filename}`,
    publicId: filename,
    width: options.width || 800,
    height: options.height || 600,
    format: "webp",
    bytes: buffer.length,
    storageProvider: "local_storage",
  }
}

module.exports = {
  cloudinary,
  hasCloudinaryCredentials,
  uploadImageBuffer,
  UPLOADS_DIR,
}
