const jwt = require("jsonwebtoken")
const User = require("../models/User")
const { JWT_SECRET } = require("../services/authService")

/**
 * Authentication Middleware
 * Validates JWT Bearer tokens and attaches the verified user to req.user
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing. Please sign in.",
      })
    }

    const token = authHeader.split(" ")[1]
    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          code: "TOKEN_EXPIRED",
          message: "Session has expired. Please sign in again.",
        })
      }
      return res.status(401).json({
        success: false,
        code: "INVALID_TOKEN",
        message: "Invalid authentication token.",
      })
    }

    const user = await User.findById(decoded.id)
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account no longer exists.",
      })
    }

    if (user.accountStatus === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Account has been suspended.",
      })
    }

    req.user = user
    req.token = token
    next()
  } catch (error) {
    console.error("[AuthMiddleware] Error:", error.message)
    return res.status(500).json({
      success: false,
      message: "Internal authentication error.",
    })
  }
}

module.exports = {
  authenticate,
}
