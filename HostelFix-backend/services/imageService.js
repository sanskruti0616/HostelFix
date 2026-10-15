const sharp = require("sharp")
const { uploadImageBuffer } = require("../config/cloudinary")
const Complaint = require("../models/Complaint")

/**
 * Validates image buffer using sharp and magic byte decoding
 */
async function inspectAndValidateImage(buffer, originalMimeType) {
  if (!buffer || buffer.length === 0) {
    throw new Error("Empty image file provided")
  }

  // Maximum size 10MB
  const MAX_SIZE = 10 * 1024 * 1024
  if (buffer.length > MAX_SIZE) {
    throw new Error("File size exceeds 10MB limit")
  }

  let metadata
  try {
    const image = sharp(buffer)
    metadata = await image.metadata()
  } catch (err) {
    throw new Error("Invalid or corrupted image file. Cannot decode image data.")
  }

  const allowedFormats = ["jpeg", "jpg", "png", "webp", "heif", "heic"]
  if (!metadata.format || !allowedFormats.includes(metadata.format.toLowerCase())) {
    throw new Error(`Unsupported image format (${metadata.format}). Allowed formats: JPEG, PNG, WebP`)
  }

  if (metadata.width < 50 || metadata.height < 50) {
    throw new Error("Image resolution too low. Minimum dimensions are 50x50 pixels.")
  }

  if (metadata.width > 8000 || metadata.height > 8000) {
    throw new Error("Image dimensions exceed 8000x8000 pixels limit.")
  }

  return metadata
}

/**
 * Computes 64-bit difference hash (dHash) using Sharp
 * 1. Convert to 9x8 grayscale
 * 2. Compare pixel(x, y) with pixel(x+1, y)
 * 3. 64 bits = 16-hex characters
 */
async function computePerceptualHash(buffer) {
  try {
    const rawPixels = await sharp(buffer)
      .resize(9, 8, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer()

    let hashBinary = ""
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const leftPixel = rawPixels[row * 9 + col]
        const rightPixel = rawPixels[row * 9 + col + 1]
        hashBinary += leftPixel > rightPixel ? "1" : "0"
      }
    }

    // Convert 64 bits binary to 16 hex characters
    let hexHash = ""
    for (let i = 0; i < 64; i += 4) {
      const nibble = hashBinary.substring(i, i + 4)
      hexHash += parseInt(nibble, 2).toString(16)
    }

    return hexHash
  } catch (err) {
    console.error("[ImageService] Error computing perceptual hash:", err.message)
    return ""
  }
}

/**
 * Calculate Hamming distance between two hex perceptual hashes (0 to 64)
 */
function calculateHammingDistance(hexHash1, hexHash2) {
  if (!hexHash1 || !hexHash2 || hexHash1.length !== hexHash2.length) {
    return 64
  }

  let distance = 0
  for (let i = 0; i < hexHash1.length; i++) {
    const n1 = parseInt(hexHash1[i], 16)
    const n2 = parseInt(hexHash2[i], 16)
    let xor = n1 ^ n2
    while (xor > 0) {
      distance += xor & 1
      xor >>= 1
    }
  }
  return distance
}

/**
 * Detect blurriness using standard deviation of edge Laplacian
 */
async function detectBlurriness(buffer) {
  try {
    // Resize to standard 256x256 grayscale for fast edge analysis
    const gray = await sharp(buffer)
      .resize(256, 256, { fit: "inside" })
      .grayscale()
      .raw()
      .toBuffer()

    // Calculate variance of neighboring differences
    let sumDiff = 0
    let count = 0
    for (let i = 0; i < gray.length - 1; i++) {
      const diff = Math.abs(gray[i] - gray[i + 1])
      sumDiff += diff
      count++
    }
    const meanDiff = sumDiff / count
    // A very low mean difference signifies a blurry or uniform blank image
    const isBlurry = meanDiff < 4.0

    return {
      isBlurry,
      sharpnessScore: Math.round(meanDiff * 10) / 10,
    }
  } catch (err) {
    return { isBlurry: false, sharpnessScore: 10 }
  }
}

const mongoose = require("mongoose")

/**
 * Find potential duplicate images in the database for the given hostel/scope
 */
async function findDuplicateImagesInScope(hash, hostelId, currentComplaintId = null) {
  if (!hash || mongoose.connection.readyState !== 1) return []

  const query = {
    "evidenceImages.hash": { $exists: true, $ne: "" },
  }
  if (hostelId) {
    query.hostelId = hostelId
  }
  if (currentComplaintId) {
    query._id = { $ne: currentComplaintId }
  }

  // Retrieve complaints with evidence images
  const existingComplaints = await Complaint.find(query)
    .select("_id complaintNumber title hostelName roomNumber evidenceImages createdAt")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean()

  const matches = []
  const SIMILARITY_THRESHOLD = 85 // Percent similarity (distance <= 9 bits)

  for (const complaint of existingComplaints) {
    for (const img of complaint.evidenceImages || []) {
      if (!img.hash) continue
      const distance = calculateHammingDistance(hash, img.hash)
      const similarity = Math.round(((64 - distance) / 64) * 100)

      if (similarity >= SIMILARITY_THRESHOLD) {
        matches.push({
          complaintId: complaint._id,
          complaintNumber: complaint.complaintNumber,
          title: complaint.title,
          roomNumber: complaint.roomNumber,
          similarityScore: similarity,
          hammingDistance: distance,
          isExactMatch: distance <= 2,
          matchedImageUrl: img.url,
          createdAt: complaint.createdAt,
        })
        break // One match per complaint is sufficient
      }
    }
  }

  return matches.sort((a, b) => b.similarityScore - a.similarityScore)
}

/**
 * Complete image processing pipeline:
 * 1. Validate
 * 2. Hash & blur check
 * 3. Convert to webp
 * 4. Upload
 */
async function processAndUploadImage(file, options = {}) {
  const metadata = await inspectAndValidateImage(file.buffer, file.mimetype)
  const hash = await computePerceptualHash(file.buffer)
  const blurInfo = await detectBlurriness(file.buffer)

  // Optimize to webp
  const webpBuffer = await sharp(file.buffer)
    .resize(1920, 1080, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer()

  const uploadResult = await uploadImageBuffer(webpBuffer, {
    folder: options.folder || "hostelfix/evidence",
    width: metadata.width,
    height: metadata.height,
  })

  return {
    url: uploadResult.url,
    publicId: uploadResult.publicId,
    hash,
    mimeType: "image/webp",
    size: webpBuffer.length,
    width: metadata.width,
    height: metadata.height,
    isBlurry: blurInfo.isBlurry,
    sharpnessScore: blurInfo.sharpnessScore,
    storageProvider: uploadResult.storageProvider,
  }
}

module.exports = {
  inspectAndValidateImage,
  computePerceptualHash,
  calculateHammingDistance,
  detectBlurriness,
  findDuplicateImagesInScope,
  processAndUploadImage,
}
