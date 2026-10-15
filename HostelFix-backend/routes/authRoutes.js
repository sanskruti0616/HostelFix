const express = require("express")
const router = express.Router()
const {
  authenticateGoogleUser,
  authenticateLocalUser,
  authenticateDemoRole,
  authenticateDevUser,
} = require("../services/authService")
const { authenticate } = require("../middleware/auth")
const { authorizeRoles } = require("../middleware/rbac")
const User = require("../models/User")
const { ROLES } = require("../config/constants")

/**
 * @route   POST /api/auth/google
 * @desc    Sign in or register using Google ID Token
 * @access  Public
 */
router.post("/auth/google", async (req, res) => {
  try {
    const { idToken } = req.body
    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Google idToken is required in request body",
      })
    }

    const { user, token } = await authenticateGoogleUser(idToken)

    res.json({
      success: true,
      message: "Authentication successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        profileImage: user.profileImage,
        hostelName: user.hostelName,
        roomNumber: user.roomNumber,
        phone: user.phone,
      },
    })
  } catch (error) {
    console.error("[Auth] Google Sign-In Error:", error.message)
    res.status(error.statusCode || 401).json({
      success: false,
      message: error.message || "Google authentication failed",
    })
  }
})

/**
 * @route   POST /api/auth/login
 * @desc    Manual email/username and password login
 * @access  Public
 */
router.post("/auth/login", async (req, res) => {
  try {
    const { identifier, password } = req.body
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide your email/username and password",
      })
    }

    const { user, token } = await authenticateLocalUser(identifier, password)

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        profileImage: user.profileImage,
        hostelName: user.hostelName,
        roomNumber: user.roomNumber,
        phone: user.phone,
      },
    })
  } catch (error) {
    res.status(error.statusCode || 401).json({
      success: false,
      message: error.message || "Invalid credentials",
    })
  }
})

/**
 * @route   POST /api/auth/demo-login
 * @desc    Authenticate with predefined authorized demo account by role
 * @access  Public
 */
router.post("/auth/demo-login", async (req, res) => {
  try {
    const { role } = req.body
    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Role is required for demo login",
      })
    }

    const { user, token } = await authenticateDemoRole(role)

    res.json({
      success: true,
      message: `Signed in as demo ${user.role}`,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        profileImage: user.profileImage,
        hostelName: user.hostelName,
        roomNumber: user.roomNumber,
        phone: user.phone,
      },
    })
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Demo login failed",
    })
  }
})

/**
 * @route   POST /api/auth/login-dev
 * @desc    Development login to switch between seed users
 * @access  Public (in dev only)
 */
router.post("/auth/login-dev", async (req, res) => {
  try {
    const { email } = req.body
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      })
    }

    const { user, token } = await authenticateDevUser(email)

    res.json({
      success: true,
      message: "Development login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        hostelName: user.hostelName,
        roomNumber: user.roomNumber,
        phone: user.phone,
      },
    })
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Login failed",
    })
  }
})

/**
 * @route   GET /api/users/me
 * @desc    Get currently logged in user profile
 * @access  Private
 */
router.get("/users/me", authenticate, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      profileImage: req.user.profileImage,
      hostelName: req.user.hostelName,
      roomNumber: req.user.roomNumber,
      phone: req.user.phone,
      accountStatus: req.user.accountStatus,
    },
  })
})

/**
 * @route   PATCH /api/users/me
 * @desc    Update current user profile (phone, room, hostel)
 * @access  Private
 */
router.patch("/users/me", authenticate, async (req, res) => {
  try {
    const { phone, roomNumber, hostelName } = req.body
    const user = req.user

    if (phone !== undefined) user.phone = String(phone).trim()
    if (roomNumber !== undefined) user.roomNumber = String(roomNumber).trim()
    if (hostelName !== undefined) user.hostelName = String(hostelName).trim()

    await user.save()

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        hostelName: user.hostelName,
        roomNumber: user.roomNumber,
        phone: user.phone,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
    })
  }
})

/**
 * @route   GET /api/users/staff
 * @desc    Get active maintenance staff for assignment
 * @access  Private (Warden, Admin)
 */
router.get("/users/staff", authenticate, authorizeRoles(ROLES.WARDEN, ROLES.ADMIN), async (req, res) => {
  try {
    const staffMembers = await User.find({
      role: ROLES.STAFF,
      accountStatus: "active",
    })
      .select("_id name email phone")
      .sort({ name: 1 })
      .lean()

    res.json({
      success: true,
      count: staffMembers.length,
      staff: staffMembers.map((s) => ({
        id: s._id,
        name: s.name,
        email: s.email,
        phone: s.phone,
      })),
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load maintenance staff",
    })
  }
})

/**
 * @route   GET /api/users
 * @desc    List all users (Admin only)
 * @access  Private (Admin)
 */
router.get("/users", authenticate, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  try {
    const { role, status, search, page = 1, limit = 50 } = req.query
    const filter = {}

    if (role) filter.role = role
    if (status) filter.accountStatus = status
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { roomNumber: { $regex: search, $options: "i" } },
      ]
    }

    const skip = (Number(page) - 1) * Number(limit)
    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-__v")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(filter),
    ])

    res.json({
      success: true,
      total,
      page: Number(page),
      users: users.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        accountStatus: u.accountStatus,
        hostelName: u.hostelName,
        roomNumber: u.roomNumber,
        phone: u.phone,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
      })),
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to list users",
    })
  }
})

/**
 * @route   PATCH /api/users/:id/role
 * @desc    Update user role (Admin only)
 * @access  Private (Admin)
 */
router.patch("/users/:id/role", authenticate, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  try {
    const { role } = req.body
    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role specified",
      })
    }

    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    user.role = role
    await user.save()

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update user role",
    })
  }
})

module.exports = router
