const { Server } = require("socket.io")
const jwt = require("jsonwebtoken")
const { JWT_SECRET } = require("./authService")

let io = null

function initSocketIO(server, corsOrigin) {
  io = new Server(server, {
    cors: {
      origin: corsOrigin || true,
      credentials: true,
    },
    transports: ["websocket", "polling"],
  })

  // Socket authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token

    if (!token) {
      // Allow anonymous connection for health or public views if any, but don't join private rooms
      return next()
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      socket.user = decoded
      return next()
    } catch (err) {
      // Invalid token, proceed without user context
      return next()
    }
  })

  io.on("connection", (socket) => {
    if (socket.user) {
      // Join personal room
      socket.join(`user:${socket.user.id}`)

      // Join role room (e.g. role:warden, role:staff, role:admin)
      socket.join(`role:${socket.user.role}`)

      // Join hostel room
      if (socket.user.hostelId) {
        socket.join(`hostel:${socket.user.hostelId}`)
      }

      console.log(`[Socket] User ${socket.user.name} (${socket.user.role}) connected: ${socket.id}`)
    }

    socket.on("disconnect", () => {
      // cleanup handled automatically by Socket.IO
    })
  })

  return io
}

function getIO() {
  return io
}

/**
 * Emit event to a specific user
 */
function emitToUser(userId, event, data) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data)
  }
}

/**
 * Emit event to all users with a specific role
 */
function emitToRole(role, event, data) {
  if (io) {
    io.to(`role:${role}`).emit(event, data)
  }
}

/**
 * Broadcast event to all connected clients
 */
function broadcast(event, data) {
  if (io) {
    io.emit(event, data)
  }
}

module.exports = {
  initSocketIO,
  getIO,
  emitToUser,
  emitToRole,
  broadcast,
}
