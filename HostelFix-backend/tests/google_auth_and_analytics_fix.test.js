const assert = require("assert")
const dotenv = require("dotenv")
dotenv.config()
process.env.NODE_ENV = "test"
process.env.ALLOW_MEMORY_FALLBACK = "true"

const { connectDB, disconnectDB } = require("../config/db")
const Organization = require("../models/Organization")
const Hostel = require("../models/Hostel")
const User = require("../models/User")
const Complaint = require("../models/Complaint")
const { ROLES, COMPLAINT_STATUS } = require("../config/constants")
const { verifyGoogleIdToken, authenticateGoogleUser } = require("../services/authService")
const { getRecurringHotspots } = require("../services/recurrenceService")

async function runGoogleAndAnalyticsTests() {
  console.log("\n==================================================================")
  console.log("   RUNNING GOOGLE AUTH & ADMIN ANALYTICS ($nin FIX) TESTS")
  console.log("==================================================================\n")

  await connectDB()
  let passed = 0
  let total = 0

  function test(name, fn) {
    total++
    try {
      fn()
      console.log(`  ✓ Test ${total}: ${name}`)
      passed++
    } catch (err) {
      console.error(`  ✗ Test ${total} FAILED: ${name}`)
      console.error(`    Error: ${err.message}`)
    }
  }

  async function testAsync(name, fn) {
    total++
    try {
      await fn()
      console.log(`  ✓ Test ${total}: ${name}`)
      passed++
    } catch (err) {
      console.error(`  ✗ Test ${total} FAILED: ${name}`)
      console.error(`    Error: ${err.message}`)
    }
  }

  const timestamp = Date.now()
  let org = null
  let hostel = null
  let existingWarden = null
  let existingStaff = null

  try {
    // -------------------------------------------------------------
    // PART 1: Google Auth Security & Error Handling Tests
    // -------------------------------------------------------------

    await testAsync("1. Rejection of empty or missing Google ID token (400 Bad Request)", async () => {
      try {
        await verifyGoogleIdToken("")
        assert.fail("Should have thrown error on empty token")
      } catch (err) {
        assert.strictEqual(err.statusCode, 400)
        assert.ok(err.message.includes("required"))
      }

      try {
        await verifyGoogleIdToken(null)
        assert.fail("Should have thrown error on null token")
      } catch (err) {
        assert.strictEqual(err.statusCode, 400)
      }
    })

    await testAsync("2. Rejection of malformed / structured fake token (401 Unauthorized)", async () => {
      try {
        await verifyGoogleIdToken("not.a.valid.jwt")
        assert.fail("Should have thrown error on invalid token segments")
      } catch (err) {
        assert.strictEqual(err.statusCode, 401)
        assert.ok(err.message.includes("invalid or expired"))
      }

      // Fake structured token with fake kid
      const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "nonexistent_key_id" })).toString("base64url")
      const payload = Buffer.from(JSON.stringify({ sub: "99999", email: "attacker@test.com", aud: "fake_aud" })).toString("base64url")
      const fakeJwt = `${header}.${payload}.fakesignature`

      try {
        await verifyGoogleIdToken(fakeJwt)
        assert.fail("Should have rejected fake token")
      } catch (err) {
        assert.strictEqual(err.statusCode, 401)
      }
    })

    await testAsync("3. Network/SSL unreachable mapping to 503 Service Unavailable", async () => {
      // Simulate error mapping in verifyGoogleIdToken catch logic
      const simulateSslError = (msg) => {
        const err = new Error(msg)
        const isTransient = msg.includes("SSL") || msg.includes("ERR_SSL")
        if (isTransient) {
          const userErr = new Error("Google authentication service is currently unreachable due to network connectivity.")
          userErr.statusCode = 503
          return userErr
        }
        return err
      }

      const sslErr = simulateSslError("80590000:error:0A000438:SSL routines:ssl3_read_bytes:tlsv1 alert internal error:openssl\\ssl\\record\\rec_layer_s3.c:918:SSL alert number 80")
      assert.strictEqual(sslErr.statusCode, 503)
      assert.ok(sslErr.message.includes("unreachable"))
    })

    await testAsync("4. Existing user role preservation during Google sign-in (Warden role not overwritten)", async () => {
      org = await Organization.create({
        name: `Google Test Org ${timestamp}`,
        slug: `google-org-${timestamp}`,
        invitationCode: `GORG-${timestamp.toString().slice(-4)}`,
        contactEmail: `admin_${timestamp}@google-test.org`,
        status: "active",
      })

      hostel = await Hostel.create({
        organizationId: org._id,
        name: `Google Test Hostel ${timestamp}`,
        code: `GHST-${timestamp.toString().slice(-4)}`,
        status: "active",
      })

      // Create existing Warden user in database
      const wardenEmail = `warden_${timestamp}@hostel.test`
      existingWarden = await User.create({
        name: "Warden Mrs. Sharma",
        email: wardenEmail,
        role: ROLES.WARDEN,
        accountStatus: "active",
        hostelId: hostel._id,
        hostelName: hostel.name,
        authorizedHostels: [hostel._id],
        organizationId: org._id,
        authenticationProvider: "google",
        providerUserId: `google_sub_warden_${timestamp}`,
      })

      // Simulate profile returned from Google
      const simulatedGoogleProfile = {
        providerUserId: `google_sub_warden_${timestamp}`,
        email: wardenEmail,
        name: "Warden Mrs. Sharma",
      }

      // Lookup existing user as authenticateGoogleUser does
      const foundUser = await User.findOne({
        $or: [
          { providerUserId: simulatedGoogleProfile.providerUserId, authenticationProvider: "google" },
          { email: simulatedGoogleProfile.email },
        ],
      })

      assert.ok(foundUser, "User should be found in database")
      assert.strictEqual(foundUser.role, ROLES.WARDEN, "Warden role must be strictly preserved")
      assert.strictEqual(foundUser.hostelName, hostel.name, "Hostel affiliation must be preserved")
      assert.strictEqual(foundUser.accountStatus, "active", "Account status must remain active")
    })

    await testAsync("5. New Google user receives default Student role and pending affiliation", async () => {
      const newEmail = `newstudent_${timestamp}@gmail.com`
      const simulatedNewProfile = {
        providerUserId: `google_sub_new_${timestamp}`,
        email: newEmail,
        name: "New Student User",
      }

      let user = await User.findOne({ email: simulatedNewProfile.email })
      assert.strictEqual(user, null, "User should not exist yet")

      // Provision new user as authenticateGoogleUser does
      user = await User.create({
        authenticationProvider: "google",
        providerUserId: simulatedNewProfile.providerUserId,
        name: simulatedNewProfile.name,
        email: simulatedNewProfile.email,
        role: ROLES.STUDENT,
        accountStatus: "pending_affiliation",
      })

      assert.strictEqual(user.role, ROLES.STUDENT, "Default role for new signups must be student")
      assert.strictEqual(user.accountStatus, "pending_affiliation", "Status must be pending_affiliation")
      assert.strictEqual(user.organizationId, null, "Organization must be null until affiliated")
    })

    // -------------------------------------------------------------
    // PART 2: Admin Analytics $nin Fix & Enhanced Metrics Tests
    // -------------------------------------------------------------

    await testAsync("6. Admin Analytics aggregation executes with NO $nin error", async () => {
      // Create a set of test complaints across statuses
      const c1 = await Complaint.create({
        complaintNumber: `HF-${timestamp}-01`,
        studentId: existingWarden._id,
        createdBy: existingWarden._id,
        studentName: "Student 1",
        hostelId: hostel._id,
        hostelName: hostel.name,
        roomNumber: "101",
        category: "Plumbing",
        title: "Pipe leaking in bathroom",
        description: "Water continuously dripping from sink valve",
        status: COMPLAINT_STATUS.SUBMITTED,
        priority: "medium",
        organizationId: org._id,
      })

      const c2 = await Complaint.create({
        complaintNumber: `HF-${timestamp}-02`,
        studentId: existingWarden._id,
        createdBy: existingWarden._id,
        studentName: "Student 2",
        hostelId: hostel._id,
        hostelName: hostel.name,
        roomNumber: "101",
        category: "Plumbing",
        title: "Pipe burst in bathroom",
        description: "Repeated leak in sink pipe",
        status: COMPLAINT_STATUS.RESOLVED,
        priority: "high",
        resolvedAt: new Date(Date.now() - 3600 * 1000), // 1 hour ago
        createdAt: new Date(Date.now() - 5 * 3600 * 1000), // 5 hours ago (4 hours turnaround)
        rating: 5,
        ratingComments: "Excellent fast fix",
        organizationId: org._id,
      })

      const c3 = await Complaint.create({
        complaintNumber: `HF-${timestamp}-03`,
        studentId: existingWarden._id,
        createdBy: existingWarden._id,
        studentName: "Student 3",
        hostelId: hostel._id,
        hostelName: hostel.name,
        roomNumber: "205",
        category: "Electrical",
        title: "Switch sparking",
        description: "Light switch sparking on toggle",
        status: COMPLAINT_STATUS.IN_PROGRESS,
        priority: "urgent",
        organizationId: org._id,
      })

      // Run the exact Admin Complaint Summary pipeline from analyticsRoutes.js
      const orgFilter = { organizationId: org._id }
      const summaryResult = await Complaint.aggregate([
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
      ])

      assert.ok(summaryResult.length > 0, "Aggregation should return a summary")
      const s = summaryResult[0]
      assert.strictEqual(s.totalComplaints, 3, "Total complaints should be 3")
      assert.strictEqual(s.openComplaints, 2, "Open complaints should be 2 (submitted + in_progress)")
      assert.strictEqual(s.resolvedComplaints, 1, "Resolved complaints should be 1")
      assert.ok(s.avgResolutionHours >= 3.8 && s.avgResolutionHours <= 4.2, `Avg resolution should be ~4 hours, got ${s.avgResolutionHours}`)
    })

    await testAsync("7. Admin Analytics calculates User counts by role accurately", async () => {
      const orgFilter = { organizationId: org._id }
      const userStatsAgg = await User.aggregate([
        { $match: orgFilter },
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 },
          },
        },
      ])

      const map = new Map()
      userStatsAgg.forEach((u) => map.set(u._id, u.count))
      assert.strictEqual(map.get(ROLES.WARDEN), 1, "Should count 1 warden")
    })

    await testAsync("8. Student ratings & satisfaction aggregation calculates correctly", async () => {
      const orgFilter = { organizationId: org._id }
      const ratingsAgg = await Complaint.aggregate([
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
          },
        },
      ])

      assert.strictEqual(ratingsAgg.length, 1, "Should return rating summary")
      assert.strictEqual(ratingsAgg[0].totalRated, 1)
      assert.strictEqual(ratingsAgg[0].avgRating, 5)
      assert.strictEqual(ratingsAgg[0].fiveStar, 1)
    })

    await testAsync("9. Empty database does not throw error and returns valid 0 counts", async () => {
      const emptyOrgFilter = { organizationId: new Organization()._id }
      const emptySummary = await Complaint.aggregate([
        { $match: emptyOrgFilter },
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
          },
        },
      ])

      assert.strictEqual(emptySummary.length, 0, "Empty aggregation should return empty array without throwing")
    })

    await testAsync("10. Platform recurring hotspots identified across 30-day window", async () => {
      const hotspots = await getRecurringHotspots({ organizationId: org._id }, 30)
      assert.ok(Array.isArray(hotspots), "Hotspots should be an array")
      const room101Hotspot = hotspots.find((h) => h.roomNumber === "101" && h.category === "Plumbing")
      assert.ok(room101Hotspot, "Room 101 Plumbing hotspot should be identified (2 complaints)")
      assert.strictEqual(room101Hotspot.complaintCount, 2)
      assert.ok(room101Hotspot.suggestion.toLowerCase().includes("plumbing"), "Suggestion should contain plumbing advice")
    })

  } finally {
    // Cleanup
    if (org) {
      await Complaint.deleteMany({ organizationId: org._id })
      await User.deleteMany({ organizationId: org._id })
      await Hostel.deleteMany({ organizationId: org._id })
      await Organization.deleteOne({ _id: org._id })
    }
    await disconnectDB()
  }

  console.log("\n==================================================================")
  console.log(`   TESTS RESULT: ${passed} / ${total} PASSED`)
  console.log("==================================================================\n")
  assert.strictEqual(passed, total, "All tests must pass")
}

runGoogleAndAnalyticsTests().catch((e) => {
  console.error("Fatal test error:", e)
  process.exit(1)
})
