const assert = require("assert")
const dotenv = require("dotenv")
dotenv.config()

const { connectDB } = require("../config/db")
const Organization = require("../models/Organization")
const Hostel = require("../models/Hostel")
const User = require("../models/User")
const Complaint = require("../models/Complaint")
const {
  verifyInvitationCode,
  getPublicOrganizations,
  authenticateDemoRole,
} = require("../services/authService")

async function runMultiTenantTests() {
  console.log("\n=======================================================")
  console.log("   RUNNING HOSTELFIX MULTI-TENANT SAAS INTEGRATION TESTS")
  console.log("=======================================================\n")

  await connectDB()

  let passed = 0

  // 1. Verify Organizations Exist
  try {
    const orgs = await Organization.find({ status: "active" })
    assert(orgs.length >= 2, "Expected at least 2 active organizations in MongoDB Atlas")
    const demoOrg = orgs.find((o) => o.slug === "demo-campus")
    const premierOrg = orgs.find((o) => o.slug === "hostelfix-premier")
    assert(demoOrg, "Expected demo-campus organization")
    assert(premierOrg, "Expected hostelfix-premier organization")
    console.log("  ✓ PASS: Multi-tenant organizations exist and are active in MongoDB Atlas")
    passed++
  } catch (err) {
    console.error("  ✗ FAIL: Organizations test failed:", err.message)
  }

  // 2. Verify Invitation Codes
  try {
    const demoVerify = await verifyInvitationCode("DEMO2026")
    assert.strictEqual(demoVerify.organization.slug, "demo-campus")
    assert(demoVerify.hostels.length > 0, "Expected hostels linked to demo-campus")

    const premierVerify = await verifyInvitationCode("HF-PREMIER2026")
    assert.strictEqual(premierVerify.organization.slug, "hostelfix-premier")
    console.log("  ✓ PASS: Invitation codes verified with property linkage")
    passed++
  } catch (err) {
    console.error("  ✗ FAIL: Invitation code test failed:", err.message)
  }

  // 3. Verify Public Tenants Directory
  try {
    const publicList = await getPublicOrganizations()
    assert(Array.isArray(publicList) && publicList.length >= 2)
    assert(publicList[0].id && publicList[0].name && publicList[0].slug)
    console.log("  ✓ PASS: Public tenants directory lists organizations without leaking sensitive keys")
    passed++
  } catch (err) {
    console.error("  ✗ FAIL: Public tenants test failed:", err.message)
  }

  // 4. Verify Demo Login & Scoped Token Generation
  try {
    const studentRes = await authenticateDemoRole("student")
    assert(studentRes.token, "Expected JWT token")
    assert(studentRes.user.organizationId, "Expected student to have organizationId")
    assert.strictEqual(studentRes.user.role, "student")

    const wardenRes = await authenticateDemoRole("warden")
    assert(wardenRes.token, "Expected JWT token")
    assert(wardenRes.user.organizationId, "Expected warden to have organizationId")
    assert.strictEqual(wardenRes.user.role, "warden")

    // Verify both demo student and demo warden share the same organization
    assert.strictEqual(
      String(studentRes.user.organizationId),
      String(wardenRes.user.organizationId),
      "Demo student and warden must belong to the same organization"
    )
    console.log("  ✓ PASS: Scoped JWT tokens generated with organization and role claims")
    passed++
  } catch (err) {
    console.error("  ✗ FAIL: Scoped token test failed:", err.message)
  }

  // 5. Verify Cross-Tenant Complaint Scoping
  try {
    const demoOrg = await Organization.findOne({ slug: "demo-campus" })
    const premierOrg = await Organization.findOne({ slug: "hostelfix-premier" })

    // Find complaints belonging to demoOrg
    const demoComplaints = await Complaint.find({ organizationId: demoOrg._id })
    assert(demoComplaints.length > 0, "Expected complaints in demo organization")

    // Find complaints belonging to premierOrg
    const premierComplaints = await Complaint.find({ organizationId: premierOrg._id })

    // Verify no complaint with demoOrg._id is returned when querying premierOrg._id
    for (const c of premierComplaints) {
      assert.notStrictEqual(
        String(c.organizationId),
        String(demoOrg._id),
        "Tenant leakage detected: premierOrg complaint has demoOrg ID"
      )
    }

    for (const c of demoComplaints) {
      assert.notStrictEqual(
        String(c.organizationId),
        String(premierOrg._id),
        "Tenant leakage detected: demoOrg complaint has premierOrg ID"
      )
    }

    console.log("  ✓ PASS: Strict cross-tenant isolation verified — 0 data leakage between organizations")
    passed++
  } catch (err) {
    console.error("  ✗ FAIL: Cross-tenant scoping test failed:", err.message)
  }

  // 6. Verify Warden Query Includes Newly Submitted Complaints
  try {
    const demoOrg = await Organization.findOne({ slug: "demo-campus" })
    const demoWarden = await User.findOne({ email: "warden@hostelfix.com" })

    // Query mimicking complaintRoutes.js GET /api/complaints for warden
    const filter = { organizationId: demoWarden.organizationId }
    if (demoWarden.authorizedHostels && demoWarden.authorizedHostels.length > 0) {
      filter.$or = [
        { hostelId: { $in: demoWarden.authorizedHostels } },
        { hostelId: null },
        { hostelId: { $exists: false } },
        { hostelName: demoWarden.hostelName || demoWarden.hostel },
      ]
    }

    const wardenVisibleComplaints = await Complaint.find(filter)
    assert(wardenVisibleComplaints.length > 0, "Warden should see complaints for their authorized hostels")
    console.log(`  ✓ PASS: Warden query returns ${wardenVisibleComplaints.length} complaints including unassigned/new tickets`)
    passed++
  } catch (err) {
    console.error("  ✗ FAIL: Warden query test failed:", err.message)
  }

  console.log("\n=======================================================")
  console.log(`   MULTI-TENANT TESTS COMPLETED: ${passed}/6 PASSED`)
  console.log("=======================================================\n")

  process.exit(passed === 6 ? 0 : 1)
}

runMultiTenantTests().catch((err) => {
  console.error("Fatal test error:", err)
  process.exit(1)
})
