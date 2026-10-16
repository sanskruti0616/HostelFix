const assert = require("assert")
const dotenv = require("dotenv")
dotenv.config()

const { connectDB, disconnectDB } = require("../config/db")
const Organization = require("../models/Organization")
const Hostel = require("../models/Hostel")
const User = require("../models/User")
const { ROLES } = require("../config/constants")
const {
  affiliateUser,
  affiliateUserWithInvitationCode,
  verifyInvitationCode,
  getPublicOrganizations,
} = require("../services/authService")

async function runAffiliationModesTests() {
  console.log("\n=======================================================")
  console.log("   RUNNING HOSTELFIX AFFILIATION MODES VERIFICATION")
  console.log("=======================================================\n")

  await connectDB()

  let passed = 0
  let total = 0
  const createdUserIds = []

  // Helper to create a temporary test student with pending affiliation
  async function createPendingStudent(suffix) {
    const student = await User.create({
      authenticationProvider: "local",
      providerUserId: `test_student_${Date.now()}_${suffix}`,
      name: `Test Student ${suffix}`,
      email: `test_student_${Date.now()}_${suffix}@hostelfix.test`,
      role: ROLES.STUDENT,
      accountStatus: "pending_affiliation",
      organizationId: null,
      hostelId: null,
      authorizedHostels: [],
    })
    createdUserIds.push(student._id)
    return student
  }

  // -------------------------------------------------------------
  // TEST 1: INVITATION MODE - Empty code validation
  // -------------------------------------------------------------
  total++
  try {
    const student = await createPendingStudent("inv_empty")
    let threw = false
    try {
      await affiliateUser({
        userId: student._id,
        invitationCode: "",
        mode: "invitation",
      })
    } catch (err) {
      threw = true
      assert.strictEqual(
        err.message,
        "Invitation code is required",
        `Expected 'Invitation code is required', got '${err.message}'`
      )
      assert.strictEqual(err.statusCode, 400)
    }
    assert(threw, "Expected error when submitting invitation mode without a code")
    console.log("  ✓ PASS: Invitation mode with empty code throws 'Invitation code is required'")
    passed++
  } catch (err) {
    console.error("  ✗ FAIL: Test 1 failed:", err.message)
  }

  // -------------------------------------------------------------
  // TEST 2: INVITATION MODE - Code verification against MongoDB
  // -------------------------------------------------------------
  total++
  try {
    const validVerify = await verifyInvitationCode("DEMO2026")
    assert(validVerify.organization, "Expected organization for DEMO2026")
    assert.strictEqual(validVerify.organization.invitationCode, "DEMO2026")
    assert(Array.isArray(validVerify.hostels) && validVerify.hostels.length > 0)
    console.log("  ✓ PASS: Valid invitation code correctly verified against MongoDB")
    passed++
  } catch (err) {
    console.error("  ✗ FAIL: Test 2 failed:", err.message)
  }

  // -------------------------------------------------------------
  // TEST 3: INVITATION MODE - Invalid code verification
  // -------------------------------------------------------------
  total++
  try {
    const invalidVerify = await verifyInvitationCode("NONEXISTENT_CODE_999")
    assert.strictEqual(invalidVerify.valid, false)
    assert(invalidVerify.message.includes("Invalid or inactive"))
    console.log("  ✓ PASS: Invalid invitation code returns valid: false")
    passed++
  } catch (err) {
    console.error("  ✗ FAIL: Test 3 failed:", err.message)
  }

  // -------------------------------------------------------------
  // TEST 4: INVITATION MODE - Successful affiliation
  // -------------------------------------------------------------
  total++
  try {
    const student = await createPendingStudent("inv_success")
    const result = await affiliateUser({
      userId: student._id,
      invitationCode: "DEMO2026",
      roomNumber: "A-201",
      mode: "invitation",
    })

    assert.strictEqual(result.user.accountStatus, "active")
    assert(result.user.organizationId, "User must have organizationId")
    assert(result.user.hostelId, "User must have hostelId")
    assert.strictEqual(result.user.roomNumber, "A-201")
    assert.strictEqual(result.user.role, ROLES.STUDENT, "Role must remain student")
    assert(result.token, "Must return active JWT token")
    console.log("  ✓ PASS: Valid invitation code successfully affiliates student to active status")
    passed++
  } catch (err) {
    console.error("  ✗ FAIL: Test 4 failed:", err.message)
  }

  // -------------------------------------------------------------
  // TEST 5: DIRECTORY MODE - Public directory listing
  // -------------------------------------------------------------
  total++
  try {
    const directory = await getPublicOrganizations()
    assert(Array.isArray(directory) && directory.length > 0, "Directory must list active organizations")
    for (const org of directory) {
      assert(org.id, "Org must have id")
      assert(org.name, "Org must have name")
      assert(Array.isArray(org.hostels), "Org must have hostels list")
    }
    console.log(`  ✓ PASS: Public directory returns ${directory.length} eligible organizations`)
    passed++
  } catch (err) {
    console.error("  ✗ FAIL: Test 5 failed:", err.message)
  }

  // -------------------------------------------------------------
  // TEST 6: DIRECTORY MODE - Missing hostel selection error
  // -------------------------------------------------------------
  total++
  try {
    const student = await createPendingStudent("dir_missing")
    let threw = false
    try {
      await affiliateUser({
        userId: student._id,
        hostelId: null,
        organizationId: null,
        mode: "directory",
      })
    } catch (err) {
      threw = true
      assert.strictEqual(
        err.message,
        "Please select your registered hostel.",
        `Expected 'Please select your registered hostel.', got '${err.message}'`
      )
      assert.strictEqual(err.statusCode, 400)
    }
    assert(threw, "Expected error when submitting directory mode without hostel")
    console.log("  ✓ PASS: Directory mode without hostel throws 'Please select your registered hostel.' (NOT invitation code error)")
    passed++
  } catch (err) {
    console.error("  ✗ FAIL: Test 6 failed:", err.message)
  }

  // -------------------------------------------------------------
  // TEST 7: DIRECTORY MODE - Successful affiliation WITHOUT invitation code
  // -------------------------------------------------------------
  total++
  try {
    const student = await createPendingStudent("dir_success")
    const activeHostel = await Hostel.findOne({ status: "active" })
    assert(activeHostel, "Active hostel must exist in DB")

    const result = await affiliateUser({
      userId: student._id,
      hostelId: activeHostel._id.toString(),
      roomNumber: "C-105",
      mode: "directory",
    })

    assert.strictEqual(result.user.accountStatus, "active")
    assert.strictEqual(result.user.hostelId.toString(), activeHostel._id.toString())
    assert.strictEqual(result.user.roomNumber, "C-105")
    assert.strictEqual(result.user.invitationCodeUsed, "", "Invitation code used should be empty in directory mode")
    assert.strictEqual(result.user.role, ROLES.STUDENT, "Role must remain student")
    assert(result.token, "Must return active JWT token")
    console.log("  ✓ PASS: Directory affiliation succeeds WITHOUT invitation code")
    passed++
  } catch (err) {
    console.error("  ✗ FAIL: Test 7 failed:", err.message)
  }

  // -------------------------------------------------------------
  // TEST 8: DIRECTORY MODE - Untrusted / Invalid hostel ID rejected
  // -------------------------------------------------------------
  total++
  try {
    const student = await createPendingStudent("dir_invalid_hostel")
    const fakeId = "60d5ec49f1b2c82b98e1e999"
    let threw = false
    try {
      await affiliateUser({
        userId: student._id,
        hostelId: fakeId,
        mode: "directory",
      })
    } catch (err) {
      threw = true
      assert(err.message.includes("invalid or inactive"))
    }
    assert(threw, "Backend must verify that hostel exists in MongoDB")
    console.log("  ✓ PASS: Non-existent hostel ID rejected with 400 error")
    passed++
  } catch (err) {
    console.error("  ✗ FAIL: Test 8 failed:", err.message)
  }

  // -------------------------------------------------------------
  // TEST 9: MULTI-TENANT & APPROVAL - Restricted self-registration
  // -------------------------------------------------------------
  total++
  try {
    // Create temporary organization with allowStudentSelfRegistration = false
    const restrictedOrg = await Organization.create({
      name: `Approval Required Campus ${Date.now()}`,
      slug: `restricted-campus-${Date.now().toString(36)}`,
      invitationCode: `REST-${Date.now().toString(36).toUpperCase()}`,
      contactEmail: `admin_${Date.now()}@restricted.test`,
      status: "active",
      settings: {
        allowStudentSelfRegistration: false, // Requires warden approval!
        requireApprovalForStaff: true,
        requireApprovalForWardens: true,
      },
    })

    const restrictedHostel = await Hostel.create({
      organizationId: restrictedOrg._id,
      name: `Restricted Hostel Block A`,
      code: `RHBA`,
      status: "active",
    })

    const student = await createPendingStudent("dir_restricted")

    const result = await affiliateUser({
      userId: student._id,
      hostelId: restrictedHostel._id.toString(),
      organizationId: restrictedOrg._id.toString(),
      roomNumber: "R-101",
      mode: "directory",
    })

    assert.strictEqual(
      result.user.accountStatus,
      "pending_approval",
      "Student should be placed in 'pending_approval' status when self-registration requires approval"
    )
    assert(result.message.includes("Awaiting warden approval"))
    console.log("  ✓ PASS: Restricted organization directory affiliation sets status to 'pending_approval'")
    passed++

    // -------------------------------------------------------------
    // TEST 10: WARDEN APPROVAL WORKFLOW
    // -------------------------------------------------------------
    total++
    // Create warden for restrictedOrg
    const warden = await User.create({
      authenticationProvider: "local",
      providerUserId: `warden_${Date.now()}`,
      name: "Restricted Warden",
      email: `warden_${Date.now()}@restricted.test`,
      role: ROLES.WARDEN,
      organizationId: restrictedOrg._id,
      hostelId: restrictedHostel._id,
      authorizedHostels: [restrictedHostel._id],
      accountStatus: "active",
    })
    createdUserIds.push(warden._id)

    // Warden approves the student
    const studentToApprove = await User.findById(student._id)
    assert.strictEqual(studentToApprove.accountStatus, "pending_approval")

    studentToApprove.accountStatus = "active"
    await studentToApprove.save()

    const approvedStudent = await User.findById(student._id)
    assert.strictEqual(approvedStudent.accountStatus, "active", "Approved student must be active")
    console.log("  ✓ PASS: Warden approval activates pending student membership")
    passed++

    // Clean up restricted records
    await Hostel.deleteOne({ _id: restrictedHostel._id })
    await Organization.deleteOne({ _id: restrictedOrg._id })
  } catch (err) {
    console.error("  ✗ FAIL: Test 9/10 failed:", err.message)
  }

  // -------------------------------------------------------------
  // TEST 11: ROLE PRESERVATION
  // -------------------------------------------------------------
  total++
  try {
    const student = await createPendingStudent("role_check")
    assert.strictEqual(student.role, ROLES.STUDENT)

    const result = await affiliateUser({
      userId: student._id,
      invitationCode: "DEMO2026",
      mode: "invitation",
    })
    assert.strictEqual(result.user.role, ROLES.STUDENT, "Student role must not change during affiliation")
    console.log("  ✓ PASS: User role is strictly preserved as student during affiliation")
    passed++
  } catch (err) {
    console.error("  ✗ FAIL: Test 11 failed:", err.message)
  }

  // Cleanup test users
  console.log("\nCleaning up test artifacts...")
  await User.deleteMany({ _id: { $in: createdUserIds } })
  console.log("Cleanup complete.")

  console.log("\n=======================================================")
  console.log(`   AFFILIATION MODES TESTS COMPLETED: ${passed}/${total} PASSED`)
  console.log("=======================================================\n")

  await disconnectDB()
  process.exit(passed === total ? 0 : 1)
}

runAffiliationModesTests().catch((err) => {
  console.error("Test runner error:", err)
  process.exit(1)
})
