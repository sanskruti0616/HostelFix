const { OAuth2Client } = require("google-auth-library")
const jwt = require("jsonwebtoken")
const User = require("../models/User")
const { ROLES } = require("../config/constants")
require("../config/loadEnv")

const JWT_SECRET = process.env.JWT_SECRET || "hostelfix_super_secret_jwt_key_2026_change_in_prod"
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d"
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ""

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID)

/**
 * Generate authenticated JWT session token
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
      hostelId: user.hostelId ? user.hostelId.toString() : null,
      hostelName: user.hostelName || "",
      roomNumber: user.roomNumber || "",
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )
}

/**
 * Verify Google ID Token received from Google Sign-In button / One-Tap
 */
async function verifyGoogleIdToken(idToken) {
  if (!idToken) {
    throw new Error("Google ID token is required")
  }

  // If client ID is configured, verify signature against Google's public certs
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

  // If GOOGLE_CLIENT_ID is not configured in dev, decode payload safely
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
 * Login or provision user via Google Authentication
 */
async function authenticateGoogleUser(idToken) {
  const profile = await verifyGoogleIdToken(idToken)

  // Look up user by provider ID or email
  let user = await User.findOne({
    $or: [
      { providerUserId: profile.providerUserId, authenticationProvider: "google" },
      { email: profile.email },
    ],
  })

  if (!user) {
    // Check if there is an approved domain restriction
    const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN
    if (allowedDomain && !profile.email.endsWith(`@${allowedDomain}`)) {
      const error = new Error(`Registration is restricted to @${allowedDomain} accounts.`)
      error.statusCode = 403
      throw error
    }

    // Provision new user record in MongoDB Atlas
    user = await User.create({
      authenticationProvider: "google",
      providerUserId: profile.providerUserId,
      name: profile.name,
      email: profile.email,
      profileImage: profile.profileImage,
      role: ROLES.STUDENT, // Default role is always student
      accountStatus: "active",
      hostelName: "Girls Hostel A",
      roomNumber: "A-204",
      lastLoginAt: new Date(),
    })
  } else {
    // Update existing user details
    user.lastLoginAt = new Date()
    if (profile.profileImage && !user.profileImage) {
      user.profileImage = profile.profileImage
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
 * Development authentication helper for switching between authorized seed roles
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
  authenticateDevUser,
}
