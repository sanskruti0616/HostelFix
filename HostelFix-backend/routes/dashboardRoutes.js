const express = require("express")
const router = express.Router()
const Complaint = require("../models/Complaint")
const User = require("../models/User")
const Hostel = require("../models/Hostel")
const Room = require("../models/Room")
const ComplaintVerification = require("../models/ComplaintVerification")
const { authenticate } = require("../middleware/auth")
const { authorizeRoles } = require("../middleware/rbac")
const { ROLES, COMPLAINT_STATUS } = require("../config/constants")

/**
 * @route   GET /api/dashboard/student
 * @desc    Metrics & recent activity for logged in student
 * @access  Private (Student)
 */
router.get("/dashboard/student", authenticate, authorizeRoles(ROLES.STUDENT, ROLES.ADMIN), async (req, res) => {
  try {
    const studentId = req.user._id

    const [statsResult, recentComplaints] = await Promise.all([
      Complaint.aggregate([
        { $match: { createdBy: studentId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            submitted: {
              $sum: { $cond: [{ $eq: ["$status", COMPLAINT_STATUS.SUBMITTED] }, 1, 0] },
            },
            pendingVerification: {
              $sum: { $cond: [{ $eq: ["$status", COMPLAINT_STATUS.PENDING_VERIFICATION] }, 1, 0] },
            },
            assigned: {
              $sum: { $cond: [{ $eq: ["$status", COMPLAINT_STATUS.ASSIGNED] }, 1, 0] },
            },
            inProgress: {
              $sum: { $cond: [{ $eq: ["$status", COMPLAINT_STATUS.IN_PROGRESS] }, 1, 0] },
            },
            resolved: {
              $sum: { $cond: [{ $eq: ["$status", COMPLAINT_STATUS.RESOLVED] }, 1, 0] },
            },
            closed: {
              $sum: { $cond: [{ $eq: ["$status", COMPLAINT_STATUS.CLOSED] }, 1, 0] },
            },
            rejected: {
              $sum: { $cond: [{ $eq: ["$status", COMPLAINT_STATUS.REJECTED] }, 1, 0] },
            },
          },
        },
      ]),
      Complaint.find({ createdBy: studentId })
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean(),
    ])

    const stats = statsResult[0] || {
      total: 0,
      submitted: 0,
      pendingVerification: 0,
      assigned: 0,
      inProgress: 0,
      resolved: 0,
      closed: 0,
      rejected: 0,
    }

    res.json({
      success: true,
      stats: {
        total: stats.total,
        pending: stats.submitted + stats.pendingVerification,
        inProgress: stats.assigned + stats.inProgress,
        resolved: stats.resolved + stats.closed,
        rejected: stats.rejected,
      },
      recentComplaints: recentComplaints.map((c) => ({
        id: c.complaintNumber,
        title: c.title,
        category: c.category,
        priority: c.priority,
        status: c.status,
        updatedAt: c.updatedAt,
      })),
    })
  } catch (error) {
    console.error("[Dashboard] Student error:", error.message)
    res.status(500).json({ success: false, message: "Failed to load student dashboard" })
  }
})

/**
 * @route   GET /api/dashboard/warden
 * @desc    Metrics, category breakdowns, and workload for warden
 * @access  Private (Warden, Admin)
 */
router.get("/dashboard/warden", authenticate, authorizeRoles(ROLES.WARDEN, ROLES.ADMIN), async (req, res) => {
  try {
    const filter = {}
    if (req.user.role === ROLES.WARDEN && req.user.hostelName) {
      filter.hostelName = req.user.hostelName
    }

    const [statsResult, categoryResult, priorityResult] = await Promise.all([
      Complaint.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            awaitingVerification: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ["$status", COMPLAINT_STATUS.SUBMITTED] },
                      { $eq: ["$status", COMPLAINT_STATUS.PENDING_VERIFICATION] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            awaitingAssignment: {
              $sum: { $cond: [{ $eq: ["$status", COMPLAINT_STATUS.VERIFIED] }, 1, 0] },
            },
            inProgress: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ["$status", COMPLAINT_STATUS.ASSIGNED] },
                      { $eq: ["$status", COMPLAINT_STATUS.IN_PROGRESS] },
                      { $eq: ["$status", COMPLAINT_STATUS.NEED_MATERIAL] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            resolved: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ["$status", COMPLAINT_STATUS.RESOLVED] },
                      { $eq: ["$status", COMPLAINT_STATUS.CLOSED] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            rejected: {
              $sum: { $cond: [{ $eq: ["$status", COMPLAINT_STATUS.REJECTED] }, 1, 0] },
            },
          },
        },
      ]),
      Complaint.aggregate([
        { $match: filter },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Complaint.aggregate([
        { $match: filter },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ]),
    ])

    const stats = statsResult[0] || {
      total: 0,
      awaitingVerification: 0,
      awaitingAssignment: 0,
      inProgress: 0,
      resolved: 0,
      rejected: 0,
    }

    res.json({
      success: true,
      stats: {
        total: stats.total,
        awaitingVerification: stats.awaitingVerification,
        awaitingAssignment: stats.awaitingAssignment,
        inProgress: stats.inProgress,
        resolved: stats.resolved,
        rejected: stats.rejected,
      },
      categoryDistribution: categoryResult.map((c) => ({ category: c._id, count: c.count })),
      priorityDistribution: priorityResult.map((p) => ({ priority: p._id, count: p.count })),
    })
  } catch (error) {
    console.error("[Dashboard] Warden error:", error.message)
    res.status(500).json({ success: false, message: "Failed to load warden dashboard" })
  }
})

