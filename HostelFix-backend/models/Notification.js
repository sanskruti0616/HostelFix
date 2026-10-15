const mongoose = require("mongoose")

const notificationSchema = new mongoose.Schema(
  {
    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
      default: null,
    },
    complaintNumber: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

notificationSchema.index({ recipientUserId: 1, readAt: 1 })
notificationSchema.index({ createdAt: -1 })

module.exports = mongoose.model("Notification", notificationSchema)
