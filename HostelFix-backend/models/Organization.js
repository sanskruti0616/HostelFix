const mongoose = require("mongoose")
const { ALL_TENANT_STATUSES, TENANT_STATUS } = require("../config/constants")

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: [true, "Unique organization slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, "Slug must contain only lowercase alphanumeric characters and hyphens"],
    },
    invitationCode: {
      type: String,
      required: [true, "Organization invitation code is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    contactEmail: {
      type: String,
      required: [true, "Contact email is required"],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    city: {
      type: String,
      default: "",
      trim: true,
    },
    state: {
      type: String,
      default: "",
      trim: true,
    },
    country: {
      type: String,
      default: "India",
      trim: true,
    },
    logo: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ALL_TENANT_STATUSES,
      default: TENANT_STATUS.ACTIVE,
      required: true,
    },
    plan: {
      type: String,
      default: "standard",
    },
    settings: {
      allowStudentSelfRegistration: { type: Boolean, default: true },
      requireApprovalForStaff: { type: Boolean, default: true },
      requireApprovalForWardens: { type: Boolean, default: true },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

organizationSchema.index({ status: 1 })

module.exports = mongoose.model("Organization", organizationSchema)
