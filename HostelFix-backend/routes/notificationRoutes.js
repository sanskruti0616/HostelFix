const express = require("express")
const router = express.Router()
const Notification = require("../models/Notification")
const { authenticate } = require("../middleware/auth")

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for logged-in user
 * @access  Private
 */
router.get("/notifications", authenticate, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipientUserId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    const unreadCount = notifications.filter((n) => !n.readAt).length

    res.json({
      success: true,
      unreadCount,
      count: notifications.length,
      notifications: notifications.map((n) => ({
        id: n._id,
        complaintId: n.complaintId,
        complaintNumber: n.complaintNumber,
        type: n.type,
        title: n.title,
        message: n.message,
        read: Boolean(n.readAt),
        createdAt: n.createdAt,
      })),
    })
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load notifications" })
  }
})

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.patch("/notifications/:id/read", authenticate, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientUserId: req.user._id },
      { readAt: new Date() },
      { new: true }
    )

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" })
    }

    res.json({
      success: true,
      message: "Notification marked as read",
      notification: {
        id: notification._id,
        read: true,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update notification" })
  }
})

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all user's notifications as read
 * @access  Private
 */
router.patch("/notifications/read-all", authenticate, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipientUserId: req.user._id, readAt: null },
      { readAt: new Date() }
    )

    res.json({
      success: true,
      message: "All notifications marked as read",
    })
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update notifications" })
  }
})

module.exports = router
