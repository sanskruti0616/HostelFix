const express = require("express")
const router = express.Router()
const Complaint = require("../models/Complaint")
const ComplaintVerification = require("../models/ComplaintVerification")
const ComplaintStatusHistory = require("../models/ComplaintStatusHistory")
const Feedback = require("../models/Feedback")
const Assignment = require("../models/Assignment")
const User = require("../models/User")
const { authenticate } = require("../middleware/auth")
const { authorizeRoles, canAccessComplaint } = require("../middleware/rbac")
const {
  ROLES,
  COMPLAINT_STATUS,
  STATUS_TRANSITIONS,
  ALL_CATEGORIES,
  ALL_PRIORITIES,
} = require("../config/constants")
const { runVerificationPipeline } = require("../services/aiVerificationService")
const { sendNotification, notifyWardens } = require("../services/notificationService")
const { broadcast, emitToRole, emitToUser } = require("../services/socketService")

/**
 * Helper to generate sequential or readable complaint numbers: HF-1001, HF-1002, etc.
 */
async function generateNextComplaintNumber() {
  const latest = await Complaint.findOne().sort({ createdAt: -1 }).select("complaintNumber").lean()
  if (!latest || !latest.complaintNumber) {
    return "HF-1001"
  }
  const match = latest.complaintNumber.match(/HF-(\d+)/)
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1
    return `HF-${nextNum}`
  }
  return `HF-${Date.now().toString().slice(-4)}`
}

/**
 * Format a Complaint Mongoose document into standard API response object
 */
function formatComplaint(c) {
  return {
    id: c.complaintNumber || `HF-${c._id}`,
    mongoId: c._id,
    complaintNumber: c.complaintNumber,
    studentId: c.createdBy?._id || c.createdBy,
    studentName: c.studentName || "Student",
    studentEmail: c.studentEmail || "",
    hostel: c.hostelName || "",
    room: c.roomNumber || "",
    title: c.title,
    description: c.description,
    category: c.category,
    priority: c.priority,
    status: c.status,
    evidenceImages: c.evidenceImages || [],
    resolutionImages: c.resolutionImages || [],
    assignedStaff: c.assignedTo?.staffName || undefined,
    assignedStaffId: c.assignedTo?.staffId || undefined,
    verification: c.verification || undefined,
    duplicateOf: c.duplicateOf || undefined,
    resolvedAt: c.resolvedAt,
    resolvedBy: c.resolvedBy,
    workNotes: c.workNotes || "",
    closedAt: c.closedAt,
    rating: c.rating,
    ratingComments: c.ratingComments || "",
    ratedAt: c.ratedAt,
    createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: c.updatedAt ? c.updatedAt.toISOString() : new Date().toISOString(),
  }
}

/**
 * @route   GET /api/complaints
 * @desc    Get all complaints with server-side filters, search, and role scoping
 * @access  Private
 */
router.get("/complaints", authenticate, async (req, res) => {
  try {
    const {
      status,
      category,
      priority,
      room,
      hostel,
      search,
      page = 1,
      limit = 100,
    } = req.query

    const filter = {}

    // Role-based scope enforcement
    if (req.user.role === ROLES.STUDENT) {
      filter.createdBy = req.user._id
    } else if (req.user.role === ROLES.STAFF) {
      filter["assignedTo.staffId"] = req.user._id
    } else if (req.user.role === ROLES.WARDEN) {
      if (req.user.hostelName) {
        filter.hostelName = req.user.hostelName
      }
    }

    if (status && status !== "all") filter.status = status
    if (category && category !== "all") filter.category = category
    if (priority && priority !== "all") filter.priority = priority
    if (room) filter.roomNumber = { $regex: room, $options: "i" }
    if (hostel) filter.hostelName = { $regex: hostel, $options: "i" }

    if (search) {
      const searchRegex = { $regex: search, $options: "i" }
      filter.$or = [
        { complaintNumber: searchRegex },
        { title: searchRegex },
        { description: searchRegex },
        { studentName: searchRegex },
        { roomNumber: searchRegex },
      ]
    }

    const skip = (Number(page) - 1) * Number(limit)
    const [complaints, total] = await Promise.all([
      Complaint.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Complaint.countDocuments(filter),
    ])

    res.json({
      success: true,
      count: complaints.length,
      total,
      page: Number(page),
      complaints: complaints.map(formatComplaint),
    })
  } catch (error) {
    console.error("[Complaints] Get error:", error.message)
    res.status(500).json({
      success: false,
      message: "Failed to load complaints",
    })
  }
})

