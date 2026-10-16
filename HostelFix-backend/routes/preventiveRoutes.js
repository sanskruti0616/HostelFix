const express = require("express")
const router = express.Router()
const mongoose = require("mongoose")
const PreventiveTask = require("../models/PreventiveTask")
const User = require("../models/User")
const Hostel = require("../models/Hostel")
const { authenticate } = require("../middleware/auth")
const { authorizeRoles } = require("../middleware/rbac")
const {
  ROLES,
  ALL_CATEGORIES,
  ALL_PREVENTIVE_STATUSES,
  PREVENTIVE_STATUS,
  ALL_PREVENTIVE_PRIORITIES,
  ALL_PREVENTIVE_FREQUENCIES,
} = require("../config/constants")
const { broadcast, emitToUser } = require("../services/socketService")

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")
}

/**
 * Generate sequential task number: PM-1001, PM-1002, etc.
 */
async function generateNextTaskNumber() {
  const latest = await PreventiveTask.findOne().sort({ createdAt: -1 }).select("taskNumber").lean()
  if (!latest || !latest.taskNumber) {
    return "PM-1001"
  }
  const match = latest.taskNumber.match(/PM-(\d+)/)
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1
    return `PM-${nextNum}`
  }
  return `PM-${Date.now().toString().slice(-4)}`
}

/**
 * Format a PreventiveTask Mongoose document
 */
function formatPreventiveTask(t) {
  const now = new Date()
  let dueState = "upcoming"

  if (t.status === PREVENTIVE_STATUS.COMPLETED) {
    dueState = "completed"
  } else if (t.status === PREVENTIVE_STATUS.CANCELLED) {
    dueState = "cancelled"
  } else if (t.dueAt) {
    const due = new Date(t.dueAt)
    if (now > due) {
      dueState = "overdue"
    } else {
      const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60)
      if (hoursUntilDue <= 48) {
        dueState = "due_soon"
      } else {
        dueState = "upcoming"
      }
    }
  }

  return {
    id: t._id.toString(),
    mongoId: t._id.toString(),
    taskNumber: t.taskNumber,
    title: t.title,
    description: t.description,
    category: t.category,
    location: t.location,
    roomNumber: t.roomNumber || "",
    building: t.building || "",
    dueAt: t.dueAt ? t.dueAt.toISOString() : null,
    priority: t.priority,
    frequency: t.frequency,
    status: t.status,
    dueState,
    hostelId: t.hostelId ? t.hostelId.toString() : null,
    hostelName: t.hostelName,
    organizationId: t.organizationId ? t.organizationId.toString() : null,
    assignedTo: t.assignedTo
      ? {
          staffId: t.assignedTo.staffId ? t.assignedTo.staffId.toString() : null,
          staffName: t.assignedTo.staffName || "",
          assignedAt: t.assignedTo.assignedAt ? t.assignedTo.assignedAt.toISOString() : null,
        }
      : null,
    createdBy: t.createdBy ? t.createdBy.toString() : null,
    createdByName: t.createdByName || "",
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    completedBy: t.completedBy ? t.completedBy.toString() : null,
    completionNotes: t.completionNotes || "",
    completionImages: t.completionImages || [],
    createdAt: t.createdAt ? t.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: t.updatedAt ? t.updatedAt.toISOString() : new Date().toISOString(),
  }
}

/**
 * Check if user can access / manage a preventive task
 */
function canAccessTask(user, task) {
  if (!user || !task) return false
  if (user.role === ROLES.PLATFORM_ADMIN) return true

  // Strict tenant match
  if (user.organizationId && task.organizationId) {
    if (user.organizationId.toString() !== task.organizationId.toString()) {
      return false
    }
  }

  if (user.role === ROLES.ADMIN) return true

  if (user.role === ROLES.WARDEN) {
    if (user.authorizedHostels && user.authorizedHostels.length > 0 && task.hostelId) {
      return user.authorizedHostels.some((hid) => hid.toString() === task.hostelId.toString())
    }
    if (user.hostelId && task.hostelId && user.hostelId.toString() === task.hostelId.toString()) {
      return true
    }
    if (user.hostelName && task.hostelName && user.hostelName.trim().toLowerCase() === task.hostelName.trim().toLowerCase()) {
      return true
    }
    return false
  }

  if (user.role === ROLES.STAFF) {
    if (task.assignedTo?.staffId && task.assignedTo.staffId.toString() === user._id.toString()) return true
    if (task.assignedTo?.staffName && user.name && task.assignedTo.staffName.trim().toLowerCase() === user.name.trim().toLowerCase()) return true
    return false
  }

  return false
}

