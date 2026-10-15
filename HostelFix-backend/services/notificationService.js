const Notification = require("../models/Notification")
const { emitToUser, emitToRole } = require("./socketService")
const { ROLES } = require("../config/constants")

/**
 * Create and deliver a notification
 */
async function sendNotification({
  recipientUserId,
  complaintId,
  complaintNumber,
  type,
  title,
  message,
}) {
  try {
    const notification = await Notification.create({
      recipientUserId,
      complaintId,
      complaintNumber,
      type,
      title,
      message,
    })

    // Real-time dispatch via Socket.IO
    emitToUser(recipientUserId.toString(), "notification:new", notification)

    return notification
  } catch (err) {
    console.error("[NotificationService] Error creating notification:", err.message)
  }
}

/**
 * Notify wardens of a new complaint or urgent update
 */
async function notifyWardens({
  complaintId,
  complaintNumber,
  type,
  title,
  message,
}) {
  try {
    emitToRole(ROLES.WARDEN, "complaint:warden_alert", {
      complaintId,
      complaintNumber,
      type,
      title,
      message,
    })
  } catch (err) {
    console.error("[NotificationService] Error alerting wardens:", err.message)
  }
}

module.exports = {
  sendNotification,
  notifyWardens,
}
