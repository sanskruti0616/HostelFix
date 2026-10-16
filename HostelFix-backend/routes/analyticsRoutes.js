const express = require("express")
const router = express.Router()
const mongoose = require("mongoose")
const Complaint = require("../models/Complaint")
const User = require("../models/User")
const Hostel = require("../models/Hostel")
const { authenticate } = require("../middleware/auth")
const { authorizeRoles } = require("../middleware/rbac")
const {
  ROLES,
  COMPLAINT_STATUS,
  ALL_STATUSES,
  ALL_CATEGORIES,
} = require("../config/constants")
const { getRecurringHotspots } = require("../services/recurrenceService")

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")
}

/**
 * Build tenant-safe complaint query for Warden analytics
 */
function buildWardenScopeFilter(user, queryParams = {}) {
  const filter = {}

  // 1. Strict Tenant Boundary
  if (user.role !== ROLES.PLATFORM_ADMIN && user.organizationId) {
    filter.organizationId = user.organizationId
  }

  // 2. Warden Hostel Scope (Strictly enforce warden's own hostel)
  if (user.role === ROLES.WARDEN) {
    if (user.authorizedHostels && user.authorizedHostels.length > 0) {
      filter.$or = [
        { hostelId: { $in: user.authorizedHostels } },
        { hostelName: { $regex: new RegExp(`^${escapeRegex((user.hostelName || "").trim())}$`, "i") } },
      ]
    } else if (user.hostelId) {
      filter.$or = [
        { hostelId: user.hostelId },
        { hostelName: { $regex: new RegExp(`^${escapeRegex((user.hostelName || "").trim())}$`, "i") } },
      ]
    } else if (user.hostelName) {
      filter.hostelName = { $regex: new RegExp(`^${escapeRegex(user.hostelName.trim())}$`, "i") }
    }
  } else if (user.role === ROLES.ADMIN || user.role === ROLES.PLATFORM_ADMIN) {
    // Admin can optionally filter by a specific hostel
    if (queryParams.hostelId) {
      if (mongoose.Types.ObjectId.isValid(queryParams.hostelId)) {
        filter.hostelId = new mongoose.Types.ObjectId(queryParams.hostelId)
      } else {
        filter.hostelId = queryParams.hostelId
      }
    } else if (queryParams.hostelName) {
      filter.hostelName = { $regex: new RegExp(`^${escapeRegex(queryParams.hostelName.trim())}$`, "i") }
    }
  }

  // 3. Date Range Filter
  const { days, startDate, endDate } = queryParams
  let start = null
  let end = null

  if (startDate) {
    start = new Date(startDate)
  } else if (days && days !== "all") {
    const numDays = parseInt(days, 10) || 30
    start = new Date(Date.now() - numDays * 24 * 60 * 60 * 1000)
  }

  if (endDate) {
    end = new Date(endDate)
  }

  if (start || end) {
    filter.createdAt = {}
    if (start && !isNaN(start.getTime())) filter.createdAt.$gte = start
    if (end && !isNaN(end.getTime())) filter.createdAt.$lte = end
  }

  // 4. Optional entity filters
  if (queryParams.category && queryParams.category !== "all") {
    filter.category = queryParams.category
  }
  if (queryParams.status && queryParams.status !== "all") {
    filter.status = queryParams.status
  }
  if (queryParams.priority && queryParams.priority !== "all") {
    filter.priority = queryParams.priority
  }
  if (queryParams.room) {
    filter.roomNumber = { $regex: new RegExp(escapeRegex(queryParams.room.trim()), "i") }
  }
  if (queryParams.staffId) {
    if (mongoose.Types.ObjectId.isValid(queryParams.staffId)) {
      filter["assignedTo.staffId"] = new mongoose.Types.ObjectId(queryParams.staffId)
    } else {
      filter["assignedTo.staffId"] = queryParams.staffId
    }
  }

  return filter
}

/**
 * @route   GET /api/analytics/warden
 * @desc    Comprehensive maintenance analytics for Warden dashboard
 * @access  Private (Warden, Admin)
 */