/**
 * @route   GET /api/preventive-tasks
 * @desc    List preventive tasks filtered by role and tenant
 * @access  Private (Staff, Warden, Admin)
 */
router.get("/preventive-tasks", authenticate, async (req, res) => {
  try {
    const {
      status,
      category,
      priority,
      dueState,
      search,
      page = 1,
      limit = 50,
    } = req.query

    const filter = {}

    // Strict Tenant Boundary
    if (req.user.role !== ROLES.PLATFORM_ADMIN && req.user.organizationId) {
      filter.organizationId = req.user.organizationId
    }

    // Role-based scoping
    if (req.user.role === ROLES.STAFF) {
      filter.$or = [
        { "assignedTo.staffId": req.user._id },
        { "assignedTo.staffName": req.user.name },
      ]
    } else if (req.user.role === ROLES.WARDEN) {
      if (req.user.authorizedHostels && req.user.authorizedHostels.length > 0) {
        filter.$or = [
          { hostelId: { $in: req.user.authorizedHostels } },
          { hostelName: { $regex: new RegExp(`^${escapeRegex((req.user.hostelName || "").trim())}$`, "i") } },
        ]
      } else if (req.user.hostelId) {
        filter.$or = [
          { hostelId: req.user.hostelId },
          { hostelName: { $regex: new RegExp(`^${escapeRegex((req.user.hostelName || "").trim())}$`, "i") } },
        ]
      } else if (req.user.hostelName) {
        filter.hostelName = { $regex: new RegExp(`^${escapeRegex(req.user.hostelName.trim())}$`, "i") }
      }
    } else if (req.user.role === ROLES.ADMIN) {
      if (req.query.hostelId) {
        filter.hostelId = req.query.hostelId
      }
    }

    // Filters
    if (status && status !== "all") {
      filter.status = status
    }
    if (category && category !== "all") {
      filter.category = category
    }
    if (priority && priority !== "all") {
      filter.priority = priority
    }

    // Dynamic dueState filter
    const now = new Date()
    if (dueState === "overdue") {
      filter.dueAt = { $lt: now }
      filter.status = { $nin: [PREVENTIVE_STATUS.COMPLETED, PREVENTIVE_STATUS.CANCELLED] }
    } else if (dueState === "due_soon") {
      const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)
      filter.dueAt = { $gte: now, $lte: in48h }
      filter.status = { $nin: [PREVENTIVE_STATUS.COMPLETED, PREVENTIVE_STATUS.CANCELLED] }
    } else if (dueState === "upcoming") {
      const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)
      filter.dueAt = { $gt: in48h }
      filter.status = { $nin: [PREVENTIVE_STATUS.COMPLETED, PREVENTIVE_STATUS.CANCELLED] }
    } else if (dueState === "completed") {
      filter.status = PREVENTIVE_STATUS.COMPLETED
    }

    if (search) {
      const searchRegex = { $regex: escapeRegex(search.trim()), $options: "i" }
      filter.$or = [
        { taskNumber: searchRegex },
        { title: searchRegex },
        { description: searchRegex },
        { location: searchRegex },
      ]
    }

    const skip = (Number(page) - 1) * Number(limit)
    const [tasks, total] = await Promise.all([
      PreventiveTask.find(filter)
        .sort({ dueAt: 1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      PreventiveTask.countDocuments(filter),
    ])

    res.json({
      success: true,
      count: tasks.length,
      total,
      page: Number(page),
      tasks: tasks.map(formatPreventiveTask),
    })
  } catch (error) {
    console.error("[Preventive] List error:", error.message)
    res.status(500).json({ success: false, message: "Failed to load preventive tasks: " + error.message })
  }
})

/**
 * @route   POST /api/preventive-tasks
 * @desc    Warden creates and optionally assigns a preventive maintenance task
 * @access  Private (Warden, Admin)
 */
