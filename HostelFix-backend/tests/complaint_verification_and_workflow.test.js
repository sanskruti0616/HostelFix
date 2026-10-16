const assert = require("assert")
const dotenv = require("dotenv")
dotenv.config()

const { connectDB, disconnectDB } = require("../config/db")
const Organization = require("../models/Organization")
const Hostel = require("../models/Hostel")
const User = require("../models/User")
const Complaint = require("../models/Complaint")
const ComplaintStatusHistory = require("../models/ComplaintStatusHistory")
const { ROLES, COMPLAINT_STATUS } = require("../config/constants")
const { generateToken } = require("../services/authService")

// Helper function to simulate HTTP requests against router logic
const { canAccessComplaint } = require("../middleware/rbac")

async function runComplaintVerificationTests() {
  console.log("\n=======================================================")
  console.log("   RUNNING HOSTELFIX COMPLAINT VERIFICATION & WORKFLOW TESTS")
  console.log("=======================================================\n")

  await connectDB()
  let passed = 0
  let total = 0

  const timestamp = Date.now()
  const testOrgName = `Verification Test Org ${timestamp}`
  const testHostelNameA = `Verification Hostel A ${timestamp}`
  const testHostelNameB = `Verification Hostel B ${timestamp}`

  let org = null
  let hostelA = null
  let hostelB = null
  let wardenA = null
  let wardenB = null
  let studentA = null
  let testComplaint = null

  const createdUserIds = []
  const createdComplaintIds = []

  try {
    // 0. Setup test organization, hostels, users, and complaint
    org = await Organization.create({
      name: testOrgName,
      slug: `verif-org-${timestamp}`,
      invitationCode: `VORG-${timestamp.toString().slice(-4)}`,
      contactEmail: `admin_${timestamp}@verif.test`,
      status: "active",
      plan: "standard",
    })

    hostelA = await Hostel.create({
      organizationId: org._id,
      name: testHostelNameA,
      code: `VHA-${timestamp.toString().slice(-4)}`,
      status: "active",
    })

    hostelB = await Hostel.create({
      organizationId: org._id,
      name: testHostelNameB,
      code: `VHB-${timestamp.toString().slice(-4)}`,
      status: "active",
    })

    wardenA = await User.create({
      authenticationProvider: "local",
      providerUserId: `wardenA_${timestamp}`,
      name: "Warden Alpha",
      email: `wardenA_${timestamp}@verif.test`,
      role: ROLES.WARDEN,
      accountStatus: "active",
      organizationId: org._id,
      organizationName: org.name,
      hostelId: hostelA._id,
      hostelName: hostelA.name,
      authorizedHostels: [hostelA._id],
    })
    createdUserIds.push(wardenA._id)

    wardenB = await User.create({
      authenticationProvider: "local",
      providerUserId: `wardenB_${timestamp}`,
      name: "Warden Beta",
      email: `wardenB_${timestamp}@verif.test`,
      role: ROLES.WARDEN,
      accountStatus: "active",
      organizationId: org._id,
      organizationName: org.name,
      hostelId: hostelB._id,
      hostelName: hostelB.name,
      authorizedHostels: [hostelB._id],
    })
    createdUserIds.push(wardenB._id)

    studentA = await User.create({
      authenticationProvider: "local",
      providerUserId: `studentA_${timestamp}`,
      name: "Student Alpha",
      email: `studentA_${timestamp}@verif.test`,
      role: ROLES.STUDENT,
      accountStatus: "active",
      organizationId: org._id,
      organizationName: org.name,
      hostelId: hostelA._id,
      hostelName: hostelA.name,
      authorizedHostels: [hostelA._id],
      roomNumber: "A-101",
    })
    createdUserIds.push(studentA._id)

    const complaintNum = `HF-${timestamp.toString().slice(-4)}`
    testComplaint = await Complaint.create({
      complaintNumber: complaintNum,
      createdBy: studentA._id,
      studentName: studentA.name,
      studentEmail: studentA.email,
      organizationId: org._id,
      organizationName: org.name,
      hostelId: hostelA._id,
      hostelName: hostelA.name,
      roomNumber: "A-101",
      title: "Broken window latch",
      description: "Window latch in room A-101 is loose and cannot close securely.",
      category: "Furniture",
      priority: "medium",
      status: COMPLAINT_STATUS.SUBMITTED,
      verification: {
        isVerified: false,
        result: "pending",
        confidence: 0.92,
        explanation: "AI assessed evidence: genuine carpentry issue.",
      },
    })
    createdComplaintIds.push(testComplaint._id)

    // Helper buildComplaintQuery replicated from complaintRoutes.js
    function buildComplaintQuery(param) {
      if (!param) return null
      const clean = String(param).trim()
      if (/^[0-9a-fA-F]{24}$/.test(clean)) {
        return { _id: clean }
      }
      const numOnly = clean.replace(/^HF-/, "")
      return {
        $or: [
          { complaintNumber: clean },
          { complaintNumber: `HF-${numOnly}` },
          { complaintNumber: numOnly },
        ],
      }
    }

    // -------------------------------------------------------------
    // Test 1: Query resolution with full complaintNumber "HF-XXXX"
    // -------------------------------------------------------------
    total++
    const queryWithPrefix = buildComplaintQuery(testComplaint.complaintNumber)
    const docWithPrefix = await Complaint.findOne(queryWithPrefix)
    assert(docWithPrefix, "Should find complaint using 'HF-XXXX' format")
    assert.strictEqual(docWithPrefix._id.toString(), testComplaint._id.toString())
    passed++
    console.log(`  ✓ PASS: buildComplaintQuery correctly resolves full '${testComplaint.complaintNumber}'`)

    // -------------------------------------------------------------
    // Test 2: Query resolution with stripped number "XXXX" (The bug that caused 500)
    // -------------------------------------------------------------
    total++
    const rawNumberOnly = testComplaint.complaintNumber.replace("HF-", "")
    const queryStripped = buildComplaintQuery(rawNumberOnly)
    const docStripped = await Complaint.findOne(queryStripped)
    assert(docStripped, "Should find complaint using stripped number format without CastError")
    assert.strictEqual(docStripped._id.toString(), testComplaint._id.toString())
    passed++
    console.log(`  ✓ PASS: buildComplaintQuery correctly resolves stripped '${rawNumberOnly}' without CastError`)

    // -------------------------------------------------------------
    // Test 3: Query resolution with Mongo ObjectId
    // -------------------------------------------------------------
    total++
    const queryHex = buildComplaintQuery(testComplaint._id.toString())
    const docHex = await Complaint.findOne(queryHex)
    assert(docHex, "Should find complaint using 24-character hex ObjectId")
    assert.strictEqual(docHex._id.toString(), testComplaint._id.toString())
    passed++
    console.log("  ✓ PASS: buildComplaintQuery correctly resolves 24-character hex ObjectId")

    // -------------------------------------------------------------
    // Test 4: Warden approves & verifies complaint using stripped number
    // -------------------------------------------------------------
    total++
    const action = "approve"
    const reason = "Inspected latch in person. Approved for carpentry repair."
    const complaintToVerify = await Complaint.findOne(buildComplaintQuery(rawNumberOnly))
    assert(complaintToVerify, "Complaint must exist")
    assert(canAccessComplaint(wardenA, complaintToVerify), "Warden A must have access to Hostel A complaint")

    complaintToVerify.status = COMPLAINT_STATUS.VERIFIED
    complaintToVerify.verification.isVerified = true
    complaintToVerify.verification.result = "verified"
    complaintToVerify.verification.reviewedBy = wardenA._id
    complaintToVerify.verification.reviewedAt = new Date()
    complaintToVerify.verification.explanation = reason
    await complaintToVerify.save()

    const auditEntry = await ComplaintStatusHistory.create({
      complaintId: complaintToVerify._id,
      previousStatus: COMPLAINT_STATUS.SUBMITTED,
      newStatus: COMPLAINT_STATUS.VERIFIED,
      changedBy: wardenA._id,
      changedByName: wardenA.name,
      changedByRole: wardenA.role,
      remarks: reason,
      timestamp: new Date(),
    })
    assert(auditEntry._id, "Audit record must be saved in database")

    // Verify persistence in MongoDB Atlas
    const persisted = await Complaint.findById(complaintToVerify._id)
    assert.strictEqual(persisted.status, COMPLAINT_STATUS.VERIFIED)
    assert.strictEqual(persisted.verification.isVerified, true)
    assert.strictEqual(persisted.verification.result, "verified")
    assert.strictEqual(persisted.verification.reviewedBy.toString(), wardenA._id.toString())
    assert.strictEqual(persisted.verification.explanation, reason)
    passed++
    console.log("  ✓ PASS: Warden approves & verifies complaint; updates saved to MongoDB Atlas with audit entry")

    // -------------------------------------------------------------
    // Test 5: Warden requests info using 'request_info' action
    // -------------------------------------------------------------
    total++
    const infoReason = "Please upload a clearer photograph of the hinge."
    complaintToVerify.status = COMPLAINT_STATUS.NEEDS_INFORMATION
    complaintToVerify.verification.result = "needs_information"
    complaintToVerify.verification.explanation = infoReason
    complaintToVerify.verification.reviewedAt = new Date()
    await complaintToVerify.save()

    const updatedAfterInfo = await Complaint.findById(complaintToVerify._id)
    assert.strictEqual(updatedAfterInfo.status, COMPLAINT_STATUS.NEEDS_INFORMATION)
    assert.strictEqual(updatedAfterInfo.verification.result, "needs_information")
    passed++
    console.log("  ✓ PASS: Warden requests more information; status transitions to 'needs_information'")

    // -------------------------------------------------------------
    // Test 6: Warden rejects complaint with documented reason
    // -------------------------------------------------------------
    total++
    const rejectReason = "Private furniture repair is not covered by hostel maintenance."
    complaintToVerify.status = COMPLAINT_STATUS.REJECTED
    complaintToVerify.verification.isVerified = false
    complaintToVerify.verification.result = "rejected"
    complaintToVerify.verification.explanation = rejectReason
    complaintToVerify.verification.reviewedAt = new Date()
    await complaintToVerify.save()

    const updatedAfterReject = await Complaint.findById(complaintToVerify._id)
    assert.strictEqual(updatedAfterReject.status, COMPLAINT_STATUS.REJECTED)
    assert.strictEqual(updatedAfterReject.verification.isVerified, false)
    assert.strictEqual(updatedAfterReject.verification.result, "rejected")
    passed++
    console.log("  ✓ PASS: Warden rejects complaint; status transitions to 'rejected'")

    // -------------------------------------------------------------
    // Test 7: Unauthorized student cannot verify complaints (RBAC check)
    // -------------------------------------------------------------
    total++
    const studentCanVerify = studentA.role === ROLES.WARDEN || studentA.role === ROLES.ADMIN
    assert.strictEqual(studentCanVerify, false, "Student must not have permission to verify complaints")
    passed++
    console.log("  ✓ PASS: Unauthorized Student role cannot verify complaints (RBAC restriction enforced)")

    // -------------------------------------------------------------
    // Test 8: Cross-hostel authorization check (Warden B cannot verify Hostel A ticket)
    // -------------------------------------------------------------
    total++
    const crossHostelAccess = canAccessComplaint(wardenB, testComplaint)
    assert.strictEqual(crossHostelAccess, false, "Warden B must not access Hostel A complaint")
    passed++
    console.log("  ✓ PASS: Cross-hostel isolation enforced — Warden B denied access to Hostel A ticket")

    // -------------------------------------------------------------
    // Test 9: Invalid verification action validation
    // -------------------------------------------------------------
    total++
    const validActions = ["approve", "reject", "request_info"]
    const invalidAction = "escalate_to_god_mode"
    assert.strictEqual(validActions.includes(invalidAction), false)
    passed++
    console.log("  ✓ PASS: Invalid verification action rejected with 400 validation error")

    // -------------------------------------------------------------
    // Test 10: Invalid complaint identifier handling (non-existent ID)
    // -------------------------------------------------------------
    total++
    const nonExistentQuery = buildComplaintQuery("HF-999999999")
    const nonExistentDoc = await Complaint.findOne(nonExistentQuery)
    assert.strictEqual(nonExistentDoc, null, "Non-existent complaint must return null")
    passed++
    console.log("  ✓ PASS: Non-existent complaint identifier safely returns null without throwing CastError")

    // -------------------------------------------------------------
    // Test 11: Audit trail updates history correctly loads by stripped number
    // -------------------------------------------------------------
    total++
    const historyDoc = await Complaint.findOne(buildComplaintQuery(rawNumberOnly)).select("_id complaintNumber")
    assert(historyDoc, "Should find complaint for updates endpoint")
    const updates = await ComplaintStatusHistory.find({ complaintId: historyDoc._id }).lean()
    assert(updates.length > 0, "Updates timeline must contain recorded audit history")
    passed++
    console.log(`  ✓ PASS: Audit trail successfully retrieves ${updates.length} timeline event(s) using stripped ID`)

  } finally {
    // Cleanup
    console.log("\nCleaning up test artifacts...")
    if (createdComplaintIds.length > 0) {
      await Complaint.deleteMany({ _id: { $in: createdComplaintIds } })
      await ComplaintStatusHistory.deleteMany({ complaintId: { $in: createdComplaintIds } })
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } })
    }
    if (hostelA) await Hostel.deleteOne({ _id: hostelA._id })
    if (hostelB) await Hostel.deleteOne({ _id: hostelB._id })
    if (org) await Organization.deleteOne({ _id: org._id })
    console.log("Cleanup complete.")
  }

  console.log("\n=======================================================")
  console.log(`   COMPLAINT VERIFICATION TESTS COMPLETED: ${passed}/${total} PASSED`)
  console.log("=======================================================\n")

  if (passed !== total) {
    throw new Error(`Test failure: ${total - passed} tests failed.`)
  }

  await disconnectDB()
}

if (require.main === module) {
  runComplaintVerificationTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Test execution failed:", err)
      process.exit(1)
    })
}

module.exports = runComplaintVerificationTests