/**
 * @route   GET /api/complaints/export/csv
 * @desc    Export complaints within authorized scope to CSV
 * @access  Private (Warden, Admin)
 */
router.get("/complaints/export/csv", authenticate, authorizeRoles(ROLES.WARDEN, ROLES.ADMIN), async (req, res) => {
  try {
    const filter = {}
    if (req.user.role === ROLES.WARDEN && req.user.hostelName) {
      filter.hostelName = req.user.hostelName
    }

    const complaints = await Complaint.find(filter).sort({ createdAt: -1 }).lean()

    const headers = [
      "Complaint ID",
      "Title",
      "Category",
      "Priority",
      "Status",
      "Hostel",
      "Room",
      "Student",
      "Assigned Staff",
      "Created At",
      "Resolved At",
    ]

    const csvRows = [headers.join(",")]

    for (const c of complaints) {
      const escape = (val) => `"${String(val || "").replace(/"/g, '""')}"`
      csvRows.push(
        [
          escape(c.complaintNumber),
          escape(c.title),
          escape(c.category),
          escape(c.priority),
          escape(c.status),
          escape(c.hostelName),
          escape(c.roomNumber),
          escape(c.studentName),
          escape(c.assignedTo?.staffName),
          escape(c.createdAt ? c.createdAt.toISOString() : ""),
          escape(c.resolvedAt ? c.resolvedAt.toISOString() : ""),
        ].join(",")
      )
    }

    res.setHeader("Content-Type", "text/csv")
    res.setHeader("Content-Disposition", `attachment; filename=hostelfix_complaints_${Date.now()}.csv`)
    res.send(csvRows.join("\n"))
  } catch (error) {
    res.status(500).json({ success: false, message: "Export failed" })
  }
})

/**
 * @route   GET /api/complaints/:id
 * @desc    Get single complaint details by ID or complaintNumber
 * @access  Private
 */
router.get("/complaints/:id", authenticate, async (req, res) => {
  try {
    const param = req.params.id
    let query
    if (param.startsWith("HF-")) {
      query = { complaintNumber: param }
    } else {
      query = { _id: param }
    }

    const complaint = await Complaint.findOne(query)
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      })
    }

    if (!canAccessComplaint(req.user, complaint)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You are not authorized to view this complaint",
      })
    }

    // Include detailed verification if warden or admin
    let verificationRecord = null
    if ([ROLES.WARDEN, ROLES.ADMIN].includes(req.user.role)) {
      verificationRecord = await ComplaintVerification.findOne({ complaintId: complaint._id }).lean()
    }

    // Include feedback if resolved
    const feedback = await Feedback.findOne({ complaintId: complaint._id }).lean()

    res.json({
      success: true,
      complaint: formatComplaint(complaint),
      verificationDetails: verificationRecord,
      feedback: feedback
        ? { rating: feedback.rating, comments: feedback.comments, createdAt: feedback.createdAt }
        : null,
    })
  } catch (error) {
    console.error("[Complaints] Get single error:", error.message)
    res.status(500).json({
      success: false,
      message: "Failed to load complaint",
    })
  }
})

/**
 * @route   POST /api/complaints
 * @desc    Submit a new complaint with AI-assisted verification
 * @access  Private (Student)
 */
