const Complaint = require("../models/Complaint")
const { findDuplicateImagesInScope } = require("./imageService")
require("../config/loadEnv")

// Category keyword dictionary for Stage 2 consistency check
const CATEGORY_KEYWORDS = {
  Electrical: [
    "fan", "light", "switch", "socket", "wire", "spark", "bulb", "tube", "power", "fuse",
    "mcb", "voltage", "current", "short", "plug", "geyser switch", "ac", "cooler", "shock"
  ],
  Plumbing: [
    "leak", "pipe", "tap", "faucet", "drain", "water", "sink", "basin", "flush", "shower",
    "clog", "choke", "sewage", "drip", "overflow", "toilet", "commode", "pipeline"
  ],
  Internet: [
    "wifi", "internet", "lan", "network", "router", "ethernet", "connection", "speed",
    "disconnect", "slow", "ping", "signal", "portal", "ip"
  ],
  Cleaning: [
    "clean", "dust", "dirt", "garbage", "trash", "mop", "sweep", "waste", "stain",
    "smell", "odor", "bathroom dirty", "corridor", "litter", "pest", "insects"
  ],
  Furniture: [
    "bed", "table", "chair", "mattress", "cupboard", "almirah", "wardrobe", "door", "hinge",
    "handle", "lock", "drawer", "shelf", "desk", "window latch", "cot", "plywood"
  ],
  "Water Supply": [
    "drinking water", "no water", "water timing", "dirty water", "muddy water", "overhead tank",
    "water pressure", "filter", "ro", "purifier", "tanker"
  ],
  Security: [
    "theft", "stolen", "lock broken", "intruder", "guard", "gate", "cctv", "grill", "key lost",
    "trespassing", "safety", "harassment"
  ],
  Other: [],
}

/**
 * Stage 1: Validate required fields
 */
function validateRequiredFields(complaint) {
  const missing = []
  if (!complaint.title || complaint.title.trim().length < 5) {
    missing.push("Title must be at least 5 characters")
  }
  if (!complaint.description || complaint.description.trim().length < 10) {
    missing.push("Description must be at least 10 characters")
  }
  if (!complaint.category) {
    missing.push("Category is required")
  }
  if (!complaint.hostelName) {
    missing.push("Hostel is required")
  }
  if (!complaint.roomNumber) {
    missing.push("Room number is required")
  }

  return {
    isValid: missing.length === 0,
    missing,
  }
}

/**
 * Stage 2: Category consistency check
 */
function checkCategoryConsistency(title, description, selectedCategory) {
  const text = `${title} ${description}`.toLowerCase()
  const expectedKeywords = CATEGORY_KEYWORDS[selectedCategory] || []

  // Check if keywords from the selected category appear
  const matchesCurrent = expectedKeywords.filter((kw) => text.includes(kw.toLowerCase()))

  // Check if keywords from other categories are overwhelmingly present
  let suggestedCategory = selectedCategory
  let maxOtherMatches = 0

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (cat === selectedCategory || cat === "Other") continue
    const matches = keywords.filter((kw) => text.includes(kw.toLowerCase()))
    if (matches.length > maxOtherMatches && matches.length >= 2) {
      maxOtherMatches = matches.length
      suggestedCategory = cat
    }
  }

  const isConsistent = selectedCategory === "Other" || matchesCurrent.length > 0 || maxOtherMatches < 2

  return {
    isConsistent,
    matchedKeywords: matchesCurrent,
    suggestedCategory: isConsistent ? selectedCategory : suggestedCategory,
    confidence: isConsistent ? (matchesCurrent.length > 0 ? 0.9 : 0.7) : 0.4,
  }
}

const mongoose = require("mongoose")

/**
 * Stage 3: Duplicate detection (Text + Image hash)
 */
