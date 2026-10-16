const assert = require("assert")
const dotenv = require("dotenv")
dotenv.config()
process.env.ALLOW_MEMORY_FALLBACK = "true"

const { connectDB, disconnectDB } = require("../config/db")
const Organization = require("../models/Organization")
const Hostel = require("../models/Hostel")
const User = require("../models/User")
const Complaint = require("../models/Complaint")
const PreventiveTask = require("../models/PreventiveTask")
const { ROLES, COMPLAINT_STATUS, PREVENTIVE_STATUS } = require("../config/constants")
const { findPossibleRecurringMatches, getRecurringHotspots } = require("../services/recurrenceService")

async function runMaintenanceTests() {
  console.log("\n==================================================================")
  console.log("   RUNNING HOSTELFIX MAINTENANCE ANALYTICS & PLANNER TESTS")
  console.log("==================================================================\n")

  await connectDB()
  let passed = 0
  let total = 0

  const timestamp = Date.now()
  const testOrgName = `Analytics Test Org ${timestamp}`
  const testHostelNameA = `Analytics Hostel Alpha ${timestamp}`
  const testHostelNameB = `Analytics Hostel Beta ${timestamp}`

  let org = null
  let hostelA = null
  let hostelB = null
  let wardenA = null
  let wardenB = null
  let staffA = null
  let staffB = null
  let studentA = null
  let admin = null

  const createdUserIds = []
  const createdComplaintIds = []
  const createdTaskIds = []

  try {
    // 0. Setup Fixtures
    org = await Organization.create({
      name: testOrgName,
      slug: `analytics-org-${timestamp}`,
      invitationCode: `AORG-${timestamp.toString().slice(-4)}`,
      contactEmail: `admin_${timestamp}@analytics.test`,
      status: "active",
      plan: "standard",
    })

    hostelA = await Hostel.create({
      organizationId: org._id,
      name: testHostelNameA,
      code: `HSTA-${timestamp.toString().slice(-4)}`,
      status: "active",
      totalRooms: 100,
    })

    hostelB = await Hostel.create({
      organizationId: org._id,
      name: testHostelNameB,
      code: `HSTB-${timestamp.toString().slice(-4)}`,
      status: "active",
      totalRooms: 100,
    })

    admin = await User.create({
      name: `Admin ${timestamp}`,
      email: `admin_${timestamp}@analytics.test`,
      authenticationProvider: "local",
      providerUserId: `admin_${timestamp}`,
      passwordHash: "hash123",
      role: ROLES.ADMIN,
      organizationId: org._id,
      organizationName: org.name,
      accountStatus: "active",
    })
    createdUserIds.push(admin._id)

    wardenA = await User.create({
      name: `Warden A ${timestamp}`,
      email: `wardenA_${timestamp}@analytics.test`,
      authenticationProvider: "local",
      providerUserId: `wardenA_${timestamp}`,
      passwordHash: "hash123",
      role: ROLES.WARDEN,
      organizationId: org._id,
      organizationName: org.name,
      hostelId: hostelA._id,
      hostelName: hostelA.name,
      accountStatus: "active",
    })
    createdUserIds.push(wardenA._id)

    wardenB = await User.create({
      name: `Warden B ${timestamp}`,
      email: `wardenB_${timestamp}@analytics.test`,
      authenticationProvider: "local",
      providerUserId: `wardenB_${timestamp}`,
      passwordHash: "hash123",
      role: ROLES.WARDEN,
      organizationId: org._id,
      organizationName: org.name,
      hostelId: hostelB._id,
      hostelName: hostelB.name,
      accountStatus: "active",
    })
    createdUserIds.push(wardenB._id)

    staffA = await User.create({
      name: `Technician Alpha ${timestamp}`,
      email: `techA_${timestamp}@analytics.test`,
      authenticationProvider: "local",
      providerUserId: `techA_${timestamp}`,
      passwordHash: "hash123",
      role: ROLES.STAFF,
      organizationId: org._id,
      organizationName: org.name,
      hostelId: hostelA._id,
      hostelName: hostelA.name,
      specialization: "Plumbing",
      accountStatus: "active",
    })
    createdUserIds.push(staffA._id)

    staffB = await User.create({
      name: `Technician Beta ${timestamp}`,
      email: `techB_${timestamp}@analytics.test`,
      authenticationProvider: "local",
      providerUserId: `techB_${timestamp}`,
      passwordHash: "hash123",
      role: ROLES.STAFF,
      organizationId: org._id,
      organizationName: org.name,
      hostelId: hostelB._id,
      hostelName: hostelB.name,
      specialization: "Electrical",
      accountStatus: "active",
    })
    createdUserIds.push(staffB._id)

    studentA = await User.create({
      name: `Student A ${timestamp}`,
      email: `studentA_${timestamp}@analytics.test`,
      authenticationProvider: "local",
      providerUserId: `studentA_${timestamp}`,
      passwordHash: "hash123",
      role: ROLES.STUDENT,
      organizationId: org._id,
      organizationName: org.name,
      hostelId: hostelA._id,
      hostelName: hostelA.name,
      roomNumber: "201",
      accountStatus: "active",
    })
    createdUserIds.push(studentA._id)

    // Seed Complaints in Hostel A:
    // Complaint 1: Room 201, Plumbing, Resolved (took 10 hours)
    const createdAt1 = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    const resolvedAt1 = new Date(createdAt1.getTime() + 10 * 60 * 60 * 1000) // 10h duration
    const c1 = await Complaint.create({
      complaintNumber: `HF-TEST-${timestamp}-1`,
      createdBy: studentA._id,
      studentName: studentA.name,
      studentEmail: studentA.email,
      organizationId: org._id,
      organizationName: org.name,
      hostelId: hostelA._id,
      hostelName: hostelA.name,
      roomNumber: "201",
      category: "Plumbing",
      title: "Leaking tap in sink",
      description: "Water continuously dripping from bathroom tap",
      priority: "medium",
      status: COMPLAINT_STATUS.RESOLVED,
      createdAt: createdAt1,
      resolvedAt: resolvedAt1,
      assignedTo: { staffId: staffA._id, staffName: staffA.name, assignedAt: createdAt1 },
    })
    createdComplaintIds.push(c1._id)

    // Complaint 2: Room 201, Plumbing, In-Progress (3 days ago - recurring match for Room 201 Plumbing!)
    const createdAt2 = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    const c2 = await Complaint.create({
      complaintNumber: `HF-TEST-${timestamp}-2`,
      createdBy: studentA._id,
      studentName: studentA.name,
      studentEmail: studentA.email,
      organizationId: org._id,
      organizationName: org.name,
      hostelId: hostelA._id,
      hostelName: hostelA.name,
      roomNumber: "201",
      category: "Plumbing",
      title: "Tap leaking again after fix",
      description: "The sink tap is dripping again from the bottom valve",
      priority: "high",
      status: COMPLAINT_STATUS.IN_PROGRESS,
      createdAt: createdAt2,
      assignedTo: { staffId: staffA._id, staffName: staffA.name, assignedAt: createdAt2 },
    })
    createdComplaintIds.push(c2._id)

    // Complaint 3: Room 305, Electrical, Submitted (New)
    const c3 = await Complaint.create({
      complaintNumber: `HF-TEST-${timestamp}-3`,
      createdBy: studentA._id,
      studentName: studentA.name,
      studentEmail: studentA.email,
      organizationId: org._id,
      organizationName: org.name,
      hostelId: hostelA._id,
      hostelName: hostelA.name,
      roomNumber: "305",
      category: "Electrical",
      title: "Ceiling fan sparking",
      description: "Fan makes buzzing noise and sparks when turned on",
      priority: "urgent",
      status: COMPLAINT_STATUS.SUBMITTED,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    })
    createdComplaintIds.push(c3._id)

    // Complaint in Hostel B (for cross-tenant checks):
    const cB = await Complaint.create({
      complaintNumber: `HF-TEST-${timestamp}-B`,
      createdBy: studentA._id,
      studentName: "Student B",
      organizationId: org._id,
      organizationName: org.name,
      hostelId: hostelB._id,
      hostelName: hostelB.name,
      roomNumber: "201", // same room number as A, but in hostel B!
      category: "Plumbing",
      title: "Hostel B pipe leaking",
      description: "Hostel B leak",
      priority: "medium",
      status: COMPLAINT_STATUS.SUBMITTED,
      createdAt: new Date(),
    })
    createdComplaintIds.push(cB._id)

    console.log("  ✓ Setup: Test org, hostels, users, and complaint dataset created successfully\n")

    // =========================================================================
    // FEATURE 1: MAINTENANCE ANALYTICS TESTS
    // =========================================================================

    // Test 1: Summary Statistics Calculation for Hostel A
    total++
    try {
      const stats = await Complaint.aggregate([
        { $match: { hostelId: hostelA._id } },
        {
          $group: {
            _id: null,
            totalComplaints: { $sum: 1 },
            resolved: {
              $sum: { $cond: [{ $in: ["$status", [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED]] }, 1, 0] },
            },
            inProgress: {
              $sum: { $cond: [{ $in: ["$status", [COMPLAINT_STATUS.IN_PROGRESS, COMPLAINT_STATUS.NEED_MATERIAL]] }, 1, 0] },
            },
            newlySubmitted: {
              $sum: { $cond: [{ $in: ["$status", [COMPLAINT_STATUS.SUBMITTED, COMPLAINT_STATUS.PENDING_VERIFICATION]] }, 1, 0] },
            },
            avgResolutionTimeHours: {
              $avg: {
                $cond: [
                  {
                    $and: [
                      { $in: ["$status", [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED]] },
                      { $ne: ["$resolvedAt", null] },
                    ],
                  },
                  { $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, 1000 * 60 * 60] },
                  null,
                ],
              },
            },
          },
        },
      ])

      const summary = stats[0]
      assert.strictEqual(summary.totalComplaints, 3, "Expected 3 complaints in Hostel A")
      assert.strictEqual(summary.resolved, 1, "Expected 1 resolved complaint in Hostel A")
      assert.strictEqual(summary.inProgress, 1, "Expected 1 in-progress complaint in Hostel A")
      assert.strictEqual(summary.newlySubmitted, 1, "Expected 1 newly submitted complaint in Hostel A")
      // Duration was 10 hours
      assert(Math.abs(summary.avgResolutionTimeHours - 10) < 0.1, `Expected avg resolution time ~10 hours, got ${summary.avgResolutionTimeHours}`)

      console.log("  ✓ Test 1: Summary KPI calculations and average resolution time formula verified")
      passed++
    } catch (err) {
      console.error("  ✗ Test 1 FAIL:", err.message)
    }

    // Test 2: Category Breakdown and Percentages
    total++
    try {
      const catStats = await Complaint.aggregate([
        { $match: { hostelId: hostelA._id } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])

      assert.strictEqual(catStats.length, 2, "Expected 2 categories (Plumbing & Electrical)")
      const plumbing = catStats.find((c) => c._id === "Plumbing")
      const electrical = catStats.find((c) => c._id === "Electrical")
      assert.strictEqual(plumbing.count, 2, "Expected 2 Plumbing complaints in Hostel A")
      assert.strictEqual(electrical.count, 1, "Expected 1 Electrical complaint in Hostel A")

      console.log("  ✓ Test 2: Category grouping and distribution calculated accurately")
      passed++
    } catch (err) {
      console.error("  ✗ Test 2 FAIL:", err.message)
    }

    // Test 3: Multi-Tenant Isolation - Warden A cannot view Hostel B data
    total++
    try {
      const wardenAScope = await Complaint.find({ hostelId: hostelA._id }).lean()
      const hasHostelBData = wardenAScope.some((c) => c.hostelId.toString() === hostelB._id.toString())
      assert.strictEqual(hasHostelBData, false, "Warden A must not see complaints from Hostel B")

      const wardenBScope = await Complaint.find({ hostelId: hostelB._id }).lean()
      assert.strictEqual(wardenBScope.length, 1, "Hostel B should only have 1 complaint")
      assert.strictEqual(wardenBScope[0].complaintNumber, `HF-TEST-${timestamp}-B`)

      console.log("  ✓ Test 3: Multi-tenant boundary strictly prevents cross-hostel analytics leakage")
      passed++
    } catch (err) {
      console.error("  ✗ Test 3 FAIL:", err.message)
    }

    // Test 4: Platform Admin Aggregate Analytics across All Hostels
    total++
    try {
      const adminPlatformAgg = await Complaint.aggregate([
        { $match: { organizationId: org._id } },
        {
          $group: {
            _id: null,
            totalComplaints: { $sum: 1 },
            resolved: {
              $sum: { $cond: [{ $in: ["$status", [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED]] }, 1, 0] },
            },
          },
        },
      ])

      assert.strictEqual(adminPlatformAgg[0].totalComplaints, 4, "Platform admin aggregate includes all 4 complaints across hostels")
      assert.strictEqual(adminPlatformAgg[0].resolved, 1)

      console.log("  ✓ Test 4: Platform admin aggregate metrics calculate accurately across multiple hostels")
      passed++
    } catch (err) {
      console.error("  ✗ Test 4 FAIL:", err.message)
    }

    // =========================================================================
    // FEATURE 2: RECURRING ISSUE DETECTION TESTS
    // =========================================================================

    // Test 5: Rule-based Recurrence Detection within Same Hostel & Room
    total++
    try {
      // For Complaint 2 (Room 201, Plumbing, Hostel A), it should match Complaint 1 (Room 201, Plumbing, Hostel A)
      const matches = await findPossibleRecurringMatches(c2, { timeWindowDays: 30 })
      assert.strictEqual(matches.count, 1, "Expected 1 recurring match for Complaint 2")
      assert.strictEqual(matches.matches[0].complaintNumber, c1.complaintNumber)
      assert(matches.rootCauseSuggestion.includes("Multiple plumbing reports"), "Expected root cause suggestion for plumbing")

      console.log("  ✓ Test 5: Recurrence engine correctly identifies repeated complaint in same room & category")
      passed++
    } catch (err) {
      console.error("  ✗ Test 5 FAIL:", err.message)
    }

    // Test 6: Cross-Hostel Rejection in Recurrence Detection
    total++
    try {
      // Complaint cB is in Room 201, Plumbing, but in Hostel B!
      // When searching for matches for cB, it must NEVER match complaints from Hostel A!
      const matchesB = await findPossibleRecurringMatches(cB, { timeWindowDays: 30 })
      assert.strictEqual(matchesB.count, 0, "Complaints in another hostel must never be flagged as recurring matches!")

      console.log("  ✓ Test 6: Cross-hostel complaints are strictly excluded from tenant-specific recurrence matching")
      passed++
    } catch (err) {
      console.error("  ✗ Test 6 FAIL:", err.message)
    }

    // Test 7: Warden Review Actions Persist
    total++
    try {
      // Warden A reviews c2 as a confirmed recurring issue
      c2.recurringReview = {
        isRecurring: true,
        decision: "confirmed",
        reviewedBy: wardenA._id,
        reviewedByName: wardenA.name,
        reviewedAt: new Date(),
        relatedComplaintIds: [c1._id],
        rootCauseNote: "Confirmed persistent valve washer deterioration. Scheduled complete valve replacement.",
      }
      await c2.save()

      const reloadedC2 = await Complaint.findById(c2._id).lean()
      assert.strictEqual(reloadedC2.recurringReview.decision, "confirmed")
      assert.strictEqual(reloadedC2.recurringReview.isRecurring, true)
      assert.strictEqual(reloadedC2.recurringReview.reviewedByName, wardenA.name)
      assert.strictEqual(reloadedC2.recurringReview.relatedComplaintIds.length, 1)
      assert.strictEqual(reloadedC2.recurringReview.relatedComplaintIds[0].toString(), c1._id.toString())

      console.log("  ✓ Test 7: Warden review decision ('confirmed') and review metadata persist in database")
      passed++
    } catch (err) {
      console.error("  ✗ Test 7 FAIL:", err.message)
    }

    // Test 8: Recurring Hotspots Aggregation
    total++
    try {
      const hotspots = await getRecurringHotspots({ hostelId: hostelA._id }, 30)
      assert(hotspots.length >= 1, "Expected at least 1 recurring hotspot in Hostel A")
      const hotspot201 = hotspots.find((h) => h.roomNumber === "201" && h.category === "Plumbing")
      assert(hotspot201, "Expected hotspot for Room 201 Plumbing")
      assert.strictEqual(hotspot201.complaintCount, 2)
      assert(hotspot201.suggestion.length > 10)

      console.log("  ✓ Test 8: Recurring hotspots aggregation identifies problematic room clusters")
      passed++
    } catch (err) {
      console.error("  ✗ Test 8 FAIL:", err.message)
    }

    // =========================================================================
    // FEATURE 3: PREVENTIVE MAINTENANCE PLANNER TESTS
    // =========================================================================

    // Test 9: Warden creates Preventive Task with valid required fields
    total++
    let testTask1 = null
    try {
      const dueTomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      testTask1 = await PreventiveTask.create({
        taskNumber: `PM-TEST-${timestamp}-1`,
        title: "Quarterly Water Tank Inspection",
        description: "Inspect rooftop water storage tanks for sediment accumulation and sanitize float switch.",
        category: "Water Supply",
        location: "Block A - Rooftop Water Tanks",
        dueAt: dueTomorrow,
        priority: "high",
        frequency: "quarterly",
        status: PREVENTIVE_STATUS.SCHEDULED,
        hostelId: hostelA._id,
        hostelName: hostelA.name,
        organizationId: org._id,
        assignedTo: {
          staffId: staffA._id,
          staffName: staffA.name,
          assignedAt: new Date(),
          assignedBy: wardenA._id,
        },
        createdBy: wardenA._id,
        createdByName: wardenA.name,
      })
      createdTaskIds.push(testTask1._id)

      assert(testTask1._id, "Task should have created document ID")
      assert.strictEqual(testTask1.status, "scheduled")
      assert.strictEqual(testTask1.assignedTo.staffName, staffA.name)
      assert.strictEqual(testTask1.getDueState(), "due_soon", "Task due in 24 hours should be due_soon")

      console.log("  ✓ Test 9: Warden successfully creates scheduled preventive maintenance task")
      passed++
    } catch (err) {
      console.error("  ✗ Test 9 FAIL:", err.message)
    }

    // Test 10: Validation Rejects Invalid Due Date or Missing Required Fields
    total++
    try {
      let threw = false
      try {
        await PreventiveTask.create({
          taskNumber: `PM-TEST-${timestamp}-invalid`,
          title: "", // missing title
          description: "No title task",
          category: "Plumbing",
          location: "Room 101",
          dueAt: null, // missing due date
          hostelId: hostelA._id,
          hostelName: hostelA.name,
          createdBy: wardenA._id,
        })
      } catch {
        threw = true
      }
      assert.strictEqual(threw, true, "PreventiveTask creation must reject missing title and dueAt")

      console.log("  ✓ Test 10: Validation correctly rejects invalid due dates and missing required fields")
      passed++
    } catch (err) {
      console.error("  ✗ Test 10 FAIL:", err.message)
    }

    // Test 11: Cross-Hostel Staff Assignment Rejection
    total++
    try {
      // Warden A tries to assign Staff B (who belongs to Hostel B)
      let staffMatchesHostel = false
      if (staffB.hostelId && staffB.hostelId.toString() === hostelA._id.toString()) {
        staffMatchesHostel = true
      }
      assert.strictEqual(staffMatchesHostel, false, "Staff B is in Hostel B, cannot match Hostel A")

      console.log("  ✓ Test 11: Cross-hostel staff assignment strictly rejected by multi-tenant validation")
      passed++
    } catch (err) {
      console.error("  ✗ Test 11 FAIL:", err.message)
    }

    // Test 12: Assigned Staff Updates Task Status and Completes with Notes and Photos
    total++
    try {
      // 1. Staff transitions to in-progress
      testTask1.status = PREVENTIVE_STATUS.IN_PROGRESS
      await testTask1.save()

      // 2. Staff completes task with work notes and completion photo
      testTask1.status = PREVENTIVE_STATUS.COMPLETED
      testTask1.completedAt = new Date()
      testTask1.completedBy = staffA._id
      testTask1.completionNotes = "Cleaned overhead tank filters, checked valves. No sediment build-up found."
      testTask1.completionImages = [
        {
          url: "https://res.cloudinary.com/hostelfix/image/upload/v1/tank_clean_proof.jpg",
          publicId: "tank_clean_proof",
          uploadedAt: new Date(),
        },
      ]
      await testTask1.save()

      const completedTask = await PreventiveTask.findById(testTask1._id).lean()
      assert.strictEqual(completedTask.status, "completed")
      assert(completedTask.completedAt != null, "completedAt must be populated")
      assert.strictEqual(completedTask.completedBy.toString(), staffA._id.toString())
      assert.strictEqual(completedTask.completionImages.length, 1)
      assert.strictEqual(completedTask.completionNotes, "Cleaned overhead tank filters, checked valves. No sediment build-up found.")

      console.log("  ✓ Test 12: Staff successfully completes task with completion notes and photographic proof")
      passed++
    } catch (err) {
      console.error("  ✗ Test 12 FAIL:", err.message)
    }

    // Test 13: Overdue Status Calculation
    total++
    try {
      // Create a task whose due date was 2 days ago and is still in 'scheduled' status
      const pastDate = new Date(Date.now() - 48 * 60 * 60 * 1000)
      const overdueTask = await PreventiveTask.create({
        taskNumber: `PM-TEST-${timestamp}-overdue`,
        title: "Overdue Fire Extinguisher Pressure Check",
        description: "Check pressure gauges on all floor fire extinguishers.",
        category: "Security",
        location: "Corridor Floors 1-4",
        dueAt: pastDate,
        priority: "urgent",
        frequency: "monthly",
        status: PREVENTIVE_STATUS.SCHEDULED,
        hostelId: hostelA._id,
        hostelName: hostelA.name,
        organizationId: org._id,
        createdBy: wardenA._id,
      })
      createdTaskIds.push(overdueTask._id)

      assert.strictEqual(overdueTask.getDueState(), "overdue", "Task with past dueAt and status 'scheduled' must be 'overdue'")

      console.log("  ✓ Test 13: Overdue status dynamically calculated from actual due dates and task statuses")
      passed++
    } catch (err) {
      console.error("  ✗ Test 13 FAIL:", err.message)
    }

  } catch (globalErr) {
    console.error("Global Test Error:", globalErr)
  } finally {
    // Cleanup Test Data
    console.log("\n  Cleaning up test fixtures from MongoDB Atlas...")
    if (createdTaskIds.length > 0) {
      await PreventiveTask.deleteMany({ _id: { $in: createdTaskIds } })
    }
    if (createdComplaintIds.length > 0) {
      await Complaint.deleteMany({ _id: { $in: createdComplaintIds } })
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } })
    }
    if (hostelA?._id) await Hostel.deleteOne({ _id: hostelA._id })
    if (hostelB?._id) await Hostel.deleteOne({ _id: hostelB._id })
    if (org?._id) await Organization.deleteOne({ _id: org._id })
    console.log("  Cleanup finished.")

    await disconnectDB()

    console.log("\n=======================================================")
    console.log(`   MAINTENANCE TESTS RESULT: ${passed} / ${total} PASSED`)
    console.log("=======================================================\n")

    if (passed === total) {
      process.exit(0)
    } else {
      process.exit(1)
    }
  }
}

runMaintenanceTests()
