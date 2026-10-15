const mongoose = require("mongoose")

const assignmentSchema = new mongoose.Schema(
  {
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
      required: true,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    instructions: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["assigned", "in_progress", "completed", "cancelled"],
      default: "assigned",
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

module.exports = mongoose.model("Assignment", assignmentSchema)