async function checkDuplicateComplaints(complaint, imageHash = null) {
  const duplicateMatches = []

  if (mongoose.connection.readyState !== 1) {
    return duplicateMatches
  }

  // 1. Image hash duplicates
  if (imageHash) {
    const imageDuplicates = await findDuplicateImagesInScope(
      imageHash,
      complaint.hostelId,
      complaint._id
    )
    for (const match of imageDuplicates) {
      duplicateMatches.push({
        complaintId: match.complaintId,
        complaintNumber: match.complaintNumber,
        similarityScore: match.similarityScore,
        matchType: "image_hash",
        details: `Visually similar evidence (${match.similarityScore}%) found in complaint ${match.complaintNumber}`,
      })
    }
  }

  // 2. Text similarity in the same hostel and room
  const activeSameRoom = await Complaint.find({
    _id: { $ne: complaint._id },
    hostelName: complaint.hostelName,
    roomNumber: complaint.roomNumber,
    category: complaint.category,
    status: { $nin: ["resolved", "closed", "rejected", "cancelled"] },
  })
    .select("_id complaintNumber title description createdAt")
    .limit(5)
    .lean()

  for (const prev of activeSameRoom) {
    const prevTokens = new Set(`${prev.title} ${prev.description}`.toLowerCase().split(/\s+/))
    const currTokens = new Set(`${complaint.title} ${complaint.description}`.toLowerCase().split(/\s+/))
    let intersection = 0
    for (const token of currTokens) {
      if (token.length > 3 && prevTokens.has(token)) intersection++
    }
    const tokenScore = Math.min(Math.round((intersection / Math.max(1, currTokens.size)) * 100), 100)

    if (tokenScore >= 40) {
      duplicateMatches.push({
        complaintId: prev._id,
        complaintNumber: prev.complaintNumber,
        similarityScore: tokenScore,
        matchType: "text_similarity",
        details: `Similar ongoing ${complaint.category} complaint found for room ${complaint.roomNumber} (${prev.complaintNumber})`,
      })
    }
  }

  return duplicateMatches
}

/**
 * Stage 5: External AI Provider (Google Gemini Vision/Flash if key is present)
 */
async function runGeminiVisionAssessment(complaint, imageBuffers) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_PROVIDER_API_KEY

  if (!apiKey) {
    return null // Return null to fallback to local heuristic
  }

  try {
    const { GoogleGenerativeAI } = require("@google/generative-ai")
    const genAI = new GoogleGenerativeAI(apiKey)
    const modelName = process.env.GEMINI_MODEL || "gemini-3.8-flash"
    const model = genAI.getGenerativeModel({ model: modelName })

    const prompt = `You are an AI assistant for a hostel maintenance complaint system.
Analyze this complaint and the attached evidence:
Complaint Title: "${complaint.title}"
Category: "${complaint.category}"
Description: "${complaint.description}"
Location: "${complaint.hostelName}, Room ${complaint.roomNumber}"

Provide an assessment formatted strictly as JSON with the following keys:
{
  "categoryMatchesEvidence": boolean,
  "confidenceScore": number (0.0 to 1.0),
  "evidenceQuality": "good" | "blurry" | "irrelevant" | "none",
  "missingInformation": string[],
  "summaryExplanation": string,
  "recommendedAction": "verify" | "request_info" | "reject" | "review_manually"
}`

    const parts = [prompt]
    if (imageBuffers && imageBuffers.length > 0) {
      for (const img of imageBuffers) {
        parts.push({
          inlineData: {
            data: img.buffer.toString("base64"),
            mimeType: img.mimeType || "image/jpeg",
          },
        })
      }
    }

    const generatePromise = model.generateContent(parts)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Gemini API request timed out after 8 seconds")), 8000)
    )
    const result = await Promise.race([generatePromise, timeoutPromise])
    const responseText = result.response.text()
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (err) {
    console.warn("[AIVerification] Gemini API call skipped or encountered error:", err.message)
    return null
  }
}

