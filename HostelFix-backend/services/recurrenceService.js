const mongoose = require("mongoose")
const Complaint = require("../models/Complaint")

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")
}

/**
 * Generate a practical root-cause investigation suggestion
 */
function generateRootCauseSuggestion(category, roomNumber, count) {
  const roomLabel = roomNumber ? `Room ${roomNumber}` : "this location"
  switch (category) {
    case "Plumbing":
      return `Multiple plumbing reports (${count}) recorded in ${roomLabel} within the review window. Recommend inspecting primary supply line seals, drain valve integrity, and fixture joints rather than repeated washer fixes.`
    case "Electrical":
      return `Multiple electrical complaints (${count}) in ${roomLabel}. Suggest checking breaker panel distribution, switchboard grounding, and wall socket wiring for intermittent load faults.`
    case "Internet":
      return `Repeated network connection issues (${count}) in ${roomLabel}. Suggest checking nearest Wi-Fi access point channel interference, signal dead-zones, or physical RJ-45 wall termination.`
    case "Cleaning":
      return `Repeated cleaning requests (${count}) in ${roomLabel}. Recommend scheduling deep sanitation and verifying common area trash clearance frequency.`
    case "Water Supply":
      return `Repeated water supply issues (${count}) in ${roomLabel}. Check overhead tank booster pressure, floor isolation valve, and line aerators for sediment blockage.`
    case "Furniture":
      return `Multiple furniture repairs (${count}) in ${roomLabel}. Consider replacing worn components or inspecting floor-level mounting stability.`
    default:
      return `${count} repeated ${category} complaints logged for ${roomLabel} within the review period. Recommend comprehensive on-site technical inspection.`
  }
}

/**
 * Find potential recurring complaints within the same hostel, room, and category
 * @param {Object} complaint - Complaint document or plain object
 * @param {Object} [options] - Options (timeWindowDays, excludeUnrelated)
 */
async function findPossibleRecurringMatches(complaint, options = {}) {
  try {
    if (!complaint || !complaint.roomNumber || !complaint.category) {
      return { matches: [], count: 0, rootCauseSuggestion: "" }
    }

    const timeWindowDays = Number(options.timeWindowDays) || 30
    const complaintCreated = complaint.createdAt ? new Date(complaint.createdAt) : new Date()
    const cutoffDate = new Date(complaintCreated.getTime() - timeWindowDays * 24 * 60 * 60 * 1000)

    const query = {
      category: complaint.category,
      roomNumber: { $regex: new RegExp(`^${escapeRegex(String(complaint.roomNumber).trim())}$`, "i") },
      createdAt: { $gte: cutoffDate, $lte: complaintCreated },
    }

    // Strict Tenant Isolation: match by hostelId or hostelName
    if (complaint.hostelId) {
      query.hostelId = complaint.hostelId
    } else if (complaint.hostelName) {
      query.hostelName = { $regex: new RegExp(`^${escapeRegex(String(complaint.hostelName).trim())}$`, "i") }
    } else {
      // Cannot match without hostel scope
      return { matches: [], count: 0, rootCauseSuggestion: "" }
    }

    // Exclude current complaint if it has an ID
    if (complaint._id) {
      query._id = { $ne: complaint._id }
    }

    // Optionally exclude complaints already explicitly marked as unrelated
    if (options.excludeUnrelated) {
      query["recurringReview.decision"] = { $ne: "unrelated" }
    }

    const matchingComplaints = await Complaint.find(query)
      .sort({ createdAt: -1 })
      .limit(20)
      .select("complaintNumber title description category roomNumber status createdAt resolvedAt assignedTo recurringReview")
      .lean()

    const formattedMatches = matchingComplaints.map((m) => ({
      complaintId: m._id.toString(),
      complaintNumber: m.complaintNumber,
      title: m.title,
      category: m.category,
      roomNumber: m.roomNumber,
      status: m.status,
      assignedStaff: m.assignedTo?.staffName || "",
      createdAt: m.createdAt,
      resolvedAt: m.resolvedAt,
      similarityReason: `Same room (${m.roomNumber}) and category (${m.category}) within ${timeWindowDays} days`,
      decision: m.recurringReview?.decision || "pending",
    }))

    const matchCount = formattedMatches.length
    const rootCauseSuggestion =
      matchCount > 0
        ? generateRootCauseSuggestion(complaint.category, complaint.roomNumber, matchCount + 1)
        : ""

    return {
      matches: formattedMatches,
      count: matchCount,
      timeWindowDays,
      rootCauseSuggestion,
      roomNumber: complaint.roomNumber,
      category: complaint.category,
    }
  } catch (error) {
    console.error("[RecurrenceService] Error finding matches:", error.message)
    return { matches: [], count: 0, rootCauseSuggestion: "", error: error.message }
  }
}

/**
 * Identify recurring hotspots (rooms with >= 2 complaints in the same category)
 * for a specific hostel
 */
async function getRecurringHotspots(hostelIdOrFilter, timeWindowDays = 30) {
  try {
    const cutoffDate = new Date(Date.now() - timeWindowDays * 24 * 60 * 60 * 1000)
    const match = {
      createdAt: { $gte: cutoffDate },
      ...hostelIdOrFilter,
    }

    const hotspots = await Complaint.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            roomNumber: "$roomNumber",
            category: "$category",
          },
          complaintCount: { $sum: 1 },
          complaintNumbers: { $push: "$complaintNumber" },
          latestCreatedAt: { $max: "$createdAt" },
        },
      },
      {
        $match: {
          complaintCount: { $gte: 2 },
        },
      },
      {
        $sort: { complaintCount: -1 },
      },
      {
        $project: {
          _id: 0,
          roomNumber: "$_id.roomNumber",
          category: "$_id.category",
          complaintCount: 1,
          complaintNumbers: 1,
          latestCreatedAt: 1,
        },
      },
    ])

    return hotspots.map((h) => ({
      ...h,
      suggestion: generateRootCauseSuggestion(h.category, h.roomNumber, h.complaintCount),
    }))
  } catch (error) {
    console.error("[RecurrenceService] Error getting hotspots:", error.message)
    return []
  }
}

module.exports = {
  findPossibleRecurringMatches,
  getRecurringHotspots,
  generateRootCauseSuggestion,
}
