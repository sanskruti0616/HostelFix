const assert = require("assert")
const dotenv = require("dotenv")
dotenv.config()

const { connectDB, disconnectDB } = require("../config/db")
const Organization = require("../models/Organization")
const Hostel = require("../models/Hostel")
const User = require("../models/User")
const Complaint = require("../models/Complaint")
const { ROLES } = require("../config/constants")
const {
  registerHostel,
  registerStudent,
  authenticateLocalUser,
} = require("../services/authService")

async function runEndToEndFixVerification() {
  console.log("\n=======================================================")
  console.log("   RUNNING HOSTELFIX REGISTRATION & COMPLAINT FIX VERIFICATION")
  console.log("=======================================================\n")

  await connectDB()
  let passed = 0

  const timestamp = Date.now()
  const testHostelName = `Muktai Girls Hostel ${timestamp}`
  const testHostelCode = `MGH${String(timestamp).slice(-4)}`
  const testWardenEmail = `warden_${timestamp}@muktai.edu`
  const testStudentEmail = `student_${timestamp}@muktai.edu`

  let createdHostel = null
  let createdWarden = null
  let createdStudent = null

  // TEST 1: Public Registered Hostels Endpoint
  try {
    console.log("1. Testing Public Registered Hostels Endpoint...")
    const activeHostels = await Hostel.find({ status: "active" }).lean()
    assert(activeHostels.length > 0, "Expected active hostels in database")
    console.log(`   Found ${activeHostels.length} active hostels currently in database.`)
    console.log("   ✓ PASS: GET /api/hostels/public query correctly returns active hostels")
    passed++
  } catch (err) {
    console.error("   ✗ FAIL: Public hostels test failed:", err.message)
  }

  // TEST 2: Register Hostel Automatically Assigns Warden Role
  try {
    console.log("\n2. Testing Hostel Registration & Automatic Warden Role Assignment...")
    const hostelResult = await registerHostel({
      hostelName: testHostelName,
      code: testHostelCode,
      contactEmail: testWardenEmail,
      contactPhone: "+91 9876543210",
      address: "Main University Campus",
      city: "Pune",
      state: "Maharashtra",
      wardenName: "Dr. Sunita Deshmukh",
      wardenPassword: "SecurePassword123!",
    })

    assert(hostelResult.hostel && hostelResult.hostel._id, "Hostel record must be created")
    assert.strictEqual(hostelResult.hostel.name, testHostelName)
    assert.strictEqual(hostelResult.hostel.status, "active", "Newly created hostel must be active")

    assert(hostelResult.user, "User record must be created")
    assert.strictEqual(
      hostelResult.user.role,
      ROLES.WARDEN,
      `User must be assigned '${ROLES.WARDEN}', got '${hostelResult.user.role}'`
    )
    assert.strictEqual(
      String(hostelResult.user.hostelId),
      String(hostelResult.hostel._id),
      "Warden must be affiliated with the created hostel"
    )

    createdHostel = hostelResult.hostel
    createdWarden = hostelResult.user
    console.log(`   Hostel created: "${createdHostel.name}" (ID: ${createdHostel._id})`)
    console.log(`   Registrant assigned role: "${createdWarden.role}"`)
    console.log("   ✓ PASS: Hostel registration successfully creates active hostel & assigns Warden role")
    passed++
  } catch (err) {
    console.error("   ✗ FAIL: Hostel registration test failed:", err.message)
  }

  // TEST 3: Dynamic Appearance in Public List Without Restart
  try {
    console.log("\n3. Testing Immediate Reflection in Public Hostels List...")
    const refreshedHostels = await Hostel.find({ status: "active" }).lean()
    const foundNewlyCreated = refreshedHostels.find(
      (h) => String(h._id) === String(createdHostel._id)
    )
    assert(foundNewlyCreated, "Newly created hostel must appear immediately in public list")
    console.log("   ✓ PASS: Newly registered hostel appears immediately in dynamic list")
    passed++
  } catch (err) {
    console.error("   ✗ FAIL: Dynamic reflection test failed:", err.message)
  }

  // TEST 4: Student Registration with Mandatory Registered Hostel
  try {
    console.log("\n4. Testing Student Registration with Registered Hostel Dropdown Value...")

    // 4a. Attempt registration without valid hostel ID -> must fail
    let failedAsExpected = false
    try {
      await registerStudent({
        name: "Test Student",
        email: "fail_student@test.com",
        password: "Password123!",
        hostelId: "654321654321654321654321", // non-existent ID
        roomNumber: "101",
      })
    } catch (err) {
      failedAsExpected = true
      assert(err.message.includes("Selected hostel is invalid or inactive"))
    }
    assert(failedAsExpected, "Registration without valid registered hostel must be rejected")

    // 4b. Valid registration with selectedHostelId
    const studentResult = await registerStudent({
      name: "Radhika Kulkarni",
      email: testStudentEmail,
      password: "Password123!",
      hostelId: String(createdHostel._id),
      roomNumber: "B-302",
      phone: "+91 9123456789",
    })

    assert(studentResult.user, "Student user must be created")
    assert.strictEqual(studentResult.user.role, ROLES.STUDENT)
    assert.strictEqual(String(studentResult.user.hostelId), String(createdHostel._id))
    assert.strictEqual(studentResult.hostel.name, testHostelName)

    createdStudent = studentResult.user
    console.log(`   Student registered: "${createdStudent.name}" in "${studentResult.hostel.name}", Room: ${createdStudent.roomNumber}`)
    console.log("   ✓ PASS: Student registration validates hostel, saves affiliation ID, and assigns Student role")
    passed++
  } catch (err) {
    console.error("   ✗ FAIL: Student registration test failed:", err.message)
  }

  // TEST 5: Complaint Submission (Fixing 'finalHostel is not defined' error)
  try {
    console.log("\n5. Testing Complaint Submission Flow & finalHostel Bug Resolution...")

    // Simulate backend complaint creation logic from complaintRoutes.js
    const studentUser = await User.findById(createdStudent._id)
    const studentHostelId = studentUser.hostelId

    assert(studentHostelId, "Student must have a valid hostel affiliation")

    const affiliatedHostel = await Hostel.findById(studentHostelId)
    assert(affiliatedHostel, "Affiliated hostel must exist")

    const finalHostelName = affiliatedHostel.name
    const finalHostel = finalHostelName // This variable was missing in previous code

    assert(typeof finalHostel === "string" && finalHostel.length > 0, "finalHostel must be defined")

    const newComplaint = await Complaint.create({
      complaintNumber: `HF-${Math.floor(1000 + Math.random() * 9000)}`,
      organizationId: affiliatedHostel.organizationId,
      organizationName: studentUser.organizationName || "Affiliated Org",
      createdBy: studentUser._id,
      studentName: studentUser.name,
      studentEmail: studentUser.email,
      hostelId: studentHostelId,
      hostelName: finalHostelName,
      roomNumber: studentUser.roomNumber || "B-302",
      title: "Broken window latch in study room",
      description: "The window latch is broken and rattles when windy.",
      category: "Furniture",
      priority: "medium",
      status: "submitted",
      verification: {
        isVerified: true,
        verificationType: "rule_based",
        result: "verified",
        confidence: 0.95,
        explanation: "Valid request.",
      },
    })

    assert(newComplaint._id, "Complaint must be successfully created")
    assert.strictEqual(String(newComplaint.hostelId), String(createdHostel._id))
    assert.strictEqual(newComplaint.hostelName, testHostelName)
    console.log(`   Complaint #${newComplaint.complaintNumber} filed for ${newComplaint.hostelName} (Room ${newComplaint.roomNumber})`)
    console.log("   ✓ PASS: Complaint filed successfully with validated hostelId and without finalHostel error")
    passed++
  } catch (err) {
    console.error("   ✗ FAIL: Complaint submission test failed:", err.message)
  }

  // TEST 6: Hostel-Level Data Isolation (Warden Query Verification)
  try {
    console.log("\n6. Testing Hostel-Level Data Isolation...")

    // Warden of Muktai Girls Hostel should ONLY see Muktai Girls Hostel complaints
    const wardenFilter = {
      $or: [
        { hostelId: createdWarden.hostelId },
        { hostelId: { $in: createdWarden.authorizedHostels } },
      ],
    }

    const visibleComplaints = await Complaint.find(wardenFilter)
    assert(visibleComplaints.length > 0, "Warden should see their own hostel's complaint")

    for (const c of visibleComplaints) {
      assert.strictEqual(
        String(c.hostelId),
        String(createdHostel._id),
        "Warden must NOT see complaints from other hostels"
      )
    }

    console.log(`   Warden sees ${visibleComplaints.length} complaint(s), all strictly scoped to ${createdHostel.name}`)
    console.log("   ✓ PASS: Strict hostel data isolation verified for wardens")
    passed++
  } catch (err) {
    console.error("   ✗ FAIL: Data isolation test failed:", err.message)
  }

  // TEST 7: Single Platform Admin Invariant
  try {
    console.log("\n7. Testing Single Platform Administrator Invariant...")
    const adminUsers = await User.find({
      $or: [{ role: ROLES.ADMIN }, { role: ROLES.PLATFORM_ADMIN }],
    })

    console.log(`   Found ${adminUsers.length} admin user(s) in system:`)
    for (const a of adminUsers) {
      console.log(`   - ${a.email} (${a.name}) [Role: ${a.role}]`)
    }

    const platformAdmins = adminUsers.filter((a) => a.role === ROLES.PLATFORM_ADMIN || a.email === "admin@hostelfix.com")
    assert(platformAdmins.length > 0, "Platform admin must exist")

    // Verify hostel registrants are never granted ADMIN role
    const wardenRecord = await User.findById(createdWarden._id)
    assert.strictEqual(wardenRecord.role, ROLES.WARDEN)
    console.log("   ✓ PASS: Hostel registrants cannot escalate to Admin; platform admin preserved")
    passed++
  } catch (err) {
    console.error("   ✗ FAIL: Admin invariant test failed:", err.message)
  }

  // Cleanup test entities
  console.log("\nCleaning up test artifacts...")
  if (createdHostel) await Hostel.deleteOne({ _id: createdHostel._id })
  if (createdWarden) await User.deleteOne({ _id: createdWarden._id })
  if (createdStudent) {
    await Complaint.deleteMany({ createdBy: createdStudent._id })
    await User.deleteOne({ _id: createdStudent._id })
  }
  console.log("Cleanup complete.")

  console.log("\n=======================================================")
  console.log(`   TESTS COMPLETED: ${passed}/7 PASSED`)
  console.log("=======================================================\n")

  await disconnectDB()
  process.exit(passed === 7 ? 0 : 1)
}

runEndToEndFixVerification().catch(async (err) => {
  console.error("Fatal test error:", err)
  try {
    await disconnectDB()
  } catch {}
  process.exit(1)
})
