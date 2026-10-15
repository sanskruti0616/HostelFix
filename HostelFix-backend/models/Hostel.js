const mongoose = require("mongoose")

const hostelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Hostel name is required"],
      unique: true,
      trim: true,
      maxlength: 100,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    contactInformation: {
      wardenName: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
)

module.exports = mongoose.model("Hostel", hostelSchema)
