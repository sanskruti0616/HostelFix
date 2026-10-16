const express = require("express")
const router = express.Router()
const crypto = require("crypto")
const {
  authenticateGoogleUser,
  authenticateLocalUser,
  authenticateDemoRole,
  authenticateDevUser,
  registerOrganizationAndAdmin,
  registerHostel,
  registerStudent,
  affiliateUser,
  affiliateUserWithInvitationCode,
  getPublicOrganizations,
  verifyInvitationCode,
  generateToken,
  verifyGoogleIdToken,
} = require("../services/authService")
const { authenticate } = require("../middleware/auth")
const { authorizeRoles } = require("../middleware/rbac")
const User = require("../models/User")
const Organization = require("../models/Organization")
const Hostel = require("../models/Hostel")
const Complaint = require("../models/Complaint")
const bcrypt = require("bcryptjs")
const { ROLES, COMPLAINT_STATUS } = require("../config/constants")

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
    hostel: user.hostelName, // Frontend alias
    roomNumber: user.roomNumber,
    room: user.roomNumber, // Frontend alias
    phone: user.phone,
    specialization: user.specialization || "General Maintenance",
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
    const isDbError =
      error.name === "MongoNetworkError" ||
      error.name === "MongooseServerSelectionError" ||
      (error.message && (error.message.includes("SSL routines") || error.message.includes("ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR")))

    const statusCode = error.statusCode || (isDbError ? 503 : 401)
    const userMessage = isDbError
      ? "Database service temporarily unreachable. Please verify MongoDB Atlas network connectivity."
      : error.message || "Google authentication failed"

    console.error("[Auth] Google Sign-In Error:", error.message)
    res.status(statusCode).json({
      success: false,
      message: userMessage,
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
 * @route   POST /api/auth/register-hostel
 * @desc    Hostel registration: creates hostel, assigns Warden role, makes hostel active
 * @access  Public
 */
router.post("/auth/register-hostel", async (req, res) => {
  try {
    const {
      hostelName,
      name, // alternate key
      code,
      address,
      city,
      state,
      contactEmail,
      email, // alternate key
      contactPhone,
      phone, // alternate key
      wardenName,
      adminName, // alternate key
      wardenPassword,
      adminPassword, // alternate key
      password, // alternate key
    } = req.body

    const result = await registerHostel({
      hostelName: hostelName || name,
      code,
      address,
      city,
      state,
      contactEmail: contactEmail || email,
      contactPhone: contactPhone || phone,
      wardenName: wardenName || adminName,
      wardenPassword: wardenPassword || adminPassword || password,
    })

    res.status(201).json({
      success: true,
      message: `Hostel "${result.hostel.name}" registered successfully! Assigned Warden role.`,
      token: result.token,
      hostel: {
        id: result.hostel._id,
        name: result.hostel.name,
        code: result.hostel.code,
        address: result.hostel.address,
      },
      organization: {
        id: result.organization._id,
        name: result.organization.name,
        slug: result.organization.slug,
        invitationCode: result.organization.invitationCode,
      },
      user: formatUserResponse(result.user),
    })
  } catch (error) {
    console.error("[Auth] Hostel registration error:", error.message)
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to register hostel",
    })
  }
})

/**
 * @route   POST /api/auth/register-organization
 * @desc    Public onboarding for new hostel organization (assigns Warden role)
 * @access  Public
 */
