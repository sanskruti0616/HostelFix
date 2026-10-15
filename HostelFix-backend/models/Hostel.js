const mongoose = require("mongoose")

const hostelSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Hostel name is required"],
      trim: true,
      maxlength: 100,
    },
    code: {
      type: String,
      required: true,
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

hostelSchema.index({ organizationId: 1, code: 1 })
hostelSchema.index({ organizationId: 1, name: 1 })

module.exports = mongoose.model("Hostel", hostelSchema)
