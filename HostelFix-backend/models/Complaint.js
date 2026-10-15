const mongoose = require("mongoose")
const {
  ALL_STATUSES,
  COMPLAINT_STATUS,
  ALL_PRIORITIES,
  COMPLAINT_PRIORITY,
  ALL_CATEGORIES,
} = require("../config/constants")

const evidenceImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    hash: { type: String, default: "" }, // 64-bit perceptual hash hex string
    mimeType: { type: String, default: "" },
    size: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
    uploaderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: true }
)

const resolutionImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    uploadedAt: { type: Date, default: Date.now },
    uploaderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: { type: String, default: "" },
  },
  { _id: true }
)

const complaintSchema = new mongoose.Schema(
  {
    complaintNumber: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    studentEmail: {
      type: String,
      default: "",
      trim: true,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      default: null,
    },
    hostelName: {
      type: String,
      required: [true, "Hostel is required"],
      trim: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
    },
    roomNumber: {
      type: String,
      required: [true, "Room is required"],
      trim: true,
    },
    category: {
      type: String,
      enum: ALL_CATEGORIES,
      required: [true, "Category is required"],
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: 1000,
    },
    priority: {
      type: String,
      enum: ALL_PRIORITIES,
      default: COMPLAINT_PRIORITY.MEDIUM,
    },
    status: {
      type: String,
      enum: ALL_STATUSES,
      default: COMPLAINT_STATUS.SUBMITTED,
    },
    evidenceImages: [evidenceImageSchema],
    resolutionImages: [resolutionImageSchema],
    assignedTo: {
      staffId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      staffName: { type: String, default: "" },
      assignedAt: { type: Date, default: null },
      assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },
    verification: {
      isVerified: { type: Boolean, default: false },
      verificationType: { type: String, default: "pending" }, // 'ai_assisted', 'manual_warden'
      result: { type: String, default: "pending" }, // 'verified', 'flagged_duplicate', 'needs_info', 'rejected'
      confidence: { type: Number, default: 0 },
      explanation: { type: String, default: "" },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reviewedAt: { type: Date, default: null },
    },
    duplicateOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

// Primary and composite indexes
complaintSchema.index({ complaintNumber: 1 }, { unique: true })
complaintSchema.index({ createdBy: 1, createdAt: -1 })
complaintSchema.index({ hostelId: 1, status: 1 })
complaintSchema.index({ "assignedTo.staffId": 1, status: 1 })
complaintSchema.index({ category: 1 })
complaintSchema.index({ status: 1 })
complaintSchema.index({ priority: 1 })
complaintSchema.index({ createdAt: -1 })
complaintSchema.index({ "evidenceImages.hash": 1 })

module.exports = mongoose.model("Complaint", complaintSchema)