router.get("/analytics/warden", authenticate, authorizeRoles(ROLES.WARDEN, ROLES.ADMIN), async (req, res) => {
  try {
    const filter = buildWardenScopeFilter(req.user, req.query)

    // Parallel MongoDB Aggregations
    const [
      summaryAgg,
      categoryAgg,
      trendAgg,
      locationAgg,
      staffAgg,
    ] = await Promise.all([
      // 1. Summary KPIs
      Complaint.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalComplaints: { $sum: 1 },
            newlySubmitted: {
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
            pending: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$status",
                      [
                        COMPLAINT_STATUS.SUBMITTED,
                        COMPLAINT_STATUS.PENDING_VERIFICATION,
                        COMPLAINT_STATUS.VERIFIED,
                        COMPLAINT_STATUS.ASSIGNED,
                      ],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            inProgress: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$status",
                      [COMPLAINT_STATUS.IN_PROGRESS, COMPLAINT_STATUS.NEED_MATERIAL],
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
                    $in: ["$status", [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED]],
                  },
                  1,
                  0,
                ],
              },
            },
            rejected: {
              $sum: {
                $cond: [{ $eq: ["$status", COMPLAINT_STATUS.REJECTED] }, 1, 0],
              },
            },
            // Overdue: open complaints exceeding SLA thresholds
            // Urgent > 24h, High > 48h, Medium/Low > 72h
            overdue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $not: [
                          {
                            $in: [
                              "$status",
                              [
                                COMPLAINT_STATUS.RESOLVED,
                                COMPLAINT_STATUS.CLOSED,
                                COMPLAINT_STATUS.REJECTED,
                                COMPLAINT_STATUS.CANCELLED,
                              ],
                            ],
                          },
                        ],
                      },
                      {
                        $gt: [
                          { $subtract: [new Date(), "$createdAt"] },
                          {
                            $switch: {
                              branches: [
                                { case: { $eq: ["$priority", "urgent"] }, then: 24 * 3600 * 1000 },
                                { case: { $eq: ["$priority", "high"] }, then: 48 * 3600 * 1000 },
                              ],
                              default: 72 * 3600 * 1000,
                            },
                          },
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            // Average resolution time in hours for resolved records
            avgResolutionTimeHours: {
              $avg: {
                $cond: [
                  {
                    $and: [
                      {
                        $in: ["$status", [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED]],
                      },
                      { $ne: ["$resolvedAt", null] },
                      { $ne: ["$createdAt", null] },
                    ],
                  },
                  {
                    $divide: [
                      { $subtract: ["$resolvedAt", "$createdAt"] },
                      1000 * 60 * 60, // Convert ms to hours
                    ],
                  },
                  null,
                ],
              },
            },
            // Resolved count within SLA (e.g. <= 48 hours)
            resolvedWithinSla: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $in: ["$status", [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED]],
                      },
                      { $ne: ["$resolvedAt", null] },
                      {
                        $lte: [
                          { $subtract: ["$resolvedAt", "$createdAt"] },
                          48 * 3600 * 1000,
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),

      // 2. Category Distribution
      Complaint.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 },
            resolvedCount: {
              $sum: {
                $cond: [
                  { $in: ["$status", [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED]] },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // 3. Trends Over Time (Daily created vs resolved)
      Complaint.aggregate([
        { $match: filter },
        {
          $facet: {
            createdTrend: [
              {
                $group: {
                  _id: {
                    $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                  },
                  submitted: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
            resolvedTrend: [
              {
                $match: {
                  resolvedAt: { $ne: null },
                  status: { $in: [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED] },
                },
              },
              {
                $group: {
                  _id: {
                    $dateToString: { format: "%Y-%m-%d", date: "$resolvedAt" },
                  },
                  resolved: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ]),

      // 4. Location / Room Distribution (Top hotspots)
      Complaint.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$roomNumber",
            count: { $sum: 1 },
            resolvedCount: {
              $sum: {
                $cond: [
                  { $in: ["$status", [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED]] },
                  1,
                  0,
                ],
              },
            },
            categories: { $addToSet: "$category" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),

      // 5. Staff Workload Aggregation from Complaints
      Complaint.aggregate([
        {
          $match: {
            ...filter,
            "assignedTo.staffId": { $ne: null },
          },
        },
        {
          $group: {
            _id: "$assignedTo.staffId",
            staffName: { $first: "$assignedTo.staffName" },
            assignedCount: { $sum: 1 },
            inProgressCount: {
              $sum: {
                $cond: [
                  { $in: ["$status", [COMPLAINT_STATUS.IN_PROGRESS, COMPLAINT_STATUS.NEED_MATERIAL]] },
                  1,
                  0,
                ],
              },
            },
            resolvedInPeriodCount: {
              $sum: {
                $cond: [
                  { $in: ["$status", [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED]] },
                  1,
                  0,
                ],
              },
            },
            pendingCount: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$status",
                      [COMPLAINT_STATUS.ASSIGNED, COMPLAINT_STATUS.IN_PROGRESS, COMPLAINT_STATUS.NEED_MATERIAL],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
    ])

    const summary = summaryAgg[0] || {
      totalComplaints: 0,
      newlySubmitted: 0,
      pending: 0,
      inProgress: 0,
      resolved: 0,
      rejected: 0,
      overdue: 0,
      avgResolutionTimeHours: 0,
      resolvedWithinSla: 0,
    }

    const total = summary.totalComplaints || 0
    const resolved = summary.resolved || 0
    const resolutionRate = total > 0 ? Number(((resolved / total) * 100).toFixed(1)) : 0
    const avgResolutionHours =
      summary.avgResolutionTimeHours != null
        ? Number(summary.avgResolutionTimeHours.toFixed(1))
        : 0
    const slaComplianceRate =
      resolved > 0
        ? Number(((summary.resolvedWithinSla / resolved) * 100).toFixed(1))
        : 0

    // Build Category breakdown with percentages
    const categoryDistribution = categoryAgg.map((cat) => ({
      category: cat._id || "Other",
      count: cat.count,
      percentage: total > 0 ? Number(((cat.count / total) * 100).toFixed(1)) : 0,
      resolvedCount: cat.resolvedCount || 0,
    }))

    // Merge trend dates
    const createdMap = new Map()
    const resolvedMap = new Map()
    const allDateSet = new Set()

    if (trendAgg[0]?.createdTrend) {
      trendAgg[0].createdTrend.forEach((item) => {
        createdMap.set(item._id, item.submitted)
        allDateSet.add(item._id)
      })
    }
    if (trendAgg[0]?.resolvedTrend) {
      trendAgg[0].resolvedTrend.forEach((item) => {
        resolvedMap.set(item._id, item.resolved)
        allDateSet.add(item._id)
      })
    }

    const sortedDates = Array.from(allDateSet).sort()
    const trends = sortedDates.map((dateStr) => ({
      date: dateStr,
      submitted: createdMap.get(dateStr) || 0,
      resolved: resolvedMap.get(dateStr) || 0,
    }))

    // Location Hotspots
    const locationHotspots = locationAgg.map((loc) => ({
      roomNumber: loc._id || "Common",
      count: loc.count,
      resolvedCount: loc.resolvedCount,
      pendingCount: loc.count - loc.resolvedCount,
      categories: loc.categories || [],
    }))

    // Fetch active staff list for warden's hostel to ensure 0-complaint staff are also displayed
    let hostelStaffQuery = { role: ROLES.STAFF, accountStatus: "active" }
    if (req.user.role === ROLES.WARDEN) {
      if (req.user.hostelId) {
        hostelStaffQuery.$or = [
          { hostelId: req.user.hostelId },
          { hostelName: req.user.hostelName },
          { authorizedHostels: req.user.hostelId },
        ]
      } else if (req.user.hostelName) {
        hostelStaffQuery.hostelName = req.user.hostelName
      }
    }
    if (req.user.organizationId) {
      hostelStaffQuery.organizationId = req.user.organizationId
    }

    const hostelStaffMembers = await User.find(hostelStaffQuery)
      .select("name email specialization hostelName")
      .lean()

    const staffWorkloadMap = new Map()
    staffAgg.forEach((s) => {
      staffWorkloadMap.set(s._id ? s._id.toString() : "", s)
    })

    const staffWorkload = hostelStaffMembers.map((staffUser) => {
      const stats = staffWorkloadMap.get(staffUser._id.toString()) || {}
      return {
        staffId: staffUser._id.toString(),
        staffName: staffUser.name,
        email: staffUser.email,
        specialization: staffUser.specialization || "General Maintenance",
        assignedCount: stats.assignedCount || 0,
        inProgressCount: stats.inProgressCount || 0,
        resolvedInPeriodCount: stats.resolvedInPeriodCount || 0,
        pendingCount: stats.pendingCount || 0,
      }
    })

    res.json({
      success: true,
      summary: {
        totalComplaints: total,
        newlySubmitted: summary.newlySubmitted,
        pending: summary.pending,
        inProgress: summary.inProgress,
        resolved,
        rejected: summary.rejected,
        overdue: summary.overdue,
        avgResolutionHours,
        resolutionRate,
        slaComplianceRate,
        resolvedWithinSla: summary.resolvedWithinSla,
      },
      categoryDistribution,
      trends,
      locationHotspots,
      staffWorkload,
      filterApplied: {
        hostel: req.user.hostelName || "Scoped Hostel",
        days: req.query.days || 30,
        category: req.query.category || "all",
        status: req.query.status || "all",
      },
    })
  } catch (error) {
    console.error("[Analytics] Warden error:", error.message)
    res.status(500).json({ success: false, message: "Failed to load warden analytics: " + error.message })
  }
})

/**
 * @route   GET /api/analytics/admin
 * @desc    Platform-wide aggregate analytics for Platform Admin
 * @access  Private (Admin)
 */
router.get("/analytics/admin", authenticate, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  try {
    const orgFilter = {}
    if (req.user.role !== ROLES.PLATFORM_ADMIN && req.user.organizationId) {
      orgFilter.organizationId = req.user.organizationId
    }

    const [
      hostelStats,
      complaintSummary,
      categoryAgg,
      hostelPerformanceAgg,
      dailyTrendAgg,
      userStatsAgg,
      statusDistributionAgg,
      ratingsAgg,
      recurringHotspots,
    ] = await Promise.all([
      // 1. Hostel Counts
      Hostel.aggregate([
        { $match: orgFilter },
        {
          $group: {
            _id: null,
            totalHostels: { $sum: 1 },
            activeHostels: {
              $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
            },
            pendingHostels: {
              $sum: { $cond: [{ $eq: ["$status", "pending_setup"] }, 1, 0] },
            },
          },
        },
      ]),

      // 2. Total Complaints Summary (using $not: [{$in: ...}] instead of $nin)
      Complaint.aggregate([
        { $match: orgFilter },
        {
          $group: {
            _id: null,
            totalComplaints: { $sum: 1 },
            openComplaints: {
              $sum: {
                $cond: [
                  {
                    $not: [
                      {
                        $in: [
                          "$status",
                          [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED, COMPLAINT_STATUS.REJECTED],
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            resolvedComplaints: {
              $sum: {
                $cond: [
                  {
                    $in: ["$status", [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED]],
                  },
                  1,
                  0,
                ],
              },
            },
            pendingVerification: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$status",
                      [COMPLAINT_STATUS.SUBMITTED, COMPLAINT_STATUS.PENDING_VERIFICATION],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            inProgress: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$status",
                      [COMPLAINT_STATUS.IN_PROGRESS, COMPLAINT_STATUS.NEED_MATERIAL, COMPLAINT_STATUS.ASSIGNED],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            avgResolutionHours: {
              $avg: {
                $cond: [
                  {
                    $and: [
                      { $in: ["$status", [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED]] },
                      { $ne: ["$resolvedAt", null] },
                    ],
                  },
                  {
                    $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, 1000 * 60 * 60],
                  },
                  null,
                ],
              },
            },
          },
        },
      ]),

      // 3. Category Distribution across platform
      Complaint.aggregate([
        { $match: orgFilter },
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // 4. Performance by Hostel (using $not: [{$in: ...}] instead of $nin)
      Complaint.aggregate([
        { $match: orgFilter },
        {
          $group: {
            _id: { hostelId: "$hostelId", hostelName: "$hostelName" },
            totalComplaints: { $sum: 1 },
            openComplaints: {
              $sum: {
                $cond: [
                  {
                    $not: [
                      {
                        $in: [
                          "$status",
                          [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED, COMPLAINT_STATUS.REJECTED],
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            resolvedComplaints: {
              $sum: {
                $cond: [
                  {
                    $in: ["$status", [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED]],
                  },
                  1,
                  0,
                ],
              },
            },
            avgResolutionHours: {
              $avg: {
                $cond: [
                  {
                    $and: [
                      { $in: ["$status", [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED]] },
                      { $ne: ["$resolvedAt", null] },
                    ],
                  },
                  {
                    $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, 1000 * 60 * 60],
                  },
                  null,
                ],
              },
            },
          },
        },
        { $sort: { totalComplaints: -1 } },
        { $limit: 20 },
      ]),

      // 5. Daily Trend across platform for past 30 days
      Complaint.aggregate([
        {
          $match: {
            ...orgFilter,
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            submitted: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // 6. User Counts by Role
      User.aggregate([
        { $match: orgFilter },
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 },
          },
        },
      ]),

      // 7. Status Distribution
      Complaint.aggregate([
        { $match: orgFilter },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // 8. Student Ratings & Satisfaction
      Complaint.aggregate([
        {
          $match: {
            ...orgFilter,
            rating: { $ne: null, $gte: 1, $lte: 5 },
          },
        },
        {
          $group: {
            _id: null,
            totalRated: { $sum: 1 },
            avgRating: { $avg: "$rating" },
            fiveStar: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
            fourStar: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
            threeStar: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
            twoStar: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
            oneStar: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
          },
        },
      ]),

      // 9. Platform Recurring Hotspots (past 30 days)
      getRecurringHotspots(orgFilter, 30),
    ])

    const hStats = hostelStats[0] || { totalHostels: 0, activeHostels: 0, pendingHostels: 0 }
    const cStats = complaintSummary[0] || {
      totalComplaints: 0,
      openComplaints: 0,
      resolvedComplaints: 0,
      pendingVerification: 0,
      inProgress: 0,
      avgResolutionHours: 0,
    }

    const platformTotal = cStats.totalComplaints || 0
    const platformResolved = cStats.resolvedComplaints || 0
    const platformResolutionRate =
      platformTotal > 0 ? Number(((platformResolved / platformTotal) * 100).toFixed(1)) : 0

    // Build user stats map
    const userRoleMap = new Map()
    let totalUsers = 0
    userStatsAgg.forEach((u) => {
      userRoleMap.set(u._id, u.count)
      totalUsers += u.count
    })

    const categoryDistribution = categoryAgg.map((cat) => ({
      category: cat._id || "Other",
      count: cat.count,
      percentage:
        platformTotal > 0 ? Number(((cat.count / platformTotal) * 100).toFixed(1)) : 0,
    }))

    const hostelPerformance = hostelPerformanceAgg.map((hp) => {
      const hTotal = hp.totalComplaints || 0
      const hResolved = hp.resolvedComplaints || 0
      return {
        hostelId: hp._id?.hostelId ? hp._id.hostelId.toString() : "",
        hostelName: hp._id?.hostelName || "Unknown Hostel",
        totalComplaints: hTotal,
        openComplaints: hp.openComplaints || 0,
        resolvedComplaints: hResolved,
        resolutionRate: hTotal > 0 ? Number(((hResolved / hTotal) * 100).toFixed(1)) : 0,
        avgResolutionHours:
          hp.avgResolutionHours != null ? Number(hp.avgResolutionHours.toFixed(1)) : 0,
      }
    })

    const rStats = ratingsAgg[0] || {
      totalRated: 0,
      avgRating: 0,
      fiveStar: 0,
      fourStar: 0,
      threeStar: 0,
      twoStar: 0,
      oneStar: 0,
    }

    res.json({
      success: true,
      hostelOverview: {
        totalHostels: hStats.totalHostels,
        activeHostels: hStats.activeHostels,
        pendingHostels: hStats.pendingHostels,
      },
      userOverview: {
        totalUsers,
        students: userRoleMap.get(ROLES.STUDENT) || 0,
        wardens: userRoleMap.get(ROLES.WARDEN) || 0,
        staff: userRoleMap.get(ROLES.STAFF) || 0,
        admins: (userRoleMap.get(ROLES.ADMIN) || 0) + (userRoleMap.get(ROLES.PLATFORM_ADMIN) || 0),
      },
      complaintOverview: {
        totalComplaints: platformTotal,
        openComplaints: cStats.openComplaints,
        resolvedComplaints: platformResolved,
        pendingVerification: cStats.pendingVerification || 0,
        inProgress: cStats.inProgress || 0,
        resolutionRate: platformResolutionRate,
        avgResolutionHours:
          cStats.avgResolutionHours != null
            ? Number(cStats.avgResolutionHours.toFixed(1))
            : 0,
      },
      statusDistribution: statusDistributionAgg.map((s) => ({
        status: s._id,
        count: s.count,
        percentage: platformTotal > 0 ? Number(((s.count / platformTotal) * 100).toFixed(1)) : 0,
      })),
      categoryDistribution,
      hostelPerformance,
      ratingsOverview: {
        totalRated: rStats.totalRated,
        avgRating: rStats.avgRating ? Number(rStats.avgRating.toFixed(2)) : 0,
        breakdown: {
          5: rStats.fiveStar,
          4: rStats.fourStar,
          3: rStats.threeStar,
          2: rStats.twoStar,
          1: rStats.oneStar,
        },
      },
      platformTrend: dailyTrendAgg.map((t) => ({
        date: t._id,
        submitted: t.submitted,
      })),
      recurringHotspots: recurringHotspots || [],
    })
  } catch (error) {
    console.error("[Analytics] Admin error:", error.message)
    res.status(500).json({ success: false, message: "Failed to load admin analytics: " + error.message })
  }
})

module.exports = router