/**
 * @route   GET /api/dashboard/maintenance
 * @desc    Metrics & task counts for maintenance staff
 * @access  Private (Staff, Admin)
 */
router.get("/dashboard/maintenance", authenticate, authorizeRoles(ROLES.STAFF, ROLES.ADMIN), async (req, res) => {
  try {
    const staffId = req.user._id

    const statsResult = await Complaint.aggregate([
      { $match: { "assignedTo.staffId": staffId } },
      {
        $group: {
          _id: null,
          totalAssigned: { $sum: 1 },
          pending: {
            $sum: { $cond: [{ $eq: ["$status", COMPLAINT_STATUS.ASSIGNED] }, 1, 0] },
          },
          inProgress: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$status", COMPLAINT_STATUS.IN_PROGRESS] },
                    { $eq: ["$status", COMPLAINT_STATUS.NEED_MATERIAL] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          completed: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$status", COMPLAINT_STATUS.RESOLVED] },
                    { $eq: ["$status", COMPLAINT_STATUS.CLOSED] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ])

    const stats = statsResult[0] || {
      totalAssigned: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
    }

    const [recentAssignments, recentActivity] = await Promise.all([
      Complaint.find({ "assignedTo.staffId": staffId })
        .sort({ "assignedTo.assignedAt": -1, createdAt: -1 })
        .limit(10)
        .lean(),
      Complaint.find({
        "assignedTo.staffId": staffId,
        status: { $in: [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED] },
      })
        .sort({ resolvedAt: -1, updatedAt: -1 })
        .limit(10)
        .lean(),
    ])

    res.json({
      success: true,
      stats,
      recentAssignments: recentAssignments.map((c) => ({
        id: c._id,
        complaintNumber: c.complaintNumber,
        title: c.title,
        category: c.category,
        priority: c.priority,
        status: c.status,
        roomNumber: c.roomNumber,
        hostelName: c.hostelName,
        studentName: c.studentName,
        assignedAt: c.assignedTo?.assignedAt,
        createdAt: c.createdAt,
      })),
      recentActivity: recentActivity.map((c) => ({
        id: c._id,
        complaintNumber: c.complaintNumber,
        title: c.title,
        category: c.category,
        status: c.status,
        roomNumber: c.roomNumber,
        resolvedAt: c.resolvedAt,
        workNotes: c.workNotes,
        rating: c.rating,
        resolutionImages: c.resolutionImages,
      })),
    })
  } catch (error) {
    console.error("[Dashboard] Staff error:", error.message)
    res.status(500).json({ success: false, message: "Failed to load maintenance dashboard" })
  }
})

/**
 * @route   GET /api/dashboard/admin
 * @desc    System-wide metrics, resolution times, user statistics
 * @access  Private (Admin)
 */
router.get("/dashboard/admin", authenticate, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  try {
    const [
      totalUsers,
      usersByRole,
      complaintStats,
      totalHostels,
      totalRooms,
      staffWorkload,
      verificationStats,
    ] = await Promise.all([
      User.countDocuments(),
      User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
      Complaint.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: {
              $sum: {
                $cond: [
                  {
                    $nin: [
                      "$status",
                      [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED, COMPLAINT_STATUS.REJECTED],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            resolved: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ["$status", COMPLAINT_STATUS.RESOLVED] },
                      { $eq: ["$status", COMPLAINT_STATUS.CLOSED] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            urgent: {
              $sum: { $cond: [{ $eq: ["$priority", "urgent"] }, 1, 0] },
            },
          },
        },
      ]),
      Hostel.countDocuments(),
      Room.countDocuments(),
      Complaint.aggregate([
        { $match: { "assignedTo.staffId": { $ne: null } } },
        {
          $group: {
            _id: "$assignedTo.staffName",
            totalTasks: { $sum: 1 },
            resolvedTasks: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ["$status", COMPLAINT_STATUS.RESOLVED] },
                      { $eq: ["$status", COMPLAINT_STATUS.CLOSED] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $sort: { totalTasks: -1 } },
      ]),
      ComplaintVerification.aggregate([
        { $group: { _id: "$result", count: { $sum: 1 } } },
      ]),
    ])

    const cStats = complaintStats[0] || { total: 0, active: 0, resolved: 0, urgent: 0 }

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalHostels,
        totalRooms,
        totalComplaints: cStats.total,
        activeComplaints: cStats.active,
        resolvedComplaints: cStats.resolved,
        urgentComplaints: cStats.urgent,
      },
      usersByRole: usersByRole.reduce((acc, curr) => {
        acc[curr._id] = curr.count
        return acc
      }, {}),
      staffWorkload: staffWorkload.map((s) => ({
        staffName: s._id,
        totalTasks: s.totalTasks,
        resolvedTasks: s.resolvedTasks,
      })),
      verificationOutcomes: verificationStats.reduce((acc, curr) => {
        acc[curr._id] = curr.count
        return acc
      }, {}),
    })
  } catch (error) {
    console.error("[Dashboard] Admin error:", error.message)
    res.status(500).json({ success: false, message: "Failed to load admin dashboard" })
  }
})

module.exports = router
