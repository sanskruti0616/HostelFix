import { io, Socket } from "socket.io-client"
import { getStoredToken } from "./api"

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const token = getStoredToken()
    socket = io(API_BASE_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })

    socket.on("connect", () => {
      console.log("[Socket] Connected to real-time server:", socket?.id)
    })

    socket.on("connect_error", (err) => {
      console.warn("[Socket] Real-time connection error:", err.message)
    })
  }
  return socket
}

export function updateSocketAuth() {
  if (socket) {
    const token = getStoredToken()
    socket.auth = { token }
    socket.disconnect().connect()
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
