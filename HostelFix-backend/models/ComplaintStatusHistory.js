const mongoose = require("mongoose")

const complaintStatusHistorySchema = new mongoose.Schema(
  {
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
      required: true,
      index: true,
    },
    previousStatus: {
      type: String,
      default: null,
    },
    newStatus: {
      type: String,
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    changedByName: {
      type: String,
      default: "System",
      trim: true,
    },
    changedByRole: {
      type: String,
      default: "system",
      trim: true,
    },
    remarks: {
      type: String,
      default: "",
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
)

complaintStatusHistorySchema.index({ complaintId: 1, timestamp: 1 })

module.exports = mongoose.model("ComplaintStatusHistory", complaintStatusHistorySchema)
