const { OAuth2Client } = require("google-auth-library")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const User = require("../models/User")
const Organization = require("../models/Organization")
const Hostel = require("../models/Hostel")
const { ROLES } = require("../config/constants")
require("../config/loadEnv")

const JWT_SECRET = process.env.JWT_SECRET || "hostelfix_super_secret_jwt_key_2026_change_in_prod"
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d"
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ""

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID)

/**
 * Generate authenticated JWT session token with tenant and role claims
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
      organizationId: user.organizationId ? user.organizationId.toString() : null,
      organizationName: user.organizationName || "",
      authorizedHostels: (user.authorizedHostels || []).map((h) => h.toString()),
      hostelId: user.hostelId ? user.hostelId.toString() : null,
      hostelName: user.hostelName || "",
      roomNumber: user.roomNumber || "",
      accountStatus: user.accountStatus || "active",
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )
}

/**
 * Verify Google ID Token received from Google Sign-In button
 */
async function verifyGoogleIdToken(idToken) {
  if (!idToken) {
    throw new Error("Google ID token is required")
  }

  if (GOOGLE_CLIENT_ID) {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    })
    const payload = ticket.getPayload()
    return {
      providerUserId: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name || payload.email.split("@")[0],
      profileImage: payload.picture || "",
      emailVerified: payload.email_verified,
    }
  }

  const decoded = jwt.decode(idToken)
  if (!decoded || !decoded.sub || !decoded.email) {
    throw new Error("Invalid Google ID token structure")
  }

  return {
    providerUserId: decoded.sub,
    email: decoded.email.toLowerCase(),
    name: decoded.name || decoded.email.split("@")[0],
    profileImage: decoded.picture || "",
    emailVerified: decoded.email_verified,
  }
}

/**
 * Login or provision user via Google Authentication with tenant affiliation
 */
async function authenticateGoogleUser(idToken, affiliationData = {}) {
  const profile = await verifyGoogleIdToken(idToken)

  // Look up user by provider ID or email
  let user = await User.findOne({
    $or: [
      { providerUserId: profile.providerUserId, authenticationProvider: "google" },
      { email: profile.email },
    ],
  })

  if (!user) {
    // New Google user registration
    let org = null
    let hostel = null
    let accountStatus = "active"

    if (affiliationData.invitationCode) {
      org = await Organization.findOne({
        invitationCode: affiliationData.invitationCode.trim().toUpperCase(),
        status: "active",
      })
      if (org) {
        if (affiliationData.hostelId) {
          hostel = await Hostel.findOne({ _id: affiliationData.hostelId, organizationId: org._id })
        }
        if (!hostel) {
          hostel = await Hostel.findOne({ organizationId: org._id, status: "active" })
        }
      }
    }

    if (!org) {
      accountStatus = "pending_affiliation"
    }

    // Provision new user record in MongoDB Atlas
    user = await User.create({
      authenticationProvider: "google",
      providerUserId: profile.providerUserId,
      name: profile.name,
      email: profile.email,
      profileImage: profile.profileImage,
      role: ROLES.STUDENT, // Default role is always student
      accountStatus,
      organizationId: org ? org._id : null,
      organizationName: org ? org.name : "",
      hostelId: hostel ? hostel._id : null,
      hostelName: hostel ? hostel.name : "",
      authorizedHostels: hostel ? [hostel._id] : [],
      roomNumber: affiliationData.roomNumber || "",
      lastLoginAt: new Date(),
    })
  } else {
    // Update existing user details; preserve existing role and organization
    user.lastLoginAt = new Date()
    if (profile.profileImage && !user.profileImage) {
      user.profileImage = profile.profileImage
    }

    // If user was pending affiliation and now supplied valid code
    if (user.accountStatus === "pending_affiliation" && affiliationData.invitationCode) {
      const org = await Organization.findOne({
        invitationCode: affiliationData.invitationCode.trim().toUpperCase(),
        status: "active",
      })
      if (org) {
        const hostel = await Hostel.findOne({ organizationId: org._id, status: "active" })
        user.organizationId = org._id
        user.organizationName = org.name
        user.hostelId = hostel ? hostel._id : null
        user.hostelName = hostel ? hostel.name : ""
        user.authorizedHostels = hostel ? [hostel._id] : []
        user.accountStatus = "active"
      }
    }
    await user.save()
  }

  if (user.accountStatus === "suspended") {
    const error = new Error("This account has been suspended. Please contact the hostel administration.")
    error.statusCode = 403
    throw error
  }

  const token = generateToken(user)
  return { user, token }
}

