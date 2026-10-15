const { connectDB, disconnectDB } = require("../config/db")
const User = require("../models/User")
const Hostel = require("../models/Hostel")
const Room = require("../models/Room")
const Complaint = require("../models/Complaint")
const ComplaintStatusHistory = require("../models/ComplaintStatusHistory")
const { ROLES, COMPLAINT_STATUS } = require("../config/constants")
require("../config/loadEnv")

async function seed() {
  console.log("[Seed] Starting development database seed...")
  await connectDB()

  // 1. Seed Hostels
  const hostelsData = [
    {
      name: "Girls Hostel A",
      code: "GHA",
      address: "North Campus, Sector 4",
      contactInformation: { wardenName: "Priya Sharma", phone: "9876543201", email: "warden@hostelfix.com" },
    },
    {
      name: "Boys Hostel B",
      code: "BHB",
      address: "South Campus, Sector 9",
      contactInformation: { wardenName: "Rajesh Kumar", phone: "9876543202", email: "rajesh@hostelfix.com" },
    },
  ]

  const hostels = []
  for (const hData of hostelsData) {
    const hostel = await Hostel.findOneAndUpdate(
      { code: hData.code },
      hData,
      { upsert: true, new: true }
    )
    hostels.push(hostel)
  }
  console.log(`[Seed] Hostels verified: ${hostels.length}`)

  // 2. Seed Rooms
  const primaryHostel = hostels[0]
  const roomsData = [
    { roomNumber: "A-204", building: "Block A", floor: 2 },
    { roomNumber: "A-101", building: "Block A", floor: 1 },
    { roomNumber: "A-205", building: "Block A", floor: 2 },
    { roomNumber: "A-301", building: "Block A", floor: 3 },
  ]

  for (const rData of roomsData) {
    await Room.findOneAndUpdate(
      { hostelId: primaryHostel._id, roomNumber: rData.roomNumber },
      { ...rData, hostelId: primaryHostel._id },
      { upsert: true }
    )
  }
  console.log(`[Seed] Rooms verified`)

  // 3. Seed Users with secure bcrypt password hashing
  const bcrypt = require("bcryptjs")
  const defaultHash = await bcrypt.hash("HostelFix@2026", 10)

  const usersData = [
    {
      providerUserId: "local_student_001",
      name: "Sanskruti Bhosale",
      email: "sanskruti@hostelfix.com",
      username: "student",
      role: ROLES.STUDENT,
      hostelId: primaryHostel._id,
      hostelName: primaryHostel.name,
      roomNumber: "A-204",
      phone: "9876543210",
      accountStatus: "active",
      authenticationProvider: "local",
      isDemoAccount: true,
      passwordHash: defaultHash,
    },
    {
      providerUserId: "local_warden_001",
      name: "Priya Sharma",
      email: "warden@hostelfix.com",
      username: "warden",
      role: ROLES.WARDEN,
      hostelId: primaryHostel._id,
      hostelName: primaryHostel.name,
      phone: "9876543201",
      accountStatus: "active",
      authenticationProvider: "local",
      isDemoAccount: true,
      passwordHash: defaultHash,
    },
    {
      providerUserId: "local_staff_001",
      name: "Vaishnavi Bhoiwade",
      email: "vaishnavi@hostelfix.com",
      username: "staff",
      role: ROLES.STAFF,
      phone: "9876543211",
      accountStatus: "active",
      authenticationProvider: "local",
      isDemoAccount: true,
      passwordHash: defaultHash,
    },
    {
      providerUserId: "local_staff_002",
      name: "Bhargavi Borkhade",
      email: "bhargavi@hostelfix.com",
      username: "bhargavi",
      role: ROLES.STAFF,
      phone: "9876543212",
      accountStatus: "active",
      authenticationProvider: "local",
      isDemoAccount: true,
      passwordHash: defaultHash,
    },
    {
      providerUserId: "local_staff_003",
      name: "Bhavesh Bhut",
      email: "bhavesh@hostelfix.com",
      username: "bhavesh",
      role: ROLES.STAFF,
      phone: "9876543213",
      accountStatus: "active",
      authenticationProvider: "local",
      isDemoAccount: true,
      passwordHash: defaultHash,
    },
    {
      providerUserId: "local_staff_004",
      name: "Ruturaj Bhome",
      email: "ruturaj@hostelfix.com",
      username: "ruturaj",
      role: ROLES.STAFF,
      phone: "9876543214",
      accountStatus: "active",
      authenticationProvider: "local",
      isDemoAccount: true,
      passwordHash: defaultHash,
    },
    {
      providerUserId: "local_admin_001",
      name: "HostelFix Admin",
      email: "admin@hostelfix.com",
      username: "admin",
      role: ROLES.ADMIN,
      phone: "9876543200",
      accountStatus: "active",
      authenticationProvider: "local",
      isDemoAccount: true,
      passwordHash: defaultHash,
    },
  ]

  const seededUsers = {}
  for (const uData of usersData) {
    const user = await User.findOneAndUpdate(
      { email: uData.email },
      { $set: uData },
      { upsert: true, new: true }
    )
    seededUsers[uData.email] = user
  }
  console.log(`[Seed] Seed users verified: ${Object.keys(seededUsers).length}`)

  // 4. Seed initial realistic complaints if collection is empty
  const complaintCount = await Complaint.countDocuments()
  if (complaintCount === 0) {
    console.log("[Seed] Populating initial realistic complaints...")

    const studentUser = seededUsers["sanskruti@hostelfix.com"]
    const staff1 = seededUsers["vaishnavi@hostelfix.com"]
    const staff2 = seededUsers["bhargavi@hostelfix.com"]

    const initialComplaints = [
      {
        complaintNumber: "HF-1001",
        createdBy: studentUser._id,
        studentName: studentUser.name,
        studentEmail: studentUser.email,
        hostelId: primaryHostel._id,
        hostelName: primaryHostel.name,
        roomNumber: "A-204",
        title: "WiFi router not responding",
        description: "The WiFi router on our corridor stopped working yesterday evening. Student portal inaccessible.",
        category: "Internet",
        priority: "high",
        status: COMPLAINT_STATUS.IN_PROGRESS,
        assignedTo: { staffId: staff1._id, staffName: staff1.name, assignedAt: new Date() },
        verification: { isVerified: true, verificationType: "ai_assisted", result: "verified", confidence: 0.92, explanation: "Category and description verified." },
      },
      {
        complaintNumber: "HF-1002",
        createdBy: studentUser._id,
        studentName: studentUser.name,
        studentEmail: studentUser.email,
        hostelId: primaryHostel._id,
        hostelName: primaryHostel.name,
        roomNumber: "A-204",
        title: "Bathroom tap continuously dripping",
        description: "The sink tap in room A-204 cannot be closed completely and is leaking clean water.",
        category: "Plumbing",
        priority: "medium",
        status: COMPLAINT_STATUS.ASSIGNED,
        assignedTo: { staffId: staff2._id, staffName: staff2.name, assignedAt: new Date() },
        verification: { isVerified: true, verificationType: "ai_assisted", result: "verified", confidence: 0.95, explanation: "Standard plumbing maintenance request." },
      },
      {
        complaintNumber: "HF-1003",
        createdBy: studentUser._id,
        studentName: studentUser.name,
        studentEmail: studentUser.email,
        hostelId: primaryHostel._id,
        hostelName: primaryHostel.name,
        roomNumber: "A-204",
        title: "Ceiling fan making clicking noise",
        description: "The ceiling fan makes an irregular clicking noise at speed 3 and above.",
        category: "Electrical",
        priority: "medium",
        status: COMPLAINT_STATUS.SUBMITTED,
        verification: { isVerified: false, verificationType: "ai_assisted", result: "pending", confidence: 0.88, explanation: "Awaiting warden review." },
      },
    ]

    for (const cData of initialComplaints) {
      const c = await Complaint.create(cData)
      await ComplaintStatusHistory.create({
        complaintId: c._id,
        previousStatus: null,
        newStatus: c.status,
        changedBy: studentUser._id,
        changedByName: studentUser.name,
        changedByRole: studentUser.role,
        remarks: "Seeded initial complaint.",
        timestamp: new Date(),
      })
    }
    console.log(`[Seed] Seeded ${initialComplaints.length} initial complaints.`)
  }

  console.log("[Seed] Database seed completed successfully!")
  await disconnectDB()
}

seed().catch((err) => {
  console.error("[Seed] Seed failed with error:", err)
  process.exit(1)
})