router.post("/complaints", authenticate, authorizeRoles(ROLES.STUDENT, ROLES.ADMIN), async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      priority,
      hostel,
      room,
      evidenceImages = [],
    } = req.body

    if (!title || !description || !category) {
      return res.status(400).json({
        success: false,
        message: "Title, description, and category are required",
      })
    }

    if (!ALL_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Allowed: ${ALL_CATEGORIES.join(", ")}`,
      })
    }

    const finalPriority = priority && ALL_PRIORITIES.includes(priority) ? priority : "medium"
    const finalHostel = hostel || req.user.hostelName || "Hostel A"
    const finalRoom = room || req.user.roomNumber || "101"

    const complaintNumber = await generateNextComplaintNumber()

    // Create the complaint
    const complaint = await Complaint.create({
      complaintNumber,
      createdBy: req.user._id,
      studentName: req.user.name,
      studentEmail: req.user.email,
      hostelName: finalHostel.trim(),
      roomNumber: finalRoom.trim(),
      title: title.trim(),
      description: description.trim(),
      category,
      priority: finalPriority,
      status: COMPLAINT_STATUS.SUBMITTED,
      evidenceImages,
    })

    // Log creation in status history
    await ComplaintStatusHistory.create({
      complaintId: complaint._id,
      previousStatus: null,
      newStatus: COMPLAINT_STATUS.SUBMITTED,
      changedBy: req.user._id,
      changedByName: req.user.name,
      changedByRole: req.user.role,
      remarks: "Complaint submitted by student.",
      timestamp: new Date(),
    })

    // Run AI verification pipeline asynchronously or synchronously
    const firstImageHash = evidenceImages.length > 0 ? evidenceImages[0].hash : null
    const firstImageBlurry = evidenceImages.length > 0 ? Boolean(evidenceImages[0].isBlurry) : false

    const verificationResult = await runVerificationPipeline(complaint, {
      imageHash: firstImageHash,
      isBlurry: firstImageBlurry,
    })

    // Save verification assessment in MongoDB
    const verificationDoc = await ComplaintVerification.create({
      complaintId: complaint._id,
      verificationType: verificationResult.verificationType,
      result: verificationResult.result,
      confidence: verificationResult.confidence,
      explanation: verificationResult.explanation,
      duplicateMatches: verificationResult.duplicateMatches,
      evidenceQuality: verificationResult.evidenceQuality,
      aiAssessment: verificationResult.aiAssessment,
    })

    // Update complaint verification summary
    complaint.verification = {
      isVerified: verificationResult.result === "verified",
      verificationType: "ai_assisted",
      result: verificationResult.result,
      confidence: verificationResult.confidence,
      explanation: verificationResult.explanation,
    }

    if (verificationResult.result === "potential_duplicate" && verificationResult.duplicateMatches.length > 0) {
      complaint.duplicateOf = verificationResult.duplicateMatches[0].complaintId
    }

    await complaint.save()

    // Real-time notifications
    await sendNotification({
      recipientUserId: req.user._id,
      complaintId: complaint._id,
      complaintNumber: complaint.complaintNumber,
      type: "complaint_submitted",
      title: "Complaint Registered",
      message: `Your complaint #${complaint.complaintNumber} has been received and queued for review.`,
    })

    await notifyWardens({
      complaintId: complaint._id,
      complaintNumber: complaint.complaintNumber,
      type: "new_complaint",
      title: "New Complaint Submitted",
      message: `${req.user.name} submitted #${complaint.complaintNumber} in ${finalHostel} (${category}).`,
    })

    // Broadcast complaint creation to real-time subscribers
    broadcast("complaint:created", formatComplaint(complaint))

    res.status(201).json({
      success: true,
      message: "Complaint created successfully",
      complaint: formatComplaint(complaint),
      verification: verificationDoc,
    })
  } catch (error) {
    console.error("[Complaints] Creation error:", error.message)
    res.status(500).json({
      success: false,
      message: "Failed to create complaint: " + error.message,
    })
  }
})

/**
 * @route   POST /api/complaints/:id/verify
 * @desc    Warden manually verifies or rejects a complaint with recorded explanation
 * @access  Private (Warden, Admin)
 */
