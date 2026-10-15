const mongoose = require("mongoose")

const complaintVerificationSchema = new mongoose.Schema(
  {
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
      required: true,
      index: true,
    },
    verificationType: {
      type: String,
      enum: ["ai_and_rules", "manual_warden", "automated"],
      default: "ai_and_rules",
    },
    result: {
      type: String,
      enum: ["verified", "potential_duplicate", "needs_information", "rejected", "suspicious", "pending"],
      default: "pending",
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
    explanation: {
      type: String,
      default: "",
    },
    duplicateMatches: [
      {
        complaintId: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint" },
        complaintNumber: { type: String, default: "" },
        similarityScore: { type: Number, default: 0 },
        matchType: { type: String, enum: ["image_hash", "text_similarity", "location_category"] },
      },
    ],
    evidenceQuality: {
      isValidFormat: { type: Boolean, default: true },
      isBlurry: { type: Boolean, default: false },
      dimensions: { width: Number, height: Number },
      fileSize: Number,
      notes: { type: String, default: "" },
    },
    aiAssessment: {
      categoryConsistent: { type: Boolean, default: true },
      suggestedCategory: { type: String, default: "" },
      missingInformation: [String],
      recommendedAction: { type: String, default: "" },
      providerUsed: { type: String, default: "local_heuristic" },
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

module.exports = mongoose.model("ComplaintVerification", complaintVerificationSchema)
