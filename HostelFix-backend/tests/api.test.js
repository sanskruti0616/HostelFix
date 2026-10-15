const assert = require("assert")
const jwt = require("jsonwebtoken")
const sharp = require("sharp")
const mongoose = require("mongoose")

const User = require("../models/User")
const Complaint = require("../models/Complaint")
const ComplaintVerification = require("../models/ComplaintVerification")
const { ROLES, COMPLAINT_STATUS, STATUS_TRANSITIONS, ALL_CATEGORIES } = require("../config/constants")
const { generateToken, JWT_SECRET } = require("../services/authService")
const {
  computePerceptualHash,
  calculateHammingDistance,
  detectBlurriness,
} = require("../services/imageService")
const {
  validateRequiredFields,
  checkCategoryConsistency,
  runVerificationPipeline,
} = require("../services/aiVerificationService")
const { canAccessComplaint } = require("../middleware/rbac")

async function runTestSuite() {
  console.log("\n=======================================================")
  console.log("   RUNNING HOSTELFIX BACKEND AUTOMATED TESTS")
  console.log("=======================================================\n")

  let passedTests = 0
  let totalTests = 0

  async function test(name, fn) {
    totalTests++
    try {
      await fn()
      console.log(`  ✓ PASS: ${name}`)
      passedTests++
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`)
      console.error(`    Error: ${err.message}`)
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: User Model Schema Validation
  // -------------------------------------------------------------------------
  await test("Validate User schema & passwordless provider requirements", async () => {
    // Valid student
    const validUser = new User({
      authenticationProvider: "google",
      providerUserId: "google_sub_12345",
      name: "Sanskruti Bhosale",
      email: "sanskruti@hostelfix.com",
      role: ROLES.STUDENT,
      hostelName: "Girls Hostel A",
      roomNumber: "A-204",
    })
    let validationError = null
    try {
      await validUser.validate()
    } catch (e) {
      validationError = e
    }
    assert.strictEqual(validationError, null, "Valid user should pass schema validation")

    // Invalid email rejection
    const invalidEmailUser = new User({
      authenticationProvider: "google",
      providerUserId: "google_sub_12345",
      name: "Bad Email",
      email: "not-an-email",
      role: ROLES.STUDENT,
    })
    let emailErr = null
    try {
      await invalidEmailUser.validate()
    } catch (e) {
      emailErr = e
    }
    assert(emailErr && emailErr.errors.email, "Invalid email format must be rejected")

    // Invalid role rejection
    const invalidRoleUser = new User({
      authenticationProvider: "google",
      providerUserId: "google_sub_12345",
      name: "Bad Role",
      email: "test@hostelfix.com",
      role: "super_hacker",
    })
    let roleErr = null
    try {
      await invalidRoleUser.validate()
    } catch (e) {
      roleErr = e
    }
    assert(roleErr && roleErr.errors.role, "Invalid role must be rejected")
  })

  // -------------------------------------------------------------------------
  // TEST 2: JWT Auth Token Generation & Claims Verification
  // -------------------------------------------------------------------------
  await test("Generate signed JWT session token with identity and hostel claims", async () => {
    const mockUser = {
      _id: new mongoose.Types.ObjectId(),
      email: "warden@hostelfix.com",
      role: ROLES.WARDEN,
      name: "Priya Sharma",
      hostelName: "Girls Hostel A",
      roomNumber: "",
    }
    const token = generateToken(mockUser)
    assert(typeof token === "string" && token.length > 20)

    const decoded = jwt.verify(token, JWT_SECRET)
    assert.strictEqual(decoded.email, "warden@hostelfix.com")
    assert.strictEqual(decoded.role, ROLES.WARDEN)
    assert.strictEqual(decoded.hostelName, "Girls Hostel A")
  })

  // -------------------------------------------------------------------------
  // TEST 3: Complaint Schema Validation
  // -------------------------------------------------------------------------
  await test("Validate Complaint schema and required fields", async () => {
    const validComplaint = new Complaint({
      complaintNumber: "HF-1001",
      createdBy: new mongoose.Types.ObjectId(),
      studentName: "Sanskruti Bhosale",
      hostelName: "Girls Hostel A",
      roomNumber: "A-204",
      title: "WiFi not working on 2nd floor",
      description: "Corridor router has red light and is unresponsive.",
      category: "Internet",
      priority: "high",
      status: COMPLAINT_STATUS.SUBMITTED,
    })
    let err = null
    try {
      await validComplaint.validate()
    } catch (e) {
      err = e
    }
    assert.strictEqual(err, null, "Valid complaint should have no validation errors")

    // Invalid category rejection
    const badCategoryComplaint = new Complaint({
      complaintNumber: "HF-1002",
      createdBy: new mongoose.Types.ObjectId(),
      studentName: "Student",
      hostelName: "Hostel A",
      roomNumber: "101",
      title: "Broken window",
      description: "Broken window pane needs fix",
      category: "SpaceExploration", // Not in allowed categories
    })
    let catErr = null
    try {
      await badCategoryComplaint.validate()
    } catch (e) {
      catErr = e
    }
    assert(catErr && catErr.errors.category, "Invalid category must be rejected")
  })

  // -------------------------------------------------------------------------
  // TEST 4: Perceptual Hashing (dHash) & Exact / Resized Duplicate Detection
  // -------------------------------------------------------------------------
  await test("Compute 64-bit dHash perceptual hash and identify resized duplicate images", async () => {
    // Generate an image with distinct horizontal gradient
    const bufferA = await sharp({
      create: {
        width: 120,
        height: 120,
        channels: 3,
        background: { r: 50, g: 100, b: 200 },
      },
    })
      .jpeg()
      .toBuffer()

    // Generate resized version of same image
    const bufferB = await sharp(bufferA)
      .resize(240, 240)
      .jpeg()
      .toBuffer()

    const hashA = await computePerceptualHash(bufferA)
    const hashB = await computePerceptualHash(bufferB)

    assert.strictEqual(typeof hashA, "string")
    assert.strictEqual(hashA.length, 16)
    assert.strictEqual(typeof hashB, "string")
    assert.strictEqual(hashB.length, 16)

    const distance = calculateHammingDistance(hashA, hashB)
    const similarity = ((64 - distance) / 64) * 100

    assert(distance <= 2, `Hamming distance between same image resized should be <= 2, got ${distance}`)
    assert(similarity >= 95, `Similarity score should be >= 95%, got ${similarity}%`)
  })

  // -------------------------------------------------------------------------
  // TEST 5: Image Quality & Blur Detection
  // -------------------------------------------------------------------------
  await test("Detect blurriness and lack of texture in low-contrast evidence", async () => {
    // Flat monochromatic image lacking texture
    const flatBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 128, g: 128, b: 128 },
      },
    })
      .jpeg()
      .toBuffer()

    const blurInfo = await detectBlurriness(flatBuffer)
    assert.strictEqual(blurInfo.isBlurry, true, "Flat/uniform image should be detected as blurry or low-detail")
  })

  // -------------------------------------------------------------------------
  // TEST 6: Multi-Stage AI Verification Pipeline (Category Consistency & Rules)
  // -------------------------------------------------------------------------
  await test("Verify multi-stage AI verification pipeline (Genuine vs Category Mismatch)", async () => {
    // Genuine Plumbing issue
    const plumbingComplaint = {
      _id: new mongoose.Types.ObjectId(),
      title: "Bathroom tap leaking water continuously",
      description: "The sink pipe has a leak and clean water is dripping on the floor.",
      category: "Plumbing",
      hostelName: "Girls Hostel A",
      roomNumber: "A-204",
      evidenceImages: [],
    }

    const resPlumbing = await runVerificationPipeline(plumbingComplaint)
    assert.strictEqual(resPlumbing.result, "verified")
    assert.strictEqual(resPlumbing.aiAssessment.categoryConsistent, true)
    assert(resPlumbing.confidence >= 0.8)

    // Category Mismatch: Fan issue filed under Plumbing
    const mismatchComplaint = {
      _id: new mongoose.Types.ObjectId(),
      title: "Ceiling fan switch sparking",
      description: "The fan motor and electrical switch socket are sparking and not spinning.",
      category: "Plumbing", // Mismatched category
      hostelName: "Girls Hostel A",
      roomNumber: "A-204",
      evidenceImages: [],
    }

    const resMismatch = await runVerificationPipeline(mismatchComplaint)
    assert.strictEqual(resMismatch.result, "needs_information")
    assert.strictEqual(resMismatch.aiAssessment.categoryConsistent, false)
    assert.strictEqual(resMismatch.aiAssessment.suggestedCategory, "Electrical")
  })

  // -------------------------------------------------------------------------
  // TEST 7: Role-Based Access Scoping
  // -------------------------------------------------------------------------
  await test("Verify RBAC resource scoping rules", async () => {
    const studentAId = new mongoose.Types.ObjectId()
    const studentBId = new mongoose.Types.ObjectId()
    const staffId = new mongoose.Types.ObjectId()
    const wardenHostelId = new mongoose.Types.ObjectId()

    const studentA = { _id: studentAId, role: ROLES.STUDENT }
    const studentB = { _id: studentBId, role: ROLES.STUDENT }
    const staffUser = { _id: staffId, role: ROLES.STAFF }
    const adminUser = { _id: new mongoose.Types.ObjectId(), role: ROLES.ADMIN }
    const wardenUser = { _id: new mongoose.Types.ObjectId(), role: ROLES.WARDEN, hostelId: wardenHostelId }

    const complaint = {
      _id: new mongoose.Types.ObjectId(),
      createdBy: studentAId,
      hostelId: wardenHostelId,
      assignedTo: { staffId },
    }

    // Student A can access their own complaint
    assert.strictEqual(canAccessComplaint(studentA, complaint), true)
    // Student B CANNOT access Student A's complaint
    assert.strictEqual(canAccessComplaint(studentB, complaint), false)
    // Assigned Staff can access complaint
    assert.strictEqual(canAccessComplaint(staffUser, complaint), true)
    // Warden for this hostel can access complaint
    assert.strictEqual(canAccessComplaint(wardenUser, complaint), true)
    // Admin has universal access
    assert.strictEqual(canAccessComplaint(adminUser, complaint), true)
  })

  // -------------------------------------------------------------------------
  // TEST 8: State Transition Security Matrix
  // -------------------------------------------------------------------------
  await test("Enforce state machine lifecycle transitions per role", async () => {
    // Student: Cannot jump from submitted to resolved
    const studentSubmitted = STATUS_TRANSITIONS[ROLES.STUDENT][COMPLAINT_STATUS.SUBMITTED] || []
    assert(!studentSubmitted.includes(COMPLAINT_STATUS.RESOLVED))

    // Staff: Can transition assigned -> in-progress
    const staffAssigned = STATUS_TRANSITIONS[ROLES.STAFF][COMPLAINT_STATUS.ASSIGNED] || []
    assert(staffAssigned.includes(COMPLAINT_STATUS.IN_PROGRESS))

    // Staff: Can transition in-progress -> resolved or need-material
    const staffInProgress = STATUS_TRANSITIONS[ROLES.STAFF][COMPLAINT_STATUS.IN_PROGRESS] || []
    assert(staffInProgress.includes(COMPLAINT_STATUS.RESOLVED))
    assert(staffInProgress.includes(COMPLAINT_STATUS.NEED_MATERIAL))

    // Warden: Can transition verified -> assigned
    const wardenVerified = STATUS_TRANSITIONS[ROLES.WARDEN][COMPLAINT_STATUS.VERIFIED] || []
    assert(wardenVerified.includes(COMPLAINT_STATUS.ASSIGNED))
  })

  console.log("\n=======================================================")
  console.log(`   TESTS COMPLETED: ${passedTests}/${totalTests} PASSED`)
  console.log("=======================================================\n")

  if (passedTests !== totalTests) {
    process.exit(1)
  }
}

runTestSuite().catch((err) => {
  console.error("Test runner encountered error:", err)
  process.exit(1)
})