router.post("/complaints/:id/verify", authenticate, authorizeRoles(ROLES.WARDEN, ROLES.ADMIN), async (req, res) => {
  try {
    const { action, reason } = req.body // action: 'approve' | 'reject' | 'request_info'
    const param = req.params.id
    const query = param.startsWith("HF-") ? { complaintNumber: param } : { _id: param }

    const complaint = await Complaint.findOne(query)
    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" })
    }

    if (!canAccessComplaint(req.user, complaint)) {
      return res.status(403).json({ success: false, message: "Unauthorized for this hostel" })
    }

    let newStatus = complaint.status
    let statusRemark = reason || ""

    if (action === "approve") {
      newStatus = COMPLAINT_STATUS.VERIFIED
      complaint.verification.isVerified = true
      complaint.verification.result = "verified"
      statusRemark = statusRemark || "Complaint verified by warden."
    } else if (action === "reject") {
      newStatus = COMPLAINT_STATUS.REJECTED
      complaint.verification.isVerified = false
      complaint.verification.result = "rejected"
      statusRemark = statusRemark || "Complaint rejected by warden."
    } else if (action === "request_info") {
      newStatus = COMPLAINT_STATUS.NEEDS_INFORMATION
      complaint.verification.result = "needs_information"
      statusRemark = statusRemark || "Additional information requested by warden."
    }

    const oldStatus = complaint.status
    complaint.status = newStatus
    complaint.verification.reviewedBy = req.user._id
    complaint.verification.reviewedAt = new Date()
    complaint.verification.explanation = statusRemark

    await complaint.save()

    // Add audit history
    await ComplaintStatusHistory.create({
      complaintId: complaint._id,
      previousStatus: oldStatus,
      newStatus,
      changedBy: req.user._id,
      changedByName: req.user.name,
      changedByRole: req.user.role,
      remarks: statusRemark,
      timestamp: new Date(),
    })

    // Notify student
    await sendNotification({
      recipientUserId: complaint.createdBy,
      complaintId: complaint._id,
      complaintNumber: complaint.complaintNumber,
      type: `verification_${action}`,
      title: `Complaint Update: ${complaint.complaintNumber}`,
      message: statusRemark,
    })

    broadcast("complaint:updated", formatComplaint(complaint))

    res.json({
      success: true,
      message: `Complaint verification updated: ${newStatus}`,
      complaint: formatComplaint(complaint),
    })
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to verify complaint" })
  }
})

/**
 * @route   POST /api/complaints/:id/assign
 * @desc    Warden assigns maintenance staff member
 * @access  Private (Warden, Admin)
 */
router.patch("/complaints/:id/assign", authenticate, authorizeRoles(ROLES.WARDEN, ROLES.ADMIN), async (req, res) => {
  try {
    const { staff_id, staffName, instructions = "" } = req.body
    const param = req.params.id
    const query = param.startsWith("HF-") ? { complaintNumber: param } : { _id: param }

    const complaint = await Complaint.findOne(query)
    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" })
    }

    if (!canAccessComplaint(req.user, complaint)) {
      return res.status(403).json({ success: false, message: "Unauthorized for this hostel" })
    }

    let staff = null
    if (staff_id) {
      staff = await User.findById(staff_id)
    } else if (staffName) {
      staff = await User.findOne({ name: staffName, role: ROLES.STAFF })
    }

    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff member not found" })
    }

    const oldStatus = complaint.status
    let newStatus = complaint.status
    if (oldStatus === COMPLAINT_STATUS.SUBMITTED || oldStatus === COMPLAINT_STATUS.VERIFIED) {
      newStatus = COMPLAINT_STATUS.ASSIGNED
    }

    complaint.assignedTo = {
      staffId: staff._id,
      staffName: staff.name,
      assignedAt: new Date(),
      assignedBy: req.user._id,
    }
    complaint.status = newStatus
    await complaint.save()

    // Create assignment record
    await Assignment.create({
      complaintId: complaint._id,
      assignedTo: staff._id,
      assignedBy: req.user._id,
      instructions,
      status: "assigned",
      assignedAt: new Date(),
    })

    // Audit log
    await ComplaintStatusHistory.create({
      complaintId: complaint._id,
      previousStatus: oldStatus,
      newStatus,
      changedBy: req.user._id,
      changedByName: req.user.name,
      changedByRole: req.user.role,
      remarks: `Assigned to ${staff.name}. ${instructions}`.trim(),
      timestamp: new Date(),
    })

    // Notify assigned staff
    await sendNotification({
      recipientUserId: staff._id,
      complaintId: complaint._id,
      complaintNumber: complaint.complaintNumber,
      type: "staff_assigned",
      title: "New Task Assigned",
      message: `You were assigned complaint #${complaint.complaintNumber} (${complaint.category} in Room ${complaint.roomNumber}).`,
    })

    // Notify student
    await sendNotification({
      recipientUserId: complaint.createdBy,
      complaintId: complaint._id,
      complaintNumber: complaint.complaintNumber,
      type: "staff_assigned",
      title: "Staff Assigned",
      message: `Maintenance technician ${staff.name} has been assigned to your complaint #${complaint.complaintNumber}.`,
    })

    broadcast("complaint:updated", formatComplaint(complaint))

    res.json({
      success: true,
      message: `Complaint assigned to ${staff.name}`,
      complaint: formatComplaint(complaint),
    })
  } catch (error) {
    console.error("[Complaints] Assign error:", error.message)
    res.status(500).json({ success: false, message: "Failed to assign staff" })
  }
})

