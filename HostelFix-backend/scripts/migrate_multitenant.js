const mongoose = require("mongoose")
const dotenv = require("dotenv")
const path = require("path")

dotenv.config({ path: path.join(__dirname, "../.env") })

const Organization = require("../models/Organization")
const Hostel = require("../models/Hostel")
const User = require("../models/User")
const Complaint = require("../models/Complaint")

async function migrateMultiTenant() {
  console.log("========================================================")
  console.log("   HOSTELFIX MULTI-TENANT SAFE MIGRATION")
  console.log("========================================================")

  if (!process.env.MONGODB_URI) {
    console.error("Missing MONGODB_URI in environment")
    process.exit(1)
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log("Connected to MongoDB Atlas successfully.")

    // 1. Ensure Premier (Primary) Organization exists
    let primaryOrg = await Organization.findOne({ slug: "hostelfix-premier" })
    if (!primaryOrg) {
      primaryOrg = await Organization.create({
        name: "HostelFix Premier Living",
        slug: "hostelfix-premier",
        invitationCode: "HF-PREMIER2026",
        contactEmail: "admin@hostelfix.com",
        phone: "+91 98765 43210",
        address: "Campus Road, Tech District",
        city: "Pune",
        state: "Maharashtra",
        status: "active",
        plan: "enterprise",
        settings: {
          allowStudentSelfRegistration: true,
          requireApprovalForStaff: false,
          requireApprovalForWardens: false,
        },
      })
      console.log(`Created primary organization: "${primaryOrg.name}" (${primaryOrg.slug}) - Code: ${primaryOrg.invitationCode}`)
    } else {
      console.log(`Primary organization exists: "${primaryOrg.name}" (${primaryOrg._id})`)
    }

    // 2. Ensure Demo Organization exists for demo accounts
    let demoOrg = await Organization.findOne({ slug: "demo-campus" })
    if (!demoOrg) {
      demoOrg = await Organization.create({
        name: "Demo Hostel Campus",
        slug: "demo-campus",
        invitationCode: "DEMO2026",
        contactEmail: "demo@hostelfix.com",
        phone: "+91 90000 00000",
        address: "Demo University Grounds",
        city: "Mumbai",
        state: "Maharashtra",
        status: "active",
        plan: "standard",
        settings: {
          allowStudentSelfRegistration: true,
          requireApprovalForStaff: false,
          requireApprovalForWardens: false,
        },
      })
      console.log(`Created demo organization: "${demoOrg.name}" (${demoOrg.slug}) - Code: ${demoOrg.invitationCode}`)
    } else {
      console.log(`Demo organization exists: "${demoOrg.name}" (${demoOrg._id})`)
    }

    // 3. Migrate Hostels (Properties)
    const hostels = await Hostel.find()
    let hostelsMigrated = 0
    for (const h of hostels) {
      if (!h.organizationId) {
        h.organizationId = primaryOrg._id
        await h.save()
        hostelsMigrated++
      }
    }
    console.log(`Hostels checked: ${hostels.length}, Migrated with organizationId: ${hostelsMigrated}`)

    // Ensure Demo Org has at least one building / hostel
    let demoHostel = await Hostel.findOne({ organizationId: demoOrg._id })
    if (!demoHostel) {
      demoHostel = await Hostel.create({
        organizationId: demoOrg._id,
        name: "Demo Campus Main Hostel",
        code: "DEMO-MAIN",
        address: "Demo Campus Drive",
        contactInformation: {
          wardenName: "Demo Warden",
          phone: "+91 90000 00001",
          email: "warden@hostelfix.com",
        },
        status: "active",
      })
      console.log(`Created demo hostel: ${demoHostel.name} (${demoHostel.code})`)
    }

    // 4. Migrate Users
    const users = await User.find()
    let usersMigrated = 0
    for (const u of users) {
      let needsSave = false

      // Assign organization
      if (!u.organizationId) {
        const targetOrg = u.isDemoAccount ? demoOrg : primaryOrg
        u.organizationId = targetOrg._id
        u.organizationName = targetOrg.name
        needsSave = true
      }

      // Ensure accountStatus is active
      if (!u.accountStatus || u.accountStatus === "pending") {
        u.accountStatus = "active"
        needsSave = true
      }

      // Populate authorizedHostels if hostelId exists
      if (u.hostelId && (!u.authorizedHostels || u.authorizedHostels.length === 0)) {
        u.authorizedHostels = [u.hostelId]
        needsSave = true
      }

      if (needsSave) {
        await u.save()
        usersMigrated++
      }
    }
    console.log(`Users checked: ${users.length}, Migrated with tenant affiliations: ${usersMigrated}`)

    // 5. Migrate Complaints
    const complaints = await Complaint.find()
    let complaintsMigrated = 0
    for (const c of complaints) {
      let needsSave = false

      // Associate with tenant
      if (!c.organizationId) {
        // Find creator user's organization if possible
        const creator = await User.findById(c.createdBy)
        const targetOrg = (creator && creator.organizationId) ? creator.organizationId : primaryOrg._id
        const targetOrgDoc = await Organization.findById(targetOrg)
        c.organizationId = targetOrg
        c.organizationName = targetOrgDoc ? targetOrgDoc.name : "HostelFix Premier Living"
        needsSave = true
      }

      // Ensure hostelId is linked
      if (!c.hostelId && c.hostelName) {
        const matchingHostel = await Hostel.findOne({
          name: { $regex: new RegExp(`^${c.hostelName.trim()}$`, "i") },
        })
        if (matchingHostel) {
          c.hostelId = matchingHostel._id
          needsSave = true
        } else if (hostels.length > 0) {
          c.hostelId = hostels[0]._id
          needsSave = true
        }
      }

      if (needsSave) {
        await c.save()
        complaintsMigrated++
      }
    }
    console.log(`Complaints checked: ${complaints.length}, Migrated with organization & hostel refs: ${complaintsMigrated}`)

    console.log("========================================================")
    console.log("   MULTI-TENANT MIGRATION COMPLETED SUCCESSFULLY")
    console.log("========================================================")
  } catch (error) {
    console.error("Migration error:", error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log("MongoDB connection closed.")
  }
}

migrateMultiTenant()
