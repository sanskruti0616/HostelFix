const express = require("express")
const router = express.Router()
const Hostel = require("../models/Hostel")
const Room = require("../models/Room")
const { authenticate } = require("../middleware/auth")
const { authorizeRoles } = require("../middleware/rbac")
const { ROLES } = require("../config/constants")

/**
 * @route   GET /api/hostels/public
 * @desc    Get all active registered hostels for student registration dropdown
 * @access  Public
 */
router.get("/hostels/public", async (req, res) => {
  try {
    const hostels = await Hostel.find({ status: "active" }).sort({ name: 1 }).lean()
    res.json({
      success: true,
      count: hostels.length,
      hostels: hostels.map((h) => ({
        id: h._id,
        name: h.name,
        code: h.code,
        address: h.address,
        organizationId: h.organizationId,
        contactInformation: h.contactInformation,
      })),
    })
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load hostels: " + error.message })
  }
})

/**
 * @route   GET /api/hostels
 * @desc    Get all active hostels
 * @access  Private
 */
router.get("/hostels", authenticate, async (req, res) => {
  try {
    const filter = { status: "active" }
    // If not platform admin and organizationId exists, scope to organization
    if (req.user && req.user.role !== ROLES.PLATFORM_ADMIN && req.user.organizationId) {
      filter.organizationId = req.user.organizationId
    }

    const hostels = await Hostel.find(filter).sort({ name: 1 }).lean()
    res.json({
      success: true,
      count: hostels.length,
      hostels: hostels.map((h) => ({
        id: h._id,
        name: h.name,
        code: h.code,
        address: h.address,
        organizationId: h.organizationId,
        contactInformation: h.contactInformation,
      })),
    })
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load hostels" })
  }
})

/**
 * @route   POST /api/hostels
 * @desc    Create a new hostel (Admin only)
 * @access  Private (Admin)
 */
router.post("/hostels", authenticate, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  try {
    const { name, code, address, contactInformation } = req.body
    if (!name || !code) {
      return res.status(400).json({ success: false, message: "Hostel name and code are required" })
    }

    const hostel = await Hostel.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      address: address ? address.trim() : "",
      contactInformation: contactInformation || {},
    })

    res.status(201).json({
      success: true,
      message: "Hostel created successfully",
      hostel,
    })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || "Failed to create hostel" })
  }
})

/**
 * @route   GET /api/hostels/:id/rooms
 * @desc    Get all rooms in a hostel
 * @access  Private
 */
router.get("/hostels/:id/rooms", authenticate, async (req, res) => {
  try {
    const rooms = await Room.find({ hostelId: req.params.id }).sort({ roomNumber: 1 }).lean()
    res.json({
      success: true,
      count: rooms.length,
      rooms: rooms.map((r) => ({
        id: r._id,
        roomNumber: r.roomNumber,
        building: r.building,
        floor: r.floor,
        status: r.status,
      })),
    })
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load rooms" })
  }
})

/**
 * @route   POST /api/hostels/:id/rooms
 * @desc    Add a room to a hostel (Admin only)
 * @access  Private (Admin)
 */
router.post("/hostels/:id/rooms", authenticate, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  try {
    const { roomNumber, building, floor } = req.body
    if (!roomNumber) {
      return res.status(400).json({ success: false, message: "Room number is required" })
    }

    const room = await Room.create({
      hostelId: req.params.id,
      roomNumber: String(roomNumber).trim(),
      building: building ? String(building).trim() : "Main",
      floor: floor ? Number(floor) : 1,
    })

    res.status(201).json({
      success: true,
      message: "Room created successfully",
      room,
    })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || "Failed to create room" })
  }
})

module.exports = router