router.post("/preventive-tasks", authenticate, authorizeRoles(ROLES.WARDEN, ROLES.ADMIN), async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      location,
      roomNumber = "",
      building = "",
      dueAt,
      priority = "medium",
      frequency = "one-time",
      assignedStaffId,
    } = req.body

    // 1. Validate required fields
    if (!title || !description || !category || !location || !dueAt) {
      return res.status(400).json({
        success: false,
        message: "Title, description, category, location, and due date are required.",
      })
    }

    if (!ALL_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Allowed categories: ${ALL_CATEGORIES.join(", ")}`,
      })
    }

    const parsedDueAt = new Date(dueAt)
    if (isNaN(parsedDueAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid due date format. Please supply a valid date.",
      })
    }

    // 2. Resolve Warden / Admin hostel
    let targetHostelId = null
    let targetHostelName = ""
    let targetOrgId = req.user.organizationId || null

    if (req.user.role === ROLES.WARDEN) {
      if (req.user.hostelId) {
        targetHostelId = req.user.hostelId
        targetHostelName = req.user.hostelName || ""
      } else if (req.user.authorizedHostels && req.user.authorizedHostels.length > 0) {
        targetHostelId = req.user.authorizedHostels[0]
        targetHostelName = req.user.hostelName || ""
      } else if (req.user.hostelName) {
        targetHostelName = req.user.hostelName
      }

      if (!targetHostelId && targetHostelName) {
        const foundHostel = await Hostel.findOne({
          name: { $regex: new RegExp(`^${escapeRegex(targetHostelName.trim())}$`, "i") },
        })
        if (foundHostel) {
          targetHostelId = foundHostel._id
          targetHostelName = foundHostel.name
          if (foundHostel.organizationId) targetOrgId = foundHostel.organizationId
        }
      }
    } else {
      // Admin
      const hId = req.body.hostelId || req.user.hostelId
      if (hId) {
        const foundHostel = await Hostel.findById(hId)
        if (foundHostel) {
          targetHostelId = foundHostel._id
          targetHostelName = foundHostel.name
          if (foundHostel.organizationId) targetOrgId = foundHostel.organizationId
        }
      }
    }

    if (!targetHostelId) {
      return res.status(400).json({
        success: false,
        message: "Hostel not specified or warden is not affiliated with an active hostel.",
      })
    }

    // 3. Validate staff assignment if assignedStaffId is supplied
    let assignedToObj = {
      staffId: null,
      staffName: "",
      assignedAt: null,
      assignedBy: null,
    }

    if (assignedStaffId) {
      if (!mongoose.Types.ObjectId.isValid(assignedStaffId)) {
        return res.status(400).json({ success: false, message: "Invalid staff ID format" })
      }

      const staff = await User.findById(assignedStaffId)
      if (!staff || staff.role !== ROLES.STAFF) {
        return res.status(404).json({ success: false, message: "Staff member not found" })
      }

      if (staff.accountStatus !== "active") {
        return res.status(400).json({
          success: false,
          message: "Staff member is suspended or inactive and cannot be assigned tasks.",
        })
      }

      // STRICT MULTI-TENANT BOUNDARY: Staff must belong to the same hostel!
      let staffMatchesHostel = false
      if (staff.hostelId && staff.hostelId.toString() === targetHostelId.toString()) {
        staffMatchesHostel = true
      } else if (
        staff.authorizedHostels &&
        staff.authorizedHostels.some((h) => h.toString() === targetHostelId.toString())
      ) {
        staffMatchesHostel = true
      } else if (
        staff.hostelName &&
        staff.hostelName.trim().toLowerCase() === targetHostelName.trim().toLowerCase()
      ) {
        staffMatchesHostel = true
      }

      if (!staffMatchesHostel) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Cannot assign staff member from a different hostel.",
        })
      }

      assignedToObj = {
        staffId: staff._id,
        staffName: staff.name,
        assignedAt: new Date(),
        assignedBy: req.user._id,
      }
    }

    const taskNumber = await generateNextTaskNumber()

    const task = await PreventiveTask.create({
      taskNumber,
      title: title.trim(),
      description: description.trim(),
      category,
      location: location.trim(),
      roomNumber: roomNumber.trim(),
      building: building.trim(),
      dueAt: parsedDueAt,
      priority: ALL_PREVENTIVE_PRIORITIES.includes(priority) ? priority : "medium",
      frequency: ALL_PREVENTIVE_FREQUENCIES.includes(frequency) ? frequency : "one-time",
      status: PREVENTIVE_STATUS.SCHEDULED,
      hostelId: targetHostelId,
      hostelName: targetHostelName,
      organizationId: targetOrgId,
      assignedTo: assignedToObj,
      createdBy: req.user._id,
      createdByName: req.user.name,
    })

    const formatted = formatPreventiveTask(task)
    broadcast("preventive_task:created", formatted)

    if (assignedToObj.staffId) {
      emitToUser(assignedToObj.staffId.toString(), "preventive_task:assigned", formatted)
    }

    res.status(201).json({
      success: true,
      message: "Preventive maintenance task scheduled successfully",
      task: formatted,
    })
  } catch (error) {
    console.error("[Preventive] Creation error:", error.message)
    res.status(500).json({ success: false, message: "Failed to schedule task: " + error.message })
  }
})

/**
 * @route   GET /api/preventive-tasks/:id
 * @desc    Get single task details
 * @access  Private (Staff, Warden, Admin)
 */
router.get("/preventive-tasks/:id", authenticate, async (req, res) => {
  try {
    const id = req.params.id
    let query = {}
    if (mongoose.Types.ObjectId.isValid(id)) {
      query._id = id
    } else {
      query.taskNumber = id
    }

    const task = await PreventiveTask.findOne(query)
    if (!task) {
      return res.status(404).json({ success: false, message: "Preventive task not found" })
    }

    if (!canAccessTask(req.user, task)) {
      return res.status(403).json({ success: false, message: "Unauthorized for this task" })
    }

    res.json({
      success: true,
      task: formatPreventiveTask(task),
    })
  } catch (error) {
    console.error("[Preventive] Get error:", error.message)
    res.status(500).json({ success: false, message: "Failed to get task: " + error.message })
  }
})

/**
 * @route   PATCH /api/preventive-tasks/:id/status
 * @desc    Update task status (in-progress, completed, cancelled) with notes and photos
 * @access  Private (Assigned Staff, Warden, Admin)
 */
router.patch("/preventive-tasks/:id/status", authenticate, async (req, res) => {
  try {
    const id = req.params.id
    const { status, completionNotes = "", completionImages = [] } = req.body

    if (!status || !ALL_PREVENTIVE_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${ALL_PREVENTIVE_STATUSES.join(", ")}`,
      })
    }

    let query = {}
    if (mongoose.Types.ObjectId.isValid(id)) {
      query._id = id
    } else {
      query.taskNumber = id
    }

    const task = await PreventiveTask.findOne(query)
    if (!task) {
      return res.status(404).json({ success: false, message: "Preventive task not found" })
    }

    // Role-based authorization
    if (req.user.role === ROLES.STAFF) {
      // Staff must be the explicitly assigned technician!
      const isAssigned =
        (task.assignedTo?.staffId && task.assignedTo.staffId.toString() === req.user._id.toString()) ||
        (task.assignedTo?.staffName && req.user.name && task.assignedTo.staffName.trim().toLowerCase() === req.user.name.trim().toLowerCase())

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You are not assigned to this maintenance task.",
        })
      }
    } else if (req.user.role === ROLES.WARDEN) {
      if (!canAccessTask(req.user, task)) {
        return res.status(403).json({ success: false, message: "Unauthorized for this hostel" })
      }
    } else if (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.PLATFORM_ADMIN) {
      return res.status(403).json({ success: false, message: "Unauthorized" })
    }

    task.status = status

    if (status === PREVENTIVE_STATUS.COMPLETED) {
      task.completedAt = new Date()
      task.completedBy = req.user._id
      if (completionNotes) task.completionNotes = completionNotes.trim()
      if (Array.isArray(completionImages) && completionImages.length > 0) {
        task.completionImages = completionImages.map((img) => ({
          url: typeof img === "string" ? img : img.url,
          publicId: img.publicId || "",
          uploadedAt: new Date(),
        }))
      }
    } else if (status === PREVENTIVE_STATUS.IN_PROGRESS) {
      // If was scheduled, now in progress
    }

    await task.save()

    const formatted = formatPreventiveTask(task)
    broadcast("preventive_task:updated", formatted)

    res.json({
      success: true,
      message: `Preventive task marked as ${status}`,
      task: formatted,
    })
  } catch (error) {
    console.error("[Preventive] Status update error:", error.message)
    res.status(500).json({ success: false, message: "Failed to update task: " + error.message })
  }
})

module.exports = router