/**
 * Predefined demo accounts map
 */
const DEMO_ACCOUNT_EMAILS = {
  student: "sanskruti@hostelfix.com",
  warden: "warden@hostelfix.com",
  staff: "vaishnavi@hostelfix.com",
  admin: "admin@hostelfix.com",
}

/**
 * Authenticate via email/username and password
 */
async function authenticateLocalUser(identifier, password) {
  if (!identifier || !password) {
    const error = new Error("Email/username and password are required")
    error.statusCode = 400
    throw error
  }

  const cleanIdentifier = String(identifier).trim().toLowerCase()

  // Find user by email OR username, explicitly requesting passwordHash
  const user = await User.findOne({
    $or: [{ email: cleanIdentifier }, { username: cleanIdentifier }],
  }).select("+passwordHash")

  if (!user || !user.passwordHash) {
    const error = new Error("Invalid email/username or password")
    error.statusCode = 401
    throw error
  }

  const isMatch = await bcrypt.compare(String(password), user.passwordHash)
  if (!isMatch) {
    const error = new Error("Invalid email/username or password")
    error.statusCode = 401
    throw error
  }

  if (user.accountStatus === "suspended") {
    const error = new Error("This account has been suspended. Please contact the hostel administration.")
    error.statusCode = 403
    throw error
  }

  user.lastLoginAt = new Date()
  await user.save()

  const token = generateToken(user)
  return { user, token }
}

/**
 * Authenticate predefined demo account by role
 */
async function authenticateDemoRole(role) {
  const cleanRole = String(role).trim().toLowerCase()
  if (!Object.values(ROLES).includes(cleanRole)) {
    const error = new Error(`Invalid demo role '${role}' requested`)
    error.statusCode = 400
    throw error
  }

  const expectedEmail = DEMO_ACCOUNT_EMAILS[cleanRole]
  let user = await User.findOne({ email: expectedEmail })

  if (!user) {
    user = await User.findOne({ role: cleanRole, isDemoAccount: true })
  }

  if (!user) {
    const error = new Error(
      `Demo account for role '${cleanRole}' not found in database. Run 'npm run seed' in HostelFix-backend to provision demo accounts.`
    )
    error.statusCode = 404
    throw error
  }

  if (user.accountStatus === "suspended") {
    const error = new Error("This demo account has been suspended.")
    error.statusCode = 403
    throw error
  }

  user.lastLoginAt = new Date()
  await user.save()

  const token = generateToken(user)
  return { user, token }
}

/**
 * Register a new Hostel Organization and provision its initial Hostel Administrator
 */
