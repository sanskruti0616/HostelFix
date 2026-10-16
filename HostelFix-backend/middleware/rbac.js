const { ROLES } = require("../config/constants")

/**
 * Restrict endpoint access to specific roles.
 * Platform Admin automatically inherits administrative permissions.
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthenticated request",
      })
    }

    if (req.user.role === ROLES.PLATFORM_ADMIN) {
      return next()
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to [${allowedRoles.join(", ")}]. Current role is '${req.user.role}'.`,
      })
    }

    next()
  }
}

/**
 * Enforce that the user has an active tenant affiliation
 */
function enforceTenantScope(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Unauthenticated" })
  }

  // Platform admin can operate cross-tenant or on a specific tenant query
  if (req.user.role === ROLES.PLATFORM_ADMIN) {
    req.tenantId = req.query.organizationId || req.headers["x-organization-id"] || null
    return next()
  }

  if (!req.user.organizationId || req.user.accountStatus === "pending_affiliation") {
    return res.status(403).json({
      success: false,
      code: "PENDING_AFFILIATION",
      message: "Your account is not affiliated with any hostel organization. Please complete hostel affiliation.",
    })
  }

  req.tenantId = req.user.organizationId
  next()
}

/**
 * Verify access permission for a complaint resource based on role & tenant isolation
 */
function canAccessComplaint(user, complaint) {
  if (!user || !complaint) return false

  // Platform Admin has universal cross-tenant access
  if (user.role === ROLES.PLATFORM_ADMIN) return true

  // Strict Tenant Isolation: User's organization must match complaint's organization
  if (user.organizationId && complaint.organizationId) {
    if (user.organizationId.toString() !== complaint.organizationId.toString()) {
      return false // Cross-tenant access strictly denied
    }
  }

  // Hostel Administrator has full access within their own organization
  if (user.role === ROLES.ADMIN) {
    return true
  }

  // Warden can access complaints within authorized hostel scope of their organization
  if (user.role === ROLES.WARDEN) {
    // If warden is bound to specific authorized hostels, check list
    if (user.authorizedHostels && user.authorizedHostels.length > 0 && complaint.hostelId) {
      const isAuthorized = user.authorizedHostels.some(
        (hid) => hid.toString() === complaint.hostelId.toString()
      )
      if (isAuthorized) return true
    }

    // Direct hostelId match
    if (user.hostelId && complaint.hostelId && user.hostelId.toString() === complaint.hostelId.toString()) {
      return true
    }

    // Name-based fallback match (case-insensitive)
    if (
      user.hostelName &&
      complaint.hostelName &&
      user.hostelName.trim().toLowerCase() === complaint.hostelName.trim().toLowerCase()
    ) {
      return true
    }

    // If warden has no specific hostel restriction within their organization, allow all within organization
    if (!user.hostelId && !user.hostelName && (!user.authorizedHostels || user.authorizedHostels.length === 0)) {
      return true
    }

    return false
  }

  // Staff can access complaints assigned to them
  if (user.role === ROLES.STAFF) {
    const assignedId = complaint.assignedTo && complaint.assignedTo.staffId
      ? complaint.assignedTo.staffId.toString()
      : null
    if (assignedId && assignedId === user._id.toString()) return true
    if (
      complaint.assignedTo?.staffName &&
      user.name &&
      complaint.assignedTo.staffName.trim().toLowerCase() === user.name.trim().toLowerCase()
    ) {
      return true
    }
    return false
  }

  // Student can only access complaints created by them
  if (user.role === ROLES.STUDENT) {
    const creatorId = complaint.createdBy ? complaint.createdBy.toString() : null
    return creatorId === user._id.toString()
  }

  return false
}

module.exports = {
  authorizeRoles,
  enforceTenantScope,
  canAccessComplaint,
}
