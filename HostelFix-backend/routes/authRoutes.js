const express = require("express")
const router = express.Router()
const {
  authenticateGoogleUser,
  authenticateLocalUser,
  authenticateDemoRole,
  authenticateDevUser,
  registerOrganizationAndAdmin,
  registerStudent,
  affiliateUserWithInvitationCode,
  getPublicOrganizations,
  verifyInvitationCode,
} = require("../services/authService")
const { authenticate } = require("../middleware/auth")
const { authorizeRoles } = require("../middleware/rbac")
const User = require("../models/User")
const Organization = require("../models/Organization")
const { ROLES } = require("../config/constants")

/**
 * Format user for API responses
 */
function formatUserResponse(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    username: user.username,
    role: user.role,
    profileImage: user.profileImage,
    organizationId: user.organizationId,
    organizationName: user.organizationName,
    authorizedHostels: user.authorizedHostels,
    hostelId: user.hostelId,
    hostelName: user.hostelName,
    roomNumber: user.roomNumber,
    phone: user.phone,
    accountStatus: user.accountStatus,
  }
}

/**
 * @route   POST /api/auth/google
 * @desc    Sign in or register using Google ID Token
 * @access  Public
 */
router.post("/auth/google", async (req, res) => {
  try {
    const { idToken, invitationCode, roomNumber } = req.body
    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Google idToken is required in request body",
      })
    }

    const { user, token } = await authenticateGoogleUser(idToken, {
      invitationCode,
      roomNumber,
    })

    res.json({
      success: true,
      message: "Authentication successful",
      token,
      user: formatUserResponse(user),
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
      user: formatUserResponse(user),
    })
  } catch (error) {
    res.status(error.statusCode || 401).json({
      success: false,
      message: error.message || "Invalid credentials",
    })
  }
})

/**
 * @route   POST /api/auth/register-organization
 * @desc    Public onboarding for new hostel organization and admin
 * @access  Public
 */
router.post("/auth/register-organization", async (req, res) => {
  try {
    const { name, slug, contactEmail, phone, address, city, state, adminName, adminPassword } = req.body

    const result = await registerOrganizationAndAdmin({
      name,
      slug,
      contactEmail,
      phone,
      address,
      city,
      state,
      adminName,
      adminPassword,
    })

    res.status(201).json({
      success: true,
      message: `Organization "${result.organization.name}" registered successfully!`,
      token: result.token,
      organization: {
        id: result.organization._id,
        name: result.organization.name,
        slug: result.organization.slug,
        invitationCode: result.organization.invitationCode,
      },
      user: formatUserResponse(result.user),
    })
  } catch (error) {
    console.error("[Auth] Organization registration error:", error.message)
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to register hostel organization",
    })
  }
})

/**
 * @route   POST /api/auth/register-student
 * @desc    Student onboarding with invitation code or organization affiliation
 * @access  Public
 */
router.post("/auth/register-student", async (req, res) => {
  try {
    const { name, email, password, invitationCode, organizationId, hostelId, roomNumber, phone } = req.body

    const result = await registerStudent({
      name,
      email,
      password,
      invitationCode,
      organizationId,
      hostelId,
      roomNumber,
      phone,
    })

    res.status(201).json({
      success: true,
      message: "Student account created successfully",
      token: result.token,
      user: formatUserResponse(result.user),
    })
  } catch (error) {
    console.error("[Auth] Student registration error:", error.message)
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to register student account",
    })
  }
})

/**
 * @route   POST /api/auth/affiliate
 * @desc    Affiliate an unassigned user with an invitation code
 * @access  Private
 */
router.post("/auth/affiliate", authenticate, async (req, res) => {
  try {
    const { invitationCode, roomNumber } = req.body
    const result = await affiliateUserWithInvitationCode(req.user._id, invitationCode, roomNumber)

    res.json({
      success: true,
      message: `Successfully joined ${result.organization.name}!`,
      token: result.token,
      user: formatUserResponse(result.user),
    })
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to affiliate with hostel",
    })
  }
})

/**
 * @route   GET /api/auth/tenants/public
 * @desc    Get public directory of registered hostel organizations
 * @access  Public
 */
router.get("/auth/tenants/public", async (req, res) => {
  try {
    const organizations = await getPublicOrganizations()
    res.json({
      success: true,
      organizations,
    })
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load organizations" })
  }
})

/**
 * @route   GET /api/auth/tenants/verify-code/:code
 * @desc    Verify organization invitation code
 * @access  Public
 */
router.get("/auth/tenants/verify-code/:code", async (req, res) => {
  try {
    const verification = await verifyInvitationCode(req.params.code)
    res.json({
      success: true,
      ...verification,
    })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || "Invalid code" })
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
      user: formatUserResponse(user),
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
      user: formatUserResponse(user),
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
 * @desc    Get currently logged in user profile with tenant scope
 * @access  Private
 */
router.get("/users/me", authenticate, async (req, res) => {
  res.json({
    success: true,
    user: formatUserResponse(req.user),
  })
})

/**
 * @route   PATCH /api/users/me
 * @desc    Update current user profile (phone, room)
 * @access  Private
 */
router.patch("/users/me", authenticate, async (req, res) => {
  try {
    const { phone, roomNumber } = req.body
    const user = req.user

    if (phone !== undefined) user.phone = String(phone).trim()
    if (roomNumber !== undefined) user.roomNumber = String(roomNumber).trim()

    await user.save()

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: formatUserResponse(user),
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
 * @desc    Get active maintenance staff for assignment (strictly scoped to organization)
 * @access  Private (Warden, Admin)
 */
router.get("/users/staff", authenticate, authorizeRoles(ROLES.WARDEN, ROLES.ADMIN), async (req, res) => {
  try {
    const filter = {
      role: ROLES.STAFF,
      accountStatus: "active",
    }

    // Strict Tenant Isolation: Only staff belonging to this organization
    if (req.user.role !== ROLES.PLATFORM_ADMIN && req.user.organizationId) {
      filter.organizationId = req.user.organizationId
    }

    const staffMembers = await User.find(filter)
      .select("_id name email phone organizationName")
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
 * @desc    List all users (Hostel Admin sees own organization; Platform Admin sees all)
 * @access  Private (Admin)
 */
router.get("/users", authenticate, authorizeRoles(ROLES.ADMIN), async (req, res) => {
  try {
    const { role, status, search, page = 1, limit = 50 } = req.query
    const filter = {}

    // Strict Tenant Isolation: Hostel Admin only sees users within their organization
    if (req.user.role !== ROLES.PLATFORM_ADMIN && req.user.organizationId) {
      filter.organizationId = req.user.organizationId
    }

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
        .select("-passwordHash -__v")
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
        organizationId: u.organizationId,
        organizationName: u.organizationName,
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
 * @desc    Update user role within same organization
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

    // Prevent hostel admin from elevating anyone to platform_admin
    if (role === ROLES.PLATFORM_ADMIN && req.user.role !== ROLES.PLATFORM_ADMIN) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Cannot assign Platform Administrator role",
      })
    }

    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    // Verify tenant boundary
    if (
      req.user.role !== ROLES.PLATFORM_ADMIN &&
      req.user.organizationId &&
      user.organizationId &&
      req.user.organizationId.toString() !== user.organizationId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You cannot modify users belonging to another hostel organization",
      })
    }

    user.role = role
    await user.save()

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      user: formatUserResponse(user),
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update user role",
    })
  }
})

module.exports = router