async function registerOrganizationAndAdmin({
  name,
  slug,
  contactEmail,
  phone = "",
  address = "",
  city = "",
  state = "",
  adminName,
  adminPassword,
}) {
  if (!name || !contactEmail || !adminName || !adminPassword) {
    const error = new Error("Organization name, contact email, administrator name, and password are required")
    error.statusCode = 400
    throw error
  }

  // Generate or clean slug
  let cleanSlug = slug
    ? String(slug).toLowerCase().trim().replace(/[^a-z0-9-]/g, "-")
    : String(name).toLowerCase().trim().replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-")
  cleanSlug = cleanSlug.replace(/^-|-$/g, "") || `hostel-${Date.now().toString(36)}`

  // Check slug uniqueness
  const existingOrg = await Organization.findOne({ slug: cleanSlug })
  if (existingOrg) {
    cleanSlug = `${cleanSlug}-${Date.now().toString().slice(-4)}`
  }

  // Generate unique invitation code
  const invitationCode = `${cleanSlug.substring(0, 4).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

  // Check admin email
  const existingUser = await User.findOne({ email: contactEmail.toLowerCase().trim() })
  if (existingUser) {
    const error = new Error("An account with this administrator email already exists. Please log in.")
    error.statusCode = 400
    throw error
  }

  // 1. Create Organization
  const org = await Organization.create({
    name: name.trim(),
    slug: cleanSlug,
    invitationCode,
    contactEmail: contactEmail.toLowerCase().trim(),
    phone: phone.trim(),
    address: address.trim(),
    city: city.trim(),
    state: state.trim(),
    status: "active",
    plan: "standard",
  })

  // 2. Create default building for this organization
  const defaultHostel = await Hostel.create({
    organizationId: org._id,
    name: `${name.trim()} Main Hostel`,
    code: `${cleanSlug.substring(0, 3).toUpperCase()}1`,
    address: address.trim() || city.trim(),
    contactInformation: {
      wardenName: adminName.trim(),
      phone: phone.trim(),
      email: contactEmail.toLowerCase().trim(),
    },
    status: "active",
  })

  // 3. Hash admin/warden password
  const passwordHash = await bcrypt.hash(String(adminPassword), 10)

  // 4. Create Hostel Registrant with Warden Role (Strictly single Platform Admin architecture)
  const wardenUser = await User.create({
    authenticationProvider: "local",
    providerUserId: `warden_${cleanSlug}_${Date.now()}`,
    name: adminName.trim(),
    email: contactEmail.toLowerCase().trim(),
    username: `${cleanSlug.replace(/-/g, "_")}_warden`,
    passwordHash,
    role: ROLES.WARDEN, // AUTOMATICALLY ASSIGN WARDEN ROLE
    organizationId: org._id,
    organizationName: org.name,
    authorizedHostels: [defaultHostel._id],
    hostelId: defaultHostel._id,
    hostelName: defaultHostel.name,
    accountStatus: "active",
  })

  org.createdBy = wardenUser._id
  await org.save()

  const token = generateToken(wardenUser)
  return { user: wardenUser, organization: org, hostel: defaultHostel, token }
}

/**
 * Register a new Hostel and automatically assign the Warden role
 */
async function registerHostel({
  hostelName,
  code,
  address = "",
  city = "",
  state = "",
  contactEmail,
  contactPhone = "",
  wardenName,
  wardenPassword,
}) {
  if (!hostelName || !contactEmail || !wardenName || !wardenPassword) {
    const error = new Error("Hostel name, contact email, warden name, and password are required")
    error.statusCode = 400
    throw error
  }

  if (String(wardenPassword).length < 6) {
    const error = new Error("Password must be at least 6 characters")
    error.statusCode = 400
    throw error
  }

  const cleanEmail = String(contactEmail).toLowerCase().trim()
  const existingUser = await User.findOne({ email: cleanEmail })
  if (existingUser) {
    const error = new Error("An account with this email address already exists. Please log in.")
    error.statusCode = 400
    throw error
  }

  // Generate unique slug
  let cleanSlug = String(hostelName)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "")
  if (!cleanSlug) cleanSlug = `hostel-${Date.now().toString(36)}`

  // Generate unique hostel code
  let hostelCode = code ? String(code).trim().toUpperCase() : cleanSlug.substring(0, 4).toUpperCase()
  const existingHostelCode = await Hostel.findOne({ code: hostelCode })
  if (existingHostelCode) {
    hostelCode = `${hostelCode}${Math.floor(10 + Math.random() * 90)}`
  }

  // 1. Create Organization partition for this hostel
  const invitationCode = `${cleanSlug.substring(0, 4).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
  const org = await Organization.create({
    name: hostelName.trim(),
    slug: `${cleanSlug}-${Date.now().toString().slice(-4)}`,
    invitationCode,
    contactEmail: cleanEmail,
    phone: contactPhone.trim(),
    address: address.trim(),
    city: city.trim(),
    state: state.trim(),
    status: "active",
    plan: "standard",
  })

  // 2. Create the Hostel record in active status
  const hostel = await Hostel.create({
    organizationId: org._id,
    name: hostelName.trim(),
    code: hostelCode,
    address: address.trim() || city.trim(),
    contactInformation: {
      wardenName: wardenName.trim(),
      phone: contactPhone.trim(),
      email: cleanEmail,
    },
    status: "active",
  })

  // 3. Hash password
  const passwordHash = await bcrypt.hash(String(wardenPassword), 10)

  // 4. Create User Account with Warden Role
  const wardenUser = await User.create({
    authenticationProvider: "local",
    providerUserId: `warden_${cleanSlug}_${Date.now()}`,
    name: wardenName.trim(),
    email: cleanEmail,
    username: `${cleanSlug.replace(/-/g, "_")}_warden`,
    passwordHash,
    role: ROLES.WARDEN, // AUTOMATICALLY ASSIGN WARDEN ROLE
    organizationId: org._id,
    organizationName: org.name,
    authorizedHostels: [hostel._id],
    hostelId: hostel._id,
    hostelName: hostel.name,
    accountStatus: "active",
  })

  org.createdBy = wardenUser._id
  await org.save()

  const token = generateToken(wardenUser)
  return { user: wardenUser, hostel, organization: org, token }
}

/**
 * Register a student and affiliate them with an active registered hostel
 */
async function registerStudent({
  name,
  email,
  password,
  hostelId,
  roomNumber = "",
  phone = "",
  invitationCode,
  organizationId,
}) {
  if (!name || !email || !password) {
    const error = new Error("Name, email, and password are required")
    error.statusCode = 400
    throw error
  }

  if (String(password).length < 6) {
    const error = new Error("Password must be at least 6 characters")
    error.statusCode = 400
    throw error
  }

  const cleanEmail = String(email).toLowerCase().trim()
  const existingUser = await User.findOne({ email: cleanEmail })
  if (existingUser) {
    const error = new Error("An account with this email address already exists. Please log in.")
    error.statusCode = 400
    throw error
  }

  // Validate hostel selection
  if (!hostelId && !invitationCode) {
    const error = new Error("Please select your registered hostel.")
    error.statusCode = 400
    throw error
  }

  let hostel = null
  let org = null

  if (hostelId) {
    hostel = await Hostel.findOne({ _id: hostelId, status: "active" })
    if (!hostel) {
      const error = new Error("Selected hostel is invalid or inactive. Please choose an active registered hostel.")
      error.statusCode = 400
      throw error
    }
    if (hostel.organizationId) {
      org = await Organization.findById(hostel.organizationId)
    }
  } else if (invitationCode) {
    org = await Organization.findOne({
      invitationCode: String(invitationCode).trim().toUpperCase(),
      status: "active",
    })
    if (!org) {
      const error = new Error("Invalid or inactive hostel invitation code.")
      error.statusCode = 400
      throw error
    }
    hostel = await Hostel.findOne({ organizationId: org._id, status: "active" })
  }

  if (!hostel) {
    const error = new Error("No active registered hostel found. Please select an active hostel.")
    error.statusCode = 400
    throw error
  }

  const passwordHash = await bcrypt.hash(String(password), 10)

  // Explicitly assign STUDENT role — never allow role injection
  const studentUser = await User.create({
    authenticationProvider: "local",
    providerUserId: `student_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim(),
    email: cleanEmail,
    passwordHash,
    role: ROLES.STUDENT,
    organizationId: org ? org._id : hostel.organizationId,
    organizationName: org ? org.name : hostel.name,
    invitationCodeUsed: org ? org.invitationCode : "",
    hostelId: hostel._id,
    hostelName: hostel.name,
    authorizedHostels: [hostel._id],
    roomNumber: roomNumber ? String(roomNumber).trim() : "",
    phone: phone ? String(phone).trim() : "",
    accountStatus: "active",
  })

  const token = generateToken(studentUser)
  return { user: studentUser, hostel, organization: org, token }
}

/**
 * Affiliate an unassigned student with an invitation code
 */
async function affiliateUserWithInvitationCode(userId, invitationCode, roomNumber = "") {
  if (!invitationCode) {
    const error = new Error("Invitation code is required")
    error.statusCode = 400
    throw error
  }

  const org = await Organization.findOne({
    invitationCode: String(invitationCode).trim().toUpperCase(),
    status: "active",
  })
  if (!org) {
    const error = new Error("Invalid hostel invitation code.")
    error.statusCode = 400
    throw error
  }

  const hostel = await Hostel.findOne({ organizationId: org._id, status: "active" })

  const user = await User.findById(userId)
  if (!user) {
    const error = new Error("User not found")
    error.statusCode = 404
    throw error
  }

  user.organizationId = org._id
  user.organizationName = org.name
  user.invitationCodeUsed = org.invitationCode
  user.hostelId = hostel ? hostel._id : null
  user.hostelName = hostel ? hostel.name : ""
  user.authorizedHostels = hostel ? [hostel._id] : []
  if (roomNumber) {
    user.roomNumber = String(roomNumber).trim()
  }
  user.accountStatus = "active"
  await user.save()

  const token = generateToken(user)
  return { user, organization: org, token }
}

/**
 * Get public list of active hostel organizations
 */
async function getPublicOrganizations() {
  const orgs = await Organization.find({ status: "active" })
    .select("_id name slug city state invitationCode")
    .sort({ name: 1 })
    .lean()

  const orgIds = orgs.map((o) => o._id)
  const hostels = await Hostel.find({ organizationId: { $in: orgIds }, status: "active" })
    .select("_id organizationId name code")
    .lean()

  const orgList = orgs.map((o) => ({
    id: o._id,
    name: o.name,
    slug: o.slug,
    city: o.city,
    state: o.state,
    invitationCode: o.invitationCode,
    hostels: hostels.filter((h) => h.organizationId.toString() === o._id.toString()),
  }))

  return orgList
}

/**
 * Verify invitation code and return organization details
 */
async function verifyInvitationCode(code) {
  if (!code) {
    throw new Error("Invitation code is required")
  }

  const org = await Organization.findOne({
    invitationCode: String(code).trim().toUpperCase(),
    status: "active",
  })
  if (!org) {
    return { valid: false, message: "Invalid or inactive invitation code" }
  }

  const hostels = await Hostel.find({ organizationId: org._id, status: "active" })
    .select("_id name code")
    .lean()

  return {
    valid: true,
    organization: {
      id: org._id,
      name: org.name,
      slug: org.slug,
      invitationCode: org.invitationCode,
      city: org.city,
      state: org.state,
    },
    hostels,
  }
}

/**
 * Development authentication helper
 */
async function authenticateDevUser(email) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_LOGIN !== "true") {
    throw new Error("Development login is disabled in production")
  }

  const user = await User.findOne({ email: email.toLowerCase() })
  if (!user) {
    const error = new Error(`User with email ${email} not found in database. Run 'npm run seed' first.`)
    error.statusCode = 404
    throw error
  }

  user.lastLoginAt = new Date()
  await user.save()

  const token = generateToken(user)
  return { user, token }
}

module.exports = {
  JWT_SECRET,
  generateToken,
  verifyGoogleIdToken,
  authenticateGoogleUser,
  authenticateLocalUser,
  authenticateDemoRole,
  authenticateDevUser,
  registerOrganizationAndAdmin,
  registerHostel,
  registerStudent,
  affiliateUserWithInvitationCode,
  getPublicOrganizations,
  verifyInvitationCode,
}