/**
 * @route   PATCH /api/complaints/:id/status
 * @desc    Update complaint lifecycle status with authorization and state-transition rules
 * @access  Private (Student, Warden, Staff, Admin)
 */
router.patch("/complaints/:id/status", authenticate, async (req, res) => {
  try {
    const { status, note = "" } = req.body
    const param = req.params.id
    const query = param.startsWith("HF-") ? { complaintNumber: param } : { _id: param }

    const complaint = await Complaint.findOne(query)
    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" })
    }

    if (!canAccessComplaint(req.user, complaint)) {
      return res.status(403).json({ success: false, message: "Forbidden: Cannot update this complaint" })
    }

    const oldStatus = complaint.status

    if (oldStatus === status) {
      return res.json({
        success: true,
        message: "Complaint status is already set to this value",
        complaint: formatComplaint(complaint),
      })
    }

    // Validate state transitions based on role
    const allowedTransitions = STATUS_TRANSITIONS[req.user.role]?.[oldStatus] || []
    if (req.user.role !== ROLES.ADMIN && !allowedTransitions.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from '${oldStatus}' to '${status}' for role '${req.user.role}'. Allowed: [${allowedTransitions.join(", ")}]`,
      })
    }

    complaint.status = status
    if (status === COMPLAINT_STATUS.RESOLVED) {
      complaint.resolvedAt = new Date()
      complaint.resolvedBy = req.user._id
      if (note) {
        complaint.workNotes = String(note).trim()
      }
    } else if (status === COMPLAINT_STATUS.CLOSED) {
      complaint.closedAt = new Date()
    }

    await complaint.save()

    // Audit log
    await ComplaintStatusHistory.create({
      complaintId: complaint._id,
      previousStatus: oldStatus,
      newStatus: status,
      changedBy: req.user._id,
      changedByName: req.user.name,
      changedByRole: req.user.role,
      remarks: note || `Status transitioned from ${oldStatus} to ${status}.`,
      timestamp: new Date(),
    })

    // Notify relevant parties
    if (req.user.role === ROLES.STAFF && status === COMPLAINT_STATUS.RESOLVED) {
      await sendNotification({
        recipientUserId: complaint.createdBy,
        complaintId: complaint._id,
        complaintNumber: complaint.complaintNumber,
        type: "complaint_resolved",
        title: "Complaint Resolved",
        message: `Technician marked #${complaint.complaintNumber} as completed. Please verify and leave feedback!`,
      })
    }

    broadcast("complaint:updated", formatComplaint(complaint))

    res.json({
      success: true,
      message: `Complaint status updated to ${status}`,
      complaint: formatComplaint(complaint),
    })
  } catch (error) {
    console.error("[Complaints] Status update error:", error.message)
    res.status(500).json({ success: false, message: "Failed to update complaint status" })
  }
})

/**
 * @route   GET /api/complaints/:id/updates
 * @desc    Get complete audit timeline of status updates for a complaint
 * @access  Private
 */
router.get("/complaints/:id/updates", authenticate, async (req, res) => {
  try {
    const param = req.params.id
    const query = param.startsWith("HF-") ? { complaintNumber: param } : { _id: param }

    const complaint = await Complaint.findOne(query).select("_id complaintNumber createdBy hostelId hostelName")
    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" })
    }

    if (!canAccessComplaint(req.user, complaint)) {
      return res.status(403).json({ success: false, message: "Forbidden" })
    }

    const updates = await ComplaintStatusHistory.find({ complaintId: complaint._id })
      .sort({ timestamp: 1 })
      .lean()

    res.json({
      success: true,
      count: updates.length,
      updates: updates.map((u) => ({
        id: u._id,
        complaint_id: u.complaintId,
        user_id: u.changedBy,
        old_status: u.previousStatus,
        new_status: u.newStatus,
        note: u.remarks,
        created_at: u.timestamp.toISOString(),
        user_name: u.changedByName,
        user_role: u.changedByRole,
      })),
    })
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load complaint history" })
  }
})

