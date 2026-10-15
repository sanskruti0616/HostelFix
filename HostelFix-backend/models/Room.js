const mongoose = require("mongoose")

const roomSchema = new mongoose.Schema(
  {
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
    },
    building: {
      type: String,
      default: "Main",
      trim: true,
    },
    floor: {
      type: Number,
      default: 1,
    },
    roomNumber: {
      type: String,
      required: [true, "Room number is required"],
      trim: true,
    },
    assignedStudents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    status: {
      type: String,
      enum: ["available", "occupied", "maintenance"],
      default: "available",
    },
  },
  {
    timestamps: true,
  }
)

roomSchema.index({ hostelId: 1, roomNumber: 1 }, { unique: true })

module.exports = mongoose.model("Room", roomSchema)
