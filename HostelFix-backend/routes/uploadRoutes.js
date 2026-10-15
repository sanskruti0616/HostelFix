const express = require("express")
const router = express.Router()
const upload = require("../middleware/upload")
const { authenticate } = require("../middleware/auth")
const { authorizeRoles, canAccessComplaint } = require("../middleware/rbac")
const { processAndUploadImage, findDuplicateImagesInScope } = require("../services/imageService")
const Complaint = require("../models/Complaint")
const { ROLES } = require("../config/constants")

/**
 * @route   POST /api/uploads
 * @desc    Upload evidence photograph(s) with validation, blur detection, and perceptual hashing
 * @access  Private
 */
router.post("/uploads", authenticate, upload.array("images", 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No image files provided. Please select at least one image.",
      })
    }

    const uploadedImages = []
    const potentialDuplicates = []

    for (const file of req.files) {
      const processed = await processAndUploadImage(file, {
        folder: "hostelfix/evidence",
      })

      // Check duplicates in hostel scope if available
      const hostelId = req.user.hostelId || null
      const duplicates = await findDuplicateImagesInScope(processed.hash, hostelId)

      uploadedImages.push({
        url: processed.url,
        publicId: processed.publicId,
        hash: processed.hash,
        mimeType: processed.mimeType,
        size: processed.size,
        width: processed.width,
        height: processed.height,
        isBlurry: processed.isBlurry,
        sharpnessScore: processed.sharpnessScore,
        uploaderId: req.user._id,
        storageProvider: processed.storageProvider,
      })

      if (duplicates.length > 0) {
        potentialDuplicates.push(...duplicates)
      }
    }

    res.status(201).json({
      success: true,
      count: uploadedImages.length,
      images: uploadedImages,
      duplicateWarnings: potentialDuplicates,
      message: potentialDuplicates.length > 0
        ? `Uploaded ${uploadedImages.length} image(s). Note: ${potentialDuplicates.length} visually similar image(s) previously found.`
        : `Uploaded ${uploadedImages.length} image(s) successfully.`,
    })
  } catch (error) {
    console.error("[Uploads] Upload error:", error.message)
    res.status(400).json({
      success: false,
      message: error.message || "Failed to process image upload",
    })
  }
})

/**
 * @route   POST /api/complaints/:id/resolution-evidence
 * @desc    Maintenance technician uploads resolution photograph(s)
 * @access  Private (Staff, Admin)
 */
router.post(
  "/complaints/:id/resolution-evidence",
  authenticate,
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  upload.array("images", 3),
  async (req, res) => {
    try {
      const param = req.params.id
      const query = param.startsWith("HF-") ? { complaintNumber: param } : { _id: param }

      const complaint = await Complaint.findOne(query)
      if (!complaint) {
        return res.status(404).json({ success: false, message: "Complaint not found" })
      }

      if (!canAccessComplaint(req.user, complaint)) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You are not authorized to upload resolution evidence for this complaint",
        })
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, message: "Please provide resolution photographs" })
      }

      const notes = req.body.notes || "Maintenance work completed"
      const resolutionImages = []

      for (const file of req.files) {
        const processed = await processAndUploadImage(file, {
          folder: "hostelfix/resolution",
        })

        resolutionImages.push({
          url: processed.url,
          publicId: processed.publicId,
          uploadedAt: new Date(),
          uploaderId: req.user._id,
          notes,
        })
      }

      complaint.resolutionImages.push(...resolutionImages)
      await complaint.save()

      res.json({
        success: true,
        message: "Resolution photo(s) uploaded successfully",
        resolutionImages: complaint.resolutionImages,
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to upload resolution photos",
      })
    }
  }
)

module.exports = router
