const mongoose = require("mongoose")
const { ALL_ROLES, ROLES } = require("../config/constants")

const userSchema = new mongoose.Schema(
  {
    authenticationProvider: {
      type: String,
      enum: ["google", "local", "local_dev", "firebase"],
      default: "google",
      required: true,
    },
    providerUserId: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    username: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
    },
    passwordHash: {
      type: String,
      select: false, // Never return password hash in default queries
    },
    isDemoAccount: {
      type: Boolean,
      default: false,
    },
    profileImage: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ALL_ROLES,
      default: ROLES.STUDENT,
      required: true,
    },
    accountStatus: {
      type: String,
      enum: ["active", "pending_affiliation", "pending_approval", "pending", "suspended"],
      default: "active",
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
    organizationName: {
      type: String,
      default: "",
      trim: true,
    },
    authorizedHostels: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Hostel",
      },
    ],
    invitationCodeUsed: {
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
      default: "",
      trim: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
    },
    roomNumber: {
      type: String,
      default: "",
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    specialization: {
      type: String,
      trim: true,
      default: "General Maintenance",
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
)

userSchema.index({ authenticationProvider: 1, providerUserId: 1 }, { unique: true })
userSchema.index({ role: 1 })
userSchema.index({ organizationId: 1, role: 1 })
userSchema.index({ hostelId: 1 })

module.exports = mongoose.model("User", userSchema)
