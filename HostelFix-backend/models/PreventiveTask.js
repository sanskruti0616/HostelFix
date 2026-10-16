const mongoose = require("mongoose")
const {
  ALL_CATEGORIES,
  ALL_PREVENTIVE_STATUSES,
  PREVENTIVE_STATUS,
  ALL_PREVENTIVE_PRIORITIES,
  PREVENTIVE_PRIORITY,
  ALL_PREVENTIVE_FREQUENCIES,
  PREVENTIVE_FREQUENCY,
} = require("../config/constants")

const preventiveImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
)

const preventiveTaskSchema = new mongoose.Schema(
  {
    taskNumber: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: 1000,
    },
    category: {
      type: String,
      enum: ALL_CATEGORIES,
      required: [true, "Category is required"],
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
      maxlength: 100,
    },
    roomNumber: {
      type: String,
      default: "",
      trim: true,
    },
    building: {
      type: String,
      default: "",
      trim: true,
    },
    dueAt: {
      type: Date,
      required: [true, "Due date is required"],
    },
    priority: {
      type: String,
      enum: ALL_PREVENTIVE_PRIORITIES,
      default: PREVENTIVE_PRIORITY.MEDIUM,
    },
    frequency: {
      type: String,
      enum: ALL_PREVENTIVE_FREQUENCIES,
      default: PREVENTIVE_FREQUENCY.ONE_TIME,
    },
    status: {
      type: String,
      enum: ALL_PREVENTIVE_STATUSES,
      default: PREVENTIVE_STATUS.SCHEDULED,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: [true, "Hostel is required"],
      index: true,
    },
    hostelName: {
      type: String,
      required: [true, "Hostel name is required"],
      trim: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
    assignedTo: {
      staffId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
      staffName: { type: String, default: "" },
      assignedAt: { type: Date, default: null },
      assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdByName: {
      type: String,
      default: "",
    },
    completedAt: {
      type: Date,
      default: null,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    completionNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    completionImages: [preventiveImageSchema],
  },
  {
    timestamps: true,
  }
)

// Helper method or virtual for effective due state
preventiveTaskSchema.methods.getDueState = function () {
  if (this.status === PREVENTIVE_STATUS.COMPLETED) return "completed"
  if (this.status === PREVENTIVE_STATUS.CANCELLED) return "cancelled"

  const now = new Date()
  const due = new Date(this.dueAt)
  if (now > due) {
    return "overdue"
  }
  const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60)
  if (hoursUntilDue <= 48) {
    return "due_soon"
  }
  return "upcoming"
}

preventiveTaskSchema.index({ hostelId: 1, status: 1 })
preventiveTaskSchema.index({ "assignedTo.staffId": 1, status: 1 })
preventiveTaskSchema.index({ dueAt: 1 })
preventiveTaskSchema.index({ createdAt: -1 })

module.exports = mongoose.model("PreventiveTask", preventiveTaskSchema)
