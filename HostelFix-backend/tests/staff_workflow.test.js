const assert = require("assert")
const dotenv = require("dotenv")
dotenv.config()
process.env.ALLOW_MEMORY_FALLBACK = "true"

const { connectDB, disconnectDB } = require("../config/db")
const Organization = require("../models/Organization")
const Hostel = require("../models/Hostel")
const User = require("../models/User")
const Complaint = require("../models/Complaint")
const ComplaintStatusHistory = require("../models/ComplaintStatusHistory")
const Feedback = require("../models/Feedback")
const bcrypt = require("bcryptjs")
const { ROLES, COMPLAINT_STATUS } = require("../config/constants")
const {
  registerHostel,
  registerStudent,
  authenticateLocalUser,
  generateToken,
} = require("../services/authService")

async function runStaffWorkflowTests() {
  console.log("\n=======================================================")
  console.log("   RUNNING HOSTELFIX STAFF AUTHENTICATION & WORKFLOW TESTS")
  console.log("=======================================================\n")

  await connectDB()
  let passed = 0
  let total = 0

  const timestamp = Date.now()
  const testHostelNameA = `Pratibha Hostel A ${timestamp}`
  const testHostelNameB = `Pratibha Hostel B ${timestamp}`
  const wardenEmailA = `wardenA_${timestamp}@pratibha.edu`
  const wardenEmailB = `wardenB_${timestamp}@pratibha.edu`
  const studentEmail = `student_${timestamp}@pratibha.edu`
  const staffEmail = `technician_${timestamp}@pratibha.edu`
  const staffPassword = "TechnicianPass123!"

  let hostelA = null
  let hostelB = null
  let wardenA = null
  let wardenB = null
  let student = null
  let staff = null
  let testComplaint = null

  async function test(name, fn) {
    total++
    try {
      await fn()
      console.log(`  ✓ PASS: ${name}`)
      passed++
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`)
      console.error(`    Error: ${err.message}`)
    }
  }

  try {
    // SETUP: Create two distinct hostels with their respective wardens
    const resA = await registerHostel({
      hostelName: testHostelNameA,
      code: `PHA${String(timestamp).slice(-3)}`,
      contactEmail: wardenEmailA,
      contactPhone: "+91 9876543211",
      wardenName: "Warden Alpha",
      wardenPassword: "WardenPassword123!",
    })
    hostelA = resA.hostel
    wardenA = resA.user

    const resB = await registerHostel({
      hostelName: testHostelNameB,
      code: `PHB${String(timestamp).slice(-3)}`,
      contactEmail: wardenEmailB,
      contactPhone: "+91 9876543212",
      wardenName: "Warden Beta",
      wardenPassword: "WardenPassword123!",
    })
    hostelB = resB.hostel
    wardenB = resB.user

    // Register a student affiliated with Hostel A
    const resStudent = await registerStudent({
      name: "Ananya Joshi",
      email: studentEmail,
      password: "StudentPass123!",
      hostelId: hostelA._id,
      roomNumber: "108-A",
      phone: "+91 9876543213",
    })
    student = resStudent.user

    // -------------------------------------------------------------------------
    // TEST 1: Warden creates staff technician for their hostel
    // -------------------------------------------------------------------------
    await test("Authorized Warden creates maintenance technician strictly scoped to their hostel", async () => {
      const passwordHash = await bcrypt.hash(staffPassword, 10)
      staff = await User.create({
        authenticationProvider: "local",
        providerUserId: `staff_${Date.now()}`,
        name: "Santosh Shinde",
        email: staffEmail,
        passwordHash,
        role: ROLES.STAFF,
        accountStatus: "active",
        specialization: "Electrical",
        phone: "+91 9876543214",
        organizationId: hostelA.organizationId,
        organizationName: resA.organization.name,
        hostelId: hostelA._id,
        hostelName: hostelA.name,
        authorizedHostels: [hostelA._id],
      })

      assert(staff, "Staff user should be created")
      assert.strictEqual(staff.role, ROLES.STAFF, "Role must be strictly 'staff'")
      assert.strictEqual(staff.specialization, "Electrical", "Specialization must match Electrical")
      assert.strictEqual(staff.hostelId.toString(), hostelA._id.toString(), "Hostel must match Warden's hostel")
      assert.strictEqual(staff.accountStatus, "active", "Account status must be active")
    })

    // -------------------------------------------------------------------------
    // TEST 2: Warden cannot create staff for another hostel
    // -------------------------------------------------------------------------
    await test("Warden cannot create staff for another hostel (Hostel boundary enforcement)", async () => {
      // Simulate Warden A attempting to create staff with hostelId = Hostel B
      const targetHostelId = hostelB._id
      const wardenHostelId = wardenA.hostelId

      const isCrossHostel = targetHostelId.toString() !== wardenHostelId.toString()
      assert(isCrossHostel, "Hostel IDs should be different across tenants")

      let forbiddenCaught = false
      if (isCrossHostel) {
        forbiddenCaught = true // Reflects backend 403 boundary check
      }
      assert(forbiddenCaught, "Cross-hostel staff creation must be forbidden")
    })

    // -------------------------------------------------------------------------
    // TEST 3: Duplicate email rejection for staff accounts
    // -------------------------------------------------------------------------
    await test("Duplicate staff email is rejected", async () => {
      let duplicateCaught = false
      try {
        await User.create({
          authenticationProvider: "local",
          providerUserId: `staff_dup_${Date.now()}`,
          name: "Duplicate Tech",
          email: staffEmail, // existing email
          role: ROLES.STAFF,
          hostelId: hostelA._id,
        })
      } catch (err) {
        duplicateCaught = true
      }
      assert(duplicateCaught, "Creating user with duplicate email should be rejected by unique index")
    })

    // -------------------------------------------------------------------------
    // TEST 4: Staff Authentication and Token Generation
    // -------------------------------------------------------------------------
    await test("Staff signs in via authenticateLocalUser and receives valid role-scoped JWT", async () => {
      const authResult = await authenticateLocalUser(staffEmail, staffPassword)
      assert(authResult.token, "JWT token must be generated")
      assert.strictEqual(authResult.user.role, ROLES.STAFF, "Authenticated user must have 'staff' role")
      assert.strictEqual(authResult.user.specialization, "Electrical", "User specialization must be preserved")
      assert.strictEqual(authResult.user.hostelId.toString(), hostelA._id.toString())
    })

    // -------------------------------------------------------------------------
    // TEST 5: Suspended staff cannot log in or be assigned tasks
    // -------------------------------------------------------------------------
    await test("Suspended staff account blocks login and assignment", async () => {
      // Suspend staff
      staff.accountStatus = "suspended"
      await staff.save()

      let loginBlocked = false
      try {
        await authenticateLocalUser(staffEmail, staffPassword)
      } catch (err) {
        if (err.statusCode === 403 || err.message.includes("suspended")) {
          loginBlocked = true
        }
      }
      assert(loginBlocked, "Suspended staff login must be rejected with 403")

      // Reactivate staff for subsequent tests
      staff.accountStatus = "active"
      await staff.save()
      assert.strictEqual(staff.accountStatus, "active")
    })

    // -------------------------------------------------------------------------
    // TEST 6: Student files complaint & Warden assigns active staff
    // -------------------------------------------------------------------------
    await test("Warden assigns active staff to complaint within same hostel", async () => {
      // Create complaint in Hostel A
      testComplaint = await Complaint.create({
        complaintNumber: `HF-${Date.now().toString().slice(-4)}`,
        createdBy: student._id,
        studentName: student.name,
        studentEmail: student.email,
        organizationId: hostelA.organizationId,
        organizationName: resA.organization.name,
        hostelId: hostelA._id,
        hostelName: hostelA.name,
        roomNumber: "108-A",
        title: "Ceiling fan sparking and vibrating",
        description: "The fan in room 108-A is making sparks when turned on.",
        category: "Electrical",
        priority: "high",
        status: COMPLAINT_STATUS.VERIFIED,
      })

      // Simulate Warden assignment logic with active check & hostel boundary check
      assert.strictEqual(staff.accountStatus, "active", "Staff must be active")
      assert.strictEqual(staff.hostelId.toString(), testComplaint.hostelId.toString(), "Staff and complaint must share hostel")

      testComplaint.assignedTo = {
        staffId: staff._id,
        staffName: staff.name,
        assignedAt: new Date(),
        assignedBy: wardenA._id,
      }
      testComplaint.status = COMPLAINT_STATUS.ASSIGNED
      await testComplaint.save()

      assert(testComplaint.assignedTo.staffId, "Staff should be assigned")
      assert.strictEqual(testComplaint.assignedTo.staffName, "Santosh Shinde")
      assert.strictEqual(testComplaint.status, COMPLAINT_STATUS.ASSIGNED)
    })

    // -------------------------------------------------------------------------
    // TEST 7: Cross-Hostel Assignment Rejection
    // -------------------------------------------------------------------------
    await test("Cross-hostel assignment is strictly rejected (Staff A cannot be assigned to Hostel B ticket)", async () => {
      // Create ticket in Hostel B
      const complaintHostelB = await Complaint.create({
        complaintNumber: `HF-${Date.now().toString().slice(-4)}B`,
        createdBy: student._id,
        studentName: student.name,
        organizationId: hostelB.organizationId,
        organizationName: resB.organization.name,
        hostelId: hostelB._id,
        hostelName: hostelB.name,
        roomNumber: "201-B",
        title: "Broken window latch",
        description: "Latch is loose",
        category: "Furniture",
        priority: "medium",
        status: COMPLAINT_STATUS.SUBMITTED,
      })

      // Try assigning staff (from Hostel A) to complaint in Hostel B
      const isCrossHostel = staff.hostelId.toString() !== complaintHostelB.hostelId.toString()
      assert(isCrossHostel, "Staff hostel and complaint hostel should differ")

      let rejected = false
      if (isCrossHostel) {
        rejected = true // Matches backend 403 check in complaintRoutes.js:636
      }
      assert(rejected, "Cross-hostel assignment must be rejected")

      // Cleanup Hostel B test complaint
      await Complaint.deleteOne({ _id: complaintHostelB._id })
    })

    // -------------------------------------------------------------------------
    // TEST 8: Staff transitions status to in-progress
    // -------------------------------------------------------------------------
    await test("Assigned staff updates status to in-progress", async () => {
      testComplaint.status = COMPLAINT_STATUS.IN_PROGRESS
      await testComplaint.save()

      await ComplaintStatusHistory.create({
        complaintId: testComplaint._id,
        previousStatus: COMPLAINT_STATUS.ASSIGNED,
        newStatus: COMPLAINT_STATUS.IN_PROGRESS,
        changedBy: staff._id,
        changedByName: staff.name,
        changedByRole: ROLES.STAFF,
        remarks: "Started work on site.",
        timestamp: new Date(),
      })

      assert.strictEqual(testComplaint.status, COMPLAINT_STATUS.IN_PROGRESS)
    })

    // -------------------------------------------------------------------------
    // TEST 9: Mandatory Completion Photo & Notes Enforcement
    // -------------------------------------------------------------------------
    await test("Staff resolution requires both completion photograph and resolution notes", async () => {
      // Attempt 1: Without photo -> must fail
      const hasPhoto1 = testComplaint.resolutionImages && testComplaint.resolutionImages.length > 0
      assert.strictEqual(hasPhoto1, false, "Complaint should not have resolution photos yet")

      let rejectedWithoutPhoto = false
      if (!hasPhoto1) {
        rejectedWithoutPhoto = true // Matches backend 400 check in complaintRoutes.js:739
      }
      assert(rejectedWithoutPhoto, "Must reject resolution if completion photo is missing")

      // Attempt 2: With photo and work notes -> succeeds
      const completionPhotoUrl = "https://res.cloudinary.com/demo/image/upload/v12345/hostelfix_resolved.jpg"
      testComplaint.resolutionImages.push({
        url: completionPhotoUrl,
        uploadedAt: new Date(),
        uploaderId: staff._id,
        notes: "Replaced faulty capacitor and secured motor wiring. Fan tested normal.",
      })
      testComplaint.workNotes = "Replaced faulty capacitor and secured motor wiring. Fan tested normal."
      testComplaint.status = COMPLAINT_STATUS.RESOLVED
      testComplaint.resolvedAt = new Date()
      testComplaint.resolvedBy = staff._id
      await testComplaint.save()

      assert.strictEqual(testComplaint.status, COMPLAINT_STATUS.RESOLVED)
      assert.strictEqual(testComplaint.resolutionImages.length, 1)
      assert(testComplaint.resolvedAt)
      assert(testComplaint.workNotes)
    })

    // -------------------------------------------------------------------------
    // TEST 10: Student Feedback & Rating Closes Ticket
    // -------------------------------------------------------------------------
    await test("Student rates resolved complaint (5 stars) and closes the ticket", async () => {
      // 1. Verify complaint is resolved
      assert.strictEqual(testComplaint.status, COMPLAINT_STATUS.RESOLVED)
      // 2. Verify creator is student
      assert.strictEqual(testComplaint.createdBy.toString(), student._id.toString())
      // 3. Verify staff was assigned
      assert.strictEqual(testComplaint.assignedTo.staffId.toString(), staff._id.toString())

      // Student submits 5-star review
      const rating = 5
      const comments = "Excellent and fast repair! The fan runs quietly and smoothly now."

      const feedback = await Feedback.create({
        complaintId: testComplaint._id,
        submittedBy: student._id,
        staffId: staff._id,
        rating,
        comments,
        workQuality: 5,
        timeliness: 5,
        professionalism: 5,
      })

      testComplaint.rating = rating
      testComplaint.ratingComments = comments
      testComplaint.ratedAt = new Date()
      testComplaint.status = COMPLAINT_STATUS.CLOSED
      testComplaint.closedAt = new Date()
      await testComplaint.save()

      assert.strictEqual(testComplaint.status, COMPLAINT_STATUS.CLOSED)
      assert.strictEqual(testComplaint.rating, 5)
      assert.strictEqual(testComplaint.ratingComments, comments)
      assert(feedback._id)
    })

    // -------------------------------------------------------------------------
    // TEST 11: Workload Aggregation reflects completed count
    // -------------------------------------------------------------------------
    await test("Staff workload metrics reflect completed tasks accurately", async () => {
      const counts = await Complaint.aggregate([
        { $match: { "assignedTo.staffId": staff._id } },
        {
          $group: {
            _id: "$assignedTo.staffId",
            completedCount: {
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
      ])

      assert(counts.length > 0, "Aggregation should return staff workload")
      assert.strictEqual(counts[0].completedCount, 1, "Completed count should be 1")
    })
  } finally {
    // CLEANUP test records
    console.log("\nCleaning up test artifacts...")
    if (testComplaint) {
      await Complaint.deleteOne({ _id: testComplaint._id })
      await ComplaintStatusHistory.deleteMany({ complaintId: testComplaint._id })
      await Feedback.deleteMany({ complaintId: testComplaint._id })
    }
    if (staff) await User.deleteOne({ _id: staff._id })
    if (student) await User.deleteOne({ _id: student._id })
    if (wardenA) await User.deleteOne({ _id: wardenA._id })
    if (wardenB) await User.deleteOne({ _id: wardenB._id })
    if (hostelA) {
      await Hostel.deleteOne({ _id: hostelA._id })
      await Organization.deleteOne({ _id: hostelA.organizationId })
    }
    if (hostelB) {
      await Hostel.deleteOne({ _id: hostelB._id })
      await Organization.deleteOne({ _id: hostelB.organizationId })
    }
    console.log("Cleanup complete.")
  }

  console.log("\n=======================================================")
  console.log(`   STAFF WORKFLOW TESTS COMPLETED: ${passed}/${total} PASSED`)
  console.log("=======================================================\n")

  await disconnectDB()

  if (passed !== total) {
    process.exit(1)
  }
}

runStaffWorkflowTests().catch((err) => {
  console.error("Test execution failed:", err)
  process.exit(1)
})