/**
 * @route   POST /api/complaints/:id/feedback
 * @desc    Student leaves feedback rating for a resolved complaint
 * @access  Private (Student)
 */
router.post("/complaints/:id/feedback", authenticate, authorizeRoles(ROLES.STUDENT), async (req, res) => {
  try {
    const { rating, comments = "", workQuality, timeliness, professionalism } = req.body
    const numericRating = Number(rating)

    if (!numericRating || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be an integer between 1 and 5" })
    }

    const param = req.params.id
    const query = param.startsWith("HF-") ? { complaintNumber: param } : { _id: param }

    const complaint = await Complaint.findOne(query)
    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" })
    }

    // 1. Verify student ownership
    if (complaint.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Only the student who filed this complaint can submit feedback" })
    }

    // 2. Verify complaint is in resolved or closed state
    if (complaint.status !== COMPLAINT_STATUS.RESOLVED && complaint.status !== COMPLAINT_STATUS.CLOSED) {
      return res.status(400).json({
        success: false,
        message: "Feedback can only be submitted after the complaint has been marked as resolved by maintenance staff.",
      })
    }

    // 3. Verify associated maintenance staff member
    const staffId = complaint.assignedTo && complaint.assignedTo.staffId ? complaint.assignedTo.staffId : null
    if (!staffId) {
      return res.status(400).json({
        success: false,
        message: "A maintenance staff member must be assigned to this ticket before submitting a rating.",
      })
    }

    // Validate optional dimensions if provided
    const cleanDimensions = {}
    if (workQuality !== undefined) {
      const wq = Number(workQuality)
      if (wq >= 1 && wq <= 5) cleanDimensions.workQuality = wq
    }
    if (timeliness !== undefined) {
      const tm = Number(timeliness)
      if (tm >= 1 && tm <= 5) cleanDimensions.timeliness = tm
    }
    if (professionalism !== undefined) {
      const pf = Number(professionalism)
      if (pf >= 1 && pf <= 5) cleanDimensions.professionalism = pf
    }

    // 4. Upsert feedback in Feedback model
    const feedback = await Feedback.findOneAndUpdate(
      { complaintId: complaint._id },
      {
        submittedBy: req.user._id,
        staffId,
        rating: numericRating,
        comments: String(comments).trim().slice(0, 500),
        ...cleanDimensions,
      },
      { upsert: true, new: true }
    )

    // 5. Update complaint record and close complaint
    complaint.rating = numericRating
    complaint.ratingComments = String(comments).trim().slice(0, 500)
    complaint.ratedAt = new Date()
    complaint.status = COMPLAINT_STATUS.CLOSED
    complaint.closedAt = new Date()
    await complaint.save()

    // 6. Record status history audit
    await ComplaintStatusHistory.create({
      complaintId: complaint._id,
      previousStatus: COMPLAINT_STATUS.RESOLVED,
      newStatus: COMPLAINT_STATUS.CLOSED,
      changedBy: req.user._id,
      changedByName: req.user.name,
      changedByRole: req.user.role,
      remarks: `Student rated service ${numericRating}/5 stars. Complaint closed.`,
      timestamp: new Date(),
    })

    // 7. Notify staff of rating
    await sendNotification({
      recipientUserId: staffId,
      complaintId: complaint._id,
      complaintNumber: complaint.complaintNumber,
      type: "feedback_received",
      title: "Student Rating Received",
      message: `Student left a ${numericRating}-star review on #${complaint.complaintNumber}.`,
    })

    broadcast("complaint:updated", formatComplaint(complaint))

    res.json({
      success: true,
      message: "Feedback submitted successfully. Thank you for rating the service!",
      feedback,
      complaint: formatComplaint(complaint),
    })
  } catch (error) {
    console.error("[Complaints] Feedback error:", error.message)
    res.status(500).json({ success: false, message: "Failed to submit feedback" })
  }
})

module.exports = router