/**
 * Full AI-Assisted Complaint Verification Pipeline
 */
async function runVerificationPipeline(complaint, options = {}) {
  const { imageHash = null, isBlurry = false, imageBuffers = [] } = options

  // Stage 1: Field validation
  const stage1 = validateRequiredFields(complaint)
  if (!stage1.isValid) {
    return {
      verificationType: "ai_and_rules",
      result: "needs_information",
      confidence: 0.95,
      explanation: `Complaint is missing essential details: ${stage1.missing.join(", ")}`,
      duplicateMatches: [],
      evidenceQuality: { isValidFormat: true, isBlurry, notes: "Incomplete description" },
      aiAssessment: {
        categoryConsistent: false,
        suggestedCategory: complaint.category,
        missingInformation: stage1.missing,
        recommendedAction: "Request more details from the student before proceeding",
        providerUsed: "rule_engine",
      },
    }
  }

  // Stage 2: Category consistency
  const stage2 = checkCategoryConsistency(complaint.title, complaint.description, complaint.category)

  // Stage 3: Duplicate detection
  const duplicateMatches = await checkDuplicateComplaints(complaint, imageHash)
  const hasHighDuplicate = duplicateMatches.some((m) => m.similarityScore >= 80)

  // Stage 4: Evidence quality
  const evidenceQualityNotes = []
  if (isBlurry) evidenceQualityNotes.push("Uploaded image appears blurry or low contrast.")
  if (!complaint.evidenceImages || complaint.evidenceImages.length === 0) {
    evidenceQualityNotes.push("No photo attached (visual verification unavailable).")
  }

  // Stage 5: AI Provider if available
  const geminiResult = await runGeminiVisionAssessment(complaint, imageBuffers)

  // Stage 6: Deterministic decision synthesis
  let result = "verified"
  let confidence = 0.88
  let explanation = "Complaint description and category appear genuine and consistent with hostel maintenance standards."
  let recommendedAction = "Proceed with staff assignment"
  let providerUsed = geminiResult ? "google_gemini_vision" : "local_heuristic_engine"

  if (hasHighDuplicate) {
    result = "potential_duplicate"
    confidence = 0.85
    explanation = `Potential duplicate issue detected: ${duplicateMatches[0].details}. Verify with previous record.`
    recommendedAction = "Review existing complaint before re-assigning staff"
  } else if (!stage2.isConsistent) {
    result = "needs_information"
    confidence = 0.75
    explanation = `The description mentions terms related to '${stage2.suggestedCategory}', but '${complaint.category}' was selected. Possible category mismatch.`
    recommendedAction = `Confirm issue category with student (suggested: ${stage2.suggestedCategory})`
  } else if (isBlurry) {
    result = "needs_information"
    confidence = 0.7
    explanation = "The attached photograph is unreadable or excessively blurry. Additional clear photo requested."
    recommendedAction = "Request clear evidence image from the student"
  }

  if (geminiResult) {
    if (geminiResult.summaryExplanation) {
      explanation += ` AI Vision assessment: ${geminiResult.summaryExplanation}`
    }
    if (geminiResult.confidenceScore) {
      confidence = Math.round(((confidence + geminiResult.confidenceScore) / 2) * 100) / 100
    }
  }

  return {
    verificationType: "ai_and_rules",
    result,
    confidence,
    explanation,
    duplicateMatches,
    evidenceQuality: {
      isValidFormat: true,
      isBlurry,
      notes: evidenceQualityNotes.join(" ") || "Evidence quality acceptable",
    },
    aiAssessment: {
      categoryConsistent: stage2.isConsistent,
      suggestedCategory: stage2.suggestedCategory,
      missingInformation: stage1.missing,
      recommendedAction,
      providerUsed,
    },
  }
}

module.exports = {
  validateRequiredFields,
  checkCategoryConsistency,
  checkDuplicateComplaints,
  runVerificationPipeline,
}