router.post("/auth/register-organization", async (req, res) => {
  try {
    const { name, slug, contactEmail, phone, address, city, state, adminName, adminPassword } = req.body

    const result = await registerHostel({
      hostelName: name,
      code: slug ? slug.substring(0, 4).toUpperCase() : "",
      contactEmail,
      contactPhone: phone,
      address,
      city,
      state,
      wardenName: adminName,
      wardenPassword: adminPassword,
    })

    res.status(201).json({
      success: true,
      message: `Hostel "${result.hostel.name}" registered successfully! Assigned Warden role.`,
      token: result.token,
      organization: {
        id: result.organization._id,
        name: result.organization.name,
        slug: result.organization.slug,
        invitationCode: result.organization.invitationCode,
      },
      hostel: {
        id: result.hostel._id,
        name: result.hostel.name,
        code: result.hostel.code,
        address: result.hostel.address,
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
 * @desc    Student onboarding with mandatory registered hostel selection
 * @access  Public
 */
router.post("/auth/register-student", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      invitationCode,
      organizationId,
      hostelId,
      roomNumber,
      room,
      phone,
    } = req.body

    const result = await registerStudent({
      name,
      email,
      password,
      hostelId,
      roomNumber: roomNumber || room,
      phone,
      invitationCode,
      organizationId,
    })

    res.status(201).json({
      success: true,
      message: `Student account created for ${result.hostel.name}`,
      token: result.token,
      user: formatUserResponse(result.user),
      hostel: {
        id: result.hostel._id,
        name: result.hostel.name,
      },
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
 * @desc    Affiliate an unassigned user via invitation code or directory
 * @access  Private
 */
router.post("/auth/affiliate", authenticate, async (req, res) => {
  try {
    const { invitationCode, hostelId, organizationId, room, roomNumber, mode } = req.body
    const result = await affiliateUser({
      userId: req.user._id,
      invitationCode,
      hostelId,
      organizationId,
      roomNumber: roomNumber || room || "",
      mode,
    })

    res.json({
      success: true,
      message: result.message,
      token: result.token,
      user: formatUserResponse(result.user),
      hostel: result.hostel
        ? {
            id: result.hostel._id,
            name: result.hostel.name,
          }
        : undefined,
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
 * @desc    Get maintenance staff (scoped to warden's hostel; includes assignment & completion metrics)
 * @access  Private (Warden, Admin)
 */
router.get("/users/staff", authenticate, authorizeRoles(ROLES.WARDEN, ROLES.ADMIN), async (req, res) => {
  try {
    const filter = {
      role: ROLES.STAFF,
    }

    if (req.query.status) {
      filter.accountStatus = req.query.status
    } else if (req.query.includeAll !== "true" && req.query.includeInactive !== "true") {
      filter.accountStatus = "active"
    }

    // Strict Tenant / Hostel Isolation:
    if (req.user.role === ROLES.WARDEN) {
      if (req.user.hostelId) {
        filter.$or = [
          { hostelId: req.user.hostelId },
          { authorizedHostels: req.user.hostelId },
        ]
      } else if (req.user.organizationId) {
        filter.organizationId = req.user.organizationId
      }
    } else if (req.user.role !== ROLES.PLATFORM_ADMIN && req.user.organizationId) {
      filter.organizationId = req.user.organizationId
    }

    if (req.query.search) {
      const sRegex = { $regex: req.query.search, $options: "i" }
      const searchClause = {
        $or: [{ name: sRegex }, { email: sRegex }, { phone: sRegex }, { specialization: sRegex }],
      }
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, searchClause]
        delete filter.$or
      } else {
        filter.$or = searchClause.$or
      }
    }

    const staffMembers = await User.find(filter)
      .select("_id name email phone specialization accountStatus hostelId hostelName organizationId organizationName createdAt")
      .sort({ createdAt: -1 })
      .lean()

    const staffIds = staffMembers.map((s) => s._id)
    const countsMap = new Map()

    if (staffIds.length > 0) {
      const counts = await Complaint.aggregate([
        { $match: { "assignedTo.staffId": { $in: staffIds } } },
        {
          $group: {
            _id: "$assignedTo.staffId",
            assignedCount: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$status",
                      [
                        COMPLAINT_STATUS.ASSIGNED,
                        COMPLAINT_STATUS.IN_PROGRESS,
                        COMPLAINT_STATUS.NEED_MATERIAL,
                        COMPLAINT_STATUS.CANNOT_COMPLETE,
                      ],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            completedCount: {
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
          },
        },
      ])
      counts.forEach((c) => countsMap.set(c._id.toString(), c))
    }

    res.json({
      success: true,
      count: staffMembers.length,
      staff: staffMembers.map((s) => {
        const c = countsMap.get(s._id.toString()) || { assignedCount: 0, completedCount: 0 }
        return {
          id: s._id,
          name: s.name,
          email: s.email,
          phone: s.phone || "",
          specialization: s.specialization || "General Maintenance",
          accountStatus: s.accountStatus,
          activationToken: s.activationToken || "",
          activationTokenExpires: s.activationTokenExpires || null,
          hostelId: s.hostelId,
          hostelName: s.hostelName,
          organizationId: s.organizationId,
          organizationName: s.organizationName,
          assignedCount: c.assignedCount || 0,
          completedCount: c.completedCount || 0,
          createdAt: s.createdAt,
        }
      }),
    })
  } catch (error) {
    console.error("[Users] Staff listing error:", error.message)
    res.status(500).json({
      success: false,
      message: "Failed to load maintenance staff",
    })
  }
})

/**
 * @route   POST /api/users/staff
 * @desc    Authorized Warden or Admin creates a new maintenance staff account for their hostel
 * @access  Private (Warden, Admin)
 */
router.post("/users/staff", authenticate, authorizeRoles(ROLES.WARDEN, ROLES.ADMIN), async (req, res) => {
  try {
    const { name, email, phone = "", specialization, password, hostelId } = req.body

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Staff name and email address are required",
      })
    }

    if (password && String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      })
    }

    const cleanEmail = String(email).toLowerCase().trim()
    const emailRegex = /^\S+@\S+\.\S+$/
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      })
    }

    // Reject duplicate emails
    const existingUser = await User.findOne({ email: cleanEmail })
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "An account with this email address already exists.",
      })
    }

    // Determine target hostel and organization
    let targetHostelId = null
    let targetHostelName = ""
    let targetOrgId = req.user.organizationId || null
    let targetOrgName = req.user.organizationName || ""

    if (req.user.role === ROLES.WARDEN) {
      // Warden can ONLY create staff for their own hostel
      const wardenHostelId = req.user.hostelId || (req.user.authorizedHostels && req.user.authorizedHostels[0])
      if (hostelId && wardenHostelId && hostelId.toString() !== wardenHostelId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You can only create maintenance staff for your authorized hostel.",
        })
      }
      targetHostelId = wardenHostelId
    } else {
      // Platform Admin or Hostel Admin
      targetHostelId = hostelId || req.user.hostelId || null
    }

    if (targetHostelId) {
      const hostelDoc = await Hostel.findById(targetHostelId)
      if (hostelDoc) {
        targetHostelName = hostelDoc.name
        if (!targetOrgId && hostelDoc.organizationId) {
          targetOrgId = hostelDoc.organizationId
        }
      }
    }

    if (!targetOrgName && targetOrgId) {
      const orgDoc = await Organization.findById(targetOrgId)
      if (orgDoc) targetOrgName = orgDoc.name
    }

    const allowedSpecializations = [
      "Electrical",
      "Plumbing",
      "Carpentry",
      "Cleaning",
      "General Maintenance",
    ]
    const finalSpecialization =
      specialization && allowedSpecializations.includes(specialization)
        ? specialization
        : "General Maintenance"

    const isDirectPassword = Boolean(password && String(password).trim().length >= 6)
    const effectivePassword = isDirectPassword ? String(password) : crypto.randomBytes(16).toString("hex")
    const passwordHash = await bcrypt.hash(effectivePassword, 10)
    const accountStatus = isDirectPassword ? "active" : "pending_activation"

    // Generate secure activation token and 7-day expiration
    const activationToken = `STAFF-${crypto.randomBytes(4).toString("hex").toUpperCase()}`
    const activationTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const staffUser = await User.create({
      authenticationProvider: "local",
      providerUserId: `staff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      email: cleanEmail,
      username: `${name.toLowerCase().trim().replace(/[^a-z0-9]/g, "_")}_${Date.now().toString(36).slice(-4)}`,
      passwordHash,
      role: ROLES.STAFF, // STRICTLY ENFORCE STAFF ROLE
      accountStatus,
      phone: phone ? String(phone).trim() : "",
      specialization: finalSpecialization,
      organizationId: targetOrgId,
      organizationName: targetOrgName,
      hostelId: targetHostelId,
      hostelName: targetHostelName,
      authorizedHostels: targetHostelId ? [targetHostelId] : [],
      activationToken,
      activationTokenExpires,
    })

    res.status(201).json({
      success: true,
      message: isDirectPassword
        ? `Staff member "${staffUser.name}" created successfully.`
        : `Staff invitation created for "${staffUser.name}". Share the activation code with the technician.`,
      staff: {
        id: staffUser._id,
        name: staffUser.name,
        email: staffUser.email,
        phone: staffUser.phone,
        specialization: staffUser.specialization,
        accountStatus: staffUser.accountStatus,
        hostelId: staffUser.hostelId,
        hostelName: staffUser.hostelName,
        organizationId: staffUser.organizationId,
        organizationName: staffUser.organizationName,
        assignedCount: 0,
        completedCount: 0,
        activationToken: staffUser.activationToken,
        activationTokenExpires: staffUser.activationTokenExpires,
        createdAt: staffUser.createdAt,
      },
      activationToken: staffUser.activationToken,
      activationTokenExpires: staffUser.activationTokenExpires,
    })
  } catch (error) {
    console.error("[Users] Staff creation error:", error.message)
    res.status(500).json({
      success: false,
      message: "Failed to create staff member: " + error.message,
    })
  }
})

/**
 * @route   GET /api/auth/staff/verify-token
 * @desc    Validate a staff invitation / activation token
 * @access  Public
 */
router.get("/auth/staff/verify-token", async (req, res) => {
  try {
    const { token } = req.query
    if (!token) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: "Activation token is required",
      })
    }

    const cleanToken = String(token).trim().toUpperCase()
    const staffUser = await User.findOne({
      activationToken: cleanToken,
      role: ROLES.STAFF,
    })

    if (!staffUser) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: "Invalid or expired activation token. Please request a new invitation from your hostel warden.",
      })
    }

    if (staffUser.activationTokenExpires && new Date() > staffUser.activationTokenExpires) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: "This activation token has expired. Please contact your hostel warden for a renewed invitation.",
      })
    }

    if (staffUser.accountStatus === "suspended") {
      return res.status(403).json({
        success: false,
        valid: false,
        message: "This staff account is currently suspended.",
      })
    }

    res.json({
      success: true,
      valid: true,
      staff: {
        id: staffUser._id,
        name: staffUser.name,
        email: staffUser.email,
        phone: staffUser.phone,
        specialization: staffUser.specialization,
        hostelName: staffUser.hostelName,
        organizationName: staffUser.organizationName,
        accountStatus: staffUser.accountStatus,
      },
    })
  } catch (error) {
    console.error("[Auth] Staff token verification error:", error.message)
    res.status(500).json({
      success: false,
      valid: false,
      message: "Failed to verify activation token",
    })
  }
})

/**
 * @route   POST /api/auth/staff/activate
 * @desc    Staff sets password and activates their account
 * @access  Public
 */
router.post("/auth/staff/activate", async (req, res) => {
  try {
    const { token, password } = req.body
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Activation token is required",
      })
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      })
    }

    const cleanToken = String(token).trim().toUpperCase()
    const staffUser = await User.findOne({
      activationToken: cleanToken,
      role: ROLES.STAFF,
    })

    if (!staffUser) {
      return res.status(404).json({
        success: false,
        message: "Invalid or already-used activation token. Please check your invitation details or log in.",
      })
    }

    if (staffUser.activationTokenExpires && new Date() > staffUser.activationTokenExpires) {
      return res.status(400).json({
        success: false,
        message: "This activation token has expired. Please ask your warden to regenerate it.",
      })
    }

    if (staffUser.accountStatus === "suspended") {
      return res.status(403).json({
        success: false,
        message: "This staff account is suspended. Please contact the hostel administration.",
      })
    }

    const passwordHash = await bcrypt.hash(String(password), 10)
    staffUser.passwordHash = passwordHash
    staffUser.accountStatus = "active"
    staffUser.activationToken = ""
    staffUser.activationTokenExpires = null
    staffUser.lastLoginAt = new Date()
    await staffUser.save()

    const jwtToken = generateToken(staffUser)

    res.json({
      success: true,
      message: `Welcome, ${staffUser.name}! Your maintenance staff account has been activated.`,
      token: jwtToken,
      user: formatUserResponse(staffUser),
    })
  } catch (error) {
    console.error("[Auth] Staff activation error:", error.message)
    res.status(500).json({
      success: false,
      message: error.message || "Failed to activate staff account",
    })
  }
})

/**
 * @route   POST /api/auth/staff/google
 * @desc    Google Sign-In or Activation for Maintenance Staff
 * @access  Public
 */
router.post("/auth/staff/google", async (req, res) => {
  try {
    const { idToken, token: activationToken } = req.body
    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Google idToken is required",
      })
    }

    const profile = await verifyGoogleIdToken(idToken)
    let staffUser = null

    // Case 1: Activation with token
    if (activationToken) {
      const cleanToken = String(activationToken).trim().toUpperCase()
      staffUser = await User.findOne({
        activationToken: cleanToken,
        role: ROLES.STAFF,
      })

      if (!staffUser) {
        return res.status(404).json({
          success: false,
          message: "Invalid or already-used activation token.",
        })
      }

      if (staffUser.activationTokenExpires && new Date() > staffUser.activationTokenExpires) {
        return res.status(400).json({
          success: false,
          message: "Activation token has expired. Please contact your warden.",
        })
      }

      staffUser.authenticationProvider = "google"
      staffUser.providerUserId = profile.providerUserId
      if (profile.profileImage && !staffUser.profileImage) {
        staffUser.profileImage = profile.profileImage
      }
      staffUser.accountStatus = "active"
      staffUser.activationToken = ""
      staffUser.activationTokenExpires = null
      staffUser.lastLoginAt = new Date()
      await staffUser.save()
    } else {
      // Case 2: Sign-in by existing staff member
      staffUser = await User.findOne({
        $or: [
          { providerUserId: profile.providerUserId, authenticationProvider: "google" },
          { email: profile.email },
        ],
        role: ROLES.STAFF,
      })

      if (!staffUser) {
        return res.status(403).json({
          success: false,
          message: "No authorized Maintenance Staff account found for this Google email. You must be invited by your Hostel Warden.",
        })
      }

      if (staffUser.accountStatus === "suspended") {
        return res.status(403).json({
          success: false,
          message: "This staff account is suspended. Please contact the hostel administration.",
        })
      }

      if (staffUser.accountStatus === "pending_activation") {
        staffUser.accountStatus = "active"
        staffUser.activationToken = ""
        staffUser.activationTokenExpires = null
      }

      if (!staffUser.providerUserId) {
        staffUser.providerUserId = profile.providerUserId
      }
      staffUser.lastLoginAt = new Date()
      await staffUser.save()
    }

    const jwtToken = generateToken(staffUser)

    res.json({
      success: true,
      message: `Signed in as Maintenance Staff: ${staffUser.name}`,
      token: jwtToken,
      user: formatUserResponse(staffUser),
    })
  } catch (error) {
    console.error("[Auth] Staff Google auth error:", error.message)
    res.status(error.statusCode || 401).json({
      success: false,
      message: error.message || "Staff Google authentication failed",
    })
  }
})

/**
 * @route   PATCH /api/users/staff/:id/status
 * @desc    Toggle or set staff account status (active vs suspended)
 * @access  Private (Warden, Admin)
 */
router.patch("/users/staff/:id/status", authenticate, authorizeRoles(ROLES.WARDEN, ROLES.ADMIN), async (req, res) => {
  try {
    const { status } = req.body
    if (!status || !["active", "suspended"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'active' or 'suspended'",
      })
    }

    const staff = await User.findById(req.params.id)
    if (!staff || staff.role !== ROLES.STAFF) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      })
    }

    // Warden boundary enforcement
    if (req.user.role === ROLES.WARDEN) {
      const wardenHostelId = req.user.hostelId || (req.user.authorizedHostels && req.user.authorizedHostels[0])
      if (
        wardenHostelId &&
        staff.hostelId &&
        wardenHostelId.toString() !== staff.hostelId.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You cannot modify staff belonging to another hostel",
        })
      }
      if (
        req.user.organizationId &&
        staff.organizationId &&
        req.user.organizationId.toString() !== staff.organizationId.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You cannot modify staff belonging to another hostel organization",
        })
      }
    }

    staff.accountStatus = status
    await staff.save()

    res.json({
      success: true,
      message: `Staff member account marked as ${status}`,
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        specialization: staff.specialization,
        accountStatus: staff.accountStatus,
      },
    })
  } catch (error) {
    console.error("[Users] Staff status update error:", error.message)
    res.status(500).json({
      success: false,
      message: "Failed to update staff status",
    })
  }
})

/**
 * @route   PATCH /api/users/students/:id/status
 * @desc    Approve or update student affiliation status (Warden & Admin)
 * @access  Private (Warden, Admin)
 */
router.patch("/users/students/:id/status", authenticate, authorizeRoles(ROLES.WARDEN, ROLES.ADMIN), async (req, res) => {
  try {
    const { status } = req.body
    if (!status || !["active", "suspended", "pending_approval"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid status ('active', 'suspended', 'pending_approval') is required",
      })
    }

    const student = await User.findById(req.params.id)
    if (!student || student.role !== ROLES.STUDENT) {
      return res.status(404).json({
        success: false,
        message: "Student account not found",
      })
    }

    if (req.user.role === ROLES.WARDEN) {
      const sameOrg =
        req.user.organizationId &&
        student.organizationId &&
        req.user.organizationId.toString() === student.organizationId.toString()
      const sameHostel =
        req.user.hostelId &&
        student.hostelId &&
        req.user.hostelId.toString() === student.hostelId.toString()

      if (!sameOrg && !sameHostel) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized: You can only manage students in your assigned hostel.",
        })
      }
    }

    student.accountStatus = status
    await student.save()

    res.json({
      success: true,
      message: `Student account marked as ${status}`,
      user: formatUserResponse(student),
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update student status",
    })
  }
})

/**
 * @route   PATCH /api/users/staff/:id
 * @desc    Update staff profile details (phone, specialization, name)
 * @access  Private (Warden, Admin)
 */
router.patch("/users/staff/:id", authenticate, authorizeRoles(ROLES.WARDEN, ROLES.ADMIN), async (req, res) => {
  try {
    const { name, phone, specialization } = req.body
    const staff = await User.findById(req.params.id)
    if (!staff || staff.role !== ROLES.STAFF) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      })
    }

    // Warden boundary enforcement
    if (req.user.role === ROLES.WARDEN) {
      const wardenHostelId = req.user.hostelId || (req.user.authorizedHostels && req.user.authorizedHostels[0])
      if (
        wardenHostelId &&
        staff.hostelId &&
        wardenHostelId.toString() !== staff.hostelId.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You cannot modify staff belonging to another hostel",
        })
      }
    }

    if (name) staff.name = name.trim()
    if (phone !== undefined) staff.phone = String(phone).trim()
    if (specialization) staff.specialization = specialization

    await staff.save()

    res.json({
      success: true,
      message: "Staff member updated successfully",
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        specialization: staff.specialization,
        accountStatus: staff.accountStatus,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update staff member",
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
