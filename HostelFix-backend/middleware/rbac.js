const { ROLES } = require("../config/constants")

/**
 * Restrict endpoint access to specific roles
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthenticated request",
      })
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to [${allowedRoles.join(", ")}]. Current role is '${req.user.role}'.`,
      })
    }

    next
    ()
  }
}

/**
 * Verify access permission for a complaint resource based on role & scope
 */
function canAccessComplaint(user, complaint) {
  if (!user || !complaint) return false

  // Admin has universal access
  if (user.role === ROLES.ADMIN) return true

  // Warden can access complaints in their hostel (or any hostel if no specific hostel is bound)
  if (user.role === ROLES.WARDEN) {
    if (!user.hostelId && !user.hostelName) return true
    if (user.hostelId && complaint.hostelId && user.hostelId.toString() === complaint.hostelId.toString()) return true
    if (user.hostelName && complaint.hostelName && user.hostelName.toLowerCase() === complaint.hostelName.toLowerCase()) return true
    return false
  }

  // Staff can only access complaints assigned to them
  if (user.role === ROLES.STAFF) {
    const assignedId = complaint.assignedTo && complaint.assignedTo.staffId
      ? complaint.assignedTo.staffId.toString()
      : null
    return assignedId === user._id.toString()
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
  canAccessComplaint,
}
