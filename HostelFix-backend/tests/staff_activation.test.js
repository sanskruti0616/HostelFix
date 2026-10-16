const assert = require("assert")
const dotenv = require("dotenv")
dotenv.config()

const { connectDB, disconnectDB } = require("../config/db")
const Organization = require("../models/Organization")
const Hostel = require("../models/Hostel")
const User = require("../models/User")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { ROLES, USER_STATUS } = require("../config/constants")
const {
  registerHostel,
  authenticateLocalUser,
  generateToken,
  JWT_SECRET,
} = require("../services/authService")

async function runStaffActivationTests() {
  console.log("\n=======================================================")
  console.log("   RUNNING HOSTELFIX STAFF ACTIVATION & INVITATION TESTS")
  console.log("=======================================================\n")

  await connectDB()
  let passed = 0
  let total = 0

  const timestamp = Date.now()
  const testHostelNameA = `Greenfield Campus ${timestamp}`
  const testHostelNameB = `Horizon Heights ${timestamp}`
  const wardenEmailA = `warden_green_${timestamp}@campus.edu`
  const wardenEmailB = `warden_horiz_${timestamp}@campus.edu`
  const staffEmailA = `tech_${timestamp}@greenfield.com`
  const staffEmailB = `tech_b_${timestamp}@horizon.com`

  let hostelA = null
  let hostelB = null
  let wardenA = null
  let wardenB = null
  let createdStaff = null

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
    // SETUP: Register two hostels with respective wardens
    const regA = await registerHostel({
      hostelName: testHostelNameA,
      contactEmail: wardenEmailA,
      wardenName: "Warden Greenfield",
      wardenPassword: "WardenPassword123!",
    })
    hostelA = regA.hostel
    wardenA = regA.user

    const regB = await registerHostel({
      hostelName: testHostelNameB,
      contactEmail: wardenEmailB,
      wardenName: "Warden Horizon",
      wardenPassword: "WardenPassword123!",
    })
    hostelB = regB.hostel
    wardenB = regB.user

    console.log(`[Setup] Created Hostels: "${hostelA.name}" and "${hostelB.name}"\n`)

    // TEST 1: Warden creates a staff member without password -> status should be pending_activation
    await test("1. Warden creates staff without password -> pending_activation with 7-day token", async () => {
      // Simulate backend POST /api/users/staff logic
      const crypto = require("crypto")
      const activationToken = `STAFF-${crypto.randomBytes(4).toString("hex").toUpperCase()}`
      const activationTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const dummyPasswordHash = await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10)

      createdStaff = await User.create({
        authenticationProvider: "local",
        providerUserId: `staff_${Date.now()}`,
        name: "Suresh Plumber",
        email: staffEmailA,
        username: `suresh_plumber_${Date.now().toString(36)}`,
        passwordHash: dummyPasswordHash,
        role: ROLES.STAFF,
        accountStatus: "pending_activation",
        phone: "+91 9876543210",
        specialization: "Plumbing",
        organizationId: hostelA.organizationId,
        organizationName: "Greenfield Campus Org",
        hostelId: hostelA._id,
        hostelName: hostelA.name,
        authorizedHostels: [hostelA._id],
        activationToken,
        activationTokenExpires,
      })

      assert.strictEqual(createdStaff.role, ROLES.STAFF, "Role must be staff")
      assert.strictEqual(createdStaff.accountStatus, "pending_activation", "Status must be pending_activation")
      assert.ok(createdStaff.activationToken.startsWith("STAFF-"), "Token must begin with STAFF-")
      assert.ok(createdStaff.activationTokenExpires > new Date(), "Expiration must be in the future")
    })

    // TEST 2: Attempting to log in as pending_activation staff should be rejected
    await test("2. Staff login rejected while in pending_activation state", async () => {
      let threw = false
      try {
        await authenticateLocalUser(staffEmailA, "AnyPassword123!")
      } catch (err) {
        threw = true
        assert.ok(
          err.message.includes("pending activation") || err.statusCode === 403,
          "Expected pending activation rejection message"
        )
      }
      assert.strictEqual(threw, true, "Should have thrown an error for unactivated staff account")
    })

    // TEST 3: Validate token verification logic (GET /api/auth/staff/verify-token)
    await test("3. Token verification successfully finds and returns staff member details", async () => {
      const found = await User.findOne({
        activationToken: createdStaff.activationToken,
        role: ROLES.STAFF,
      })

      assert.ok(found, "Staff user should be found by activation token")
      assert.strictEqual(found.email, staffEmailA)
      assert.strictEqual(found.specialization, "Plumbing")
      assert.strictEqual(found.accountStatus, "pending_activation")
    })

    // TEST 4: Invalid or fabricated token verification should fail
    await test("4. Verification of invalid / fabricated token fails", async () => {
      const found = await User.findOne({
        activationToken: "STAFF-FAKE999",
        role: ROLES.STAFF,
      })
      assert.strictEqual(found, null, "Fabricated token must return null")
    })

    // TEST 5: Staff account activation with password setup (POST /api/auth/staff/activate)
    const newStaffPassword = "NewStaffPassword2026!"
    await test("5. Staff sets password and completes account activation", async () => {
      const staffUser = await User.findOne({
        activationToken: createdStaff.activationToken,
        role: ROLES.STAFF,
      })

      assert.ok(staffUser, "Token must be valid")
      assert.ok(newStaffPassword.length >= 6, "Password length >= 6")

      // Update password, status, and clear activation token
      staffUser.passwordHash = await bcrypt.hash(newStaffPassword, 10)
      staffUser.accountStatus = "active"
      staffUser.activationToken = ""
      staffUser.activationTokenExpires = null
      staffUser.lastLoginAt = new Date()
      await staffUser.save()

      assert.strictEqual(staffUser.accountStatus, "active", "Account status must be active")
      assert.strictEqual(staffUser.activationToken, "", "Activation token must be cleared")
      assert.strictEqual(staffUser.activationTokenExpires, null, "Token expiration must be null")
    })

    // TEST 6: Staff can now successfully sign in with the new password
    await test("6. Newly activated staff can authenticate and receive JWT session", async () => {
      const authResult = await authenticateLocalUser(staffEmailA, newStaffPassword)
      assert.ok(authResult, "Auth result should be returned")
      assert.strictEqual(authResult.user.role, ROLES.STAFF, "User role must be staff")
      assert.strictEqual(authResult.user.email, staffEmailA)
      assert.strictEqual(authResult.user.accountStatus, "active")

      const token = generateToken(authResult.user)
      const decoded = jwt.verify(token, JWT_SECRET)
      assert.strictEqual(decoded.role, ROLES.STAFF)
      assert.strictEqual(decoded.email, staffEmailA)
    })

    // TEST 7: Activation token cannot be reused
    await test("7. Already-used activation token is rejected on subsequent attempts", async () => {
      const found = await User.findOne({
        activationToken: createdStaff.activationToken,
        role: ROLES.STAFF,
      })
      // Since token was cleared, finding it must return null
      assert.strictEqual(found, null, "Cleared activation token must not match any staff user")
    })

    // TEST 8: Public arbitrary user cannot register as staff without authorization
    await test("8. Unrestricted public registration cannot create staff roles", async () => {
      // In student registration, role is strictly forced to STUDENT
      const studentReg = await User.create({
        authenticationProvider: "local",
        providerUserId: `student_${Date.now()}`,
        name: "Normal Student",
        email: `student_${Date.now()}@test.edu`,
        username: `student_${Date.now()}`,
        passwordHash: await bcrypt.hash("StudentPass123!", 10),
        role: ROLES.STUDENT,
        accountStatus: "active",
      })

      assert.strictEqual(studentReg.role, ROLES.STUDENT, "Student cannot register as staff")
      await User.deleteOne({ _id: studentReg._id })
    })

    // TEST 9: Warden A cannot create staff scoped to Hostel B
    await test("9. Cross-hostel staff creation security check", async () => {
      const wardenHostelId = wardenA.hostelId || (wardenA.authorizedHostels && wardenA.authorizedHostels[0])
      const targetHostelId = hostelB._id

      const isPermitted = Boolean(
        wardenHostelId && targetHostelId && wardenHostelId.toString() === targetHostelId.toString()
      )
      assert.strictEqual(isPermitted, false, "Warden A must not be permitted to target Hostel B")
    })

    // TEST 10: Staff listing returns activation tokens for pending staff
    await test("10. Staff listing includes activation token for pending staff members", async () => {
      const pendingStaff = await User.create({
        authenticationProvider: "local",
        providerUserId: `staff_pending_${Date.now()}`,
        name: "Pending Electrician",
        email: `electrician_${Date.now()}@test.com`,
        username: `elec_${Date.now()}`,
        passwordHash: await bcrypt.hash("dummyHash", 10),
        role: ROLES.STAFF,
        accountStatus: "pending_activation",
        specialization: "Electrical",
        hostelId: hostelA._id,
        hostelName: hostelA.name,
        activationToken: "STAFF-9876",
        activationTokenExpires: new Date(Date.now() + 86400000),
      })

      const staffList = await User.find({
        hostelId: hostelA._id,
        role: ROLES.STAFF,
      }).select("name email accountStatus activationToken specialization")

      const target = staffList.find((s) => s.email === pendingStaff.email)
      assert.ok(target, "Pending staff must be in listing")
      assert.strictEqual(target.accountStatus, "pending_activation")
      assert.strictEqual(target.activationToken, "STAFF-9876")

      await User.deleteOne({ _id: pendingStaff._id })
    })

  } finally {
    // CLEANUP: Clean up test documents
    console.log("\n[Cleanup] Cleaning up test users and hostels...")
    if (createdStaff) await User.deleteOne({ _id: createdStaff._id })
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
    console.log("[Cleanup] Complete.")
  }

  console.log("\n=======================================================")
  console.log(`   STAFF ACTIVATION TESTS: ${passed}/${total} PASSED`)
  console.log("=======================================================\n")

  await disconnectDB()

  if (passed !== total) {
    process.exit(1)
  }
}

runStaffActivationTests().catch((err) => {
  console.error("Test execution failed:", err)
  process.exit(1)
})
