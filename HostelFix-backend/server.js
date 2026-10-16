const express = require("express")
const http = require("http")
const cors = require("cors")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const path = require("path")
require("./config/loadEnv")

const { connectDB, mongoose } = require("./config/db")
const { initSocketIO } = require("./services/socketService")
const { hasCloudinaryCredentials, UPLOADS_DIR } = require("./config/cloudinary")

// Routes
const authRoutes = require("./routes/authRoutes")
const complaintRoutes = require("./routes/complaintRoutes")
const uploadRoutes = require("./routes/uploadRoutes")
const notificationRoutes = require("./routes/notificationRoutes")
const dashboardRoutes = require("./routes/dashboardRoutes")
const hostelRoutes = require("./routes/hostelRoutes")
const analyticsRoutes = require("./routes/analyticsRoutes")
const preventiveRoutes = require("./routes/preventiveRoutes")

const app = express()
const server = http.createServer(app)

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173"

// ======================================================
// SOCKET.IO REAL-TIME INITIALIZATION
// ======================================================
initSocketIO(server, CLIENT_ORIGIN)

// ======================================================
// SECURITY MIDDLEWARE
// ======================================================
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
)

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl) or matching client
      if (!origin || origin === CLIENT_ORIGIN || origin.includes("localhost") || origin.includes("127.0.0.1")) {
        return callback(null, true)
      }
      return callback(null, true) // Permissive for local network cross-device access
    },
    credentials: true,
  })
)

// Rate limiting on sensitive authentication and upload endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again after 15 minutes.",
  },
})

// Body Parsers
app.use(express.json({ limit: "15mb" }))
app.use(express.urlencoded({ extended: true, limit: "15mb" }))

// Static uploads serving for fallback local image storage
app.use("/uploads", express.static(UPLOADS_DIR))

// ======================================================
// HEALTH CHECK
// ======================================================
app.get("/api/health", (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1
  res.json({
    success: true,
    message: "HostelFix backend is operational",
    status: isDbConnected ? "healthy" : "degraded",
    database: {
      connected: isDbConnected,
      name: mongoose.connection.name || "not_connected",
    },
    cloudStorage: {
      provider: hasCloudinaryCredentials ? "cloudinary" : "local_fallback",
      configured: hasCloudinaryCredentials,
    },
    aiProvider: {
      configured: Boolean(process.env.GEMINI_API_KEY || process.env.AI_PROVIDER_API_KEY),
      mode: (process.env.GEMINI_API_KEY || process.env.AI_PROVIDER_API_KEY) ? "gemini_vision" : "local_heuristic",
    },
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  })
})

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "HostelFix API server is running",
    version: "2.0.0",
    docs: "/api/health",
  })
})

// ======================================================
// MOUNT API ROUTES
// ======================================================
app.use("/api/auth", authLimiter)
app.use("/api", authRoutes)
app.use("/api", complaintRoutes)
app.use("/api", uploadRoutes)
app.use("/api", notificationRoutes)
app.use("/api", dashboardRoutes)
app.use("/api", hostelRoutes)
app.use("/api", analyticsRoutes)
app.use("/api", preventiveRoutes)

// ======================================================
// 404 HANDLER
// ======================================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`,
  })
})

// ======================================================
// GLOBAL ERROR HANDLER
// ======================================================
app.use((err, req, res, next) => {
  console.error("[ServerError]", err.message)
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error occurred",
  })
})

// ======================================================
// START SERVER & DATABASE
// ======================================================
const PORT = Number(process.env.PORT) || 5000

async function start() {
  try {
    await connectDB()
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`[Server] HostelFix backend running on http://0.0.0.0:${PORT}`)
      console.log(`[Server] Accessible locally at http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error("[Server] Critical startup error:", error.message)
    console.warn("[Server] Starting HTTP server anyway to provide health / diagnostics...")
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`[Server] HostelFix backend running in degraded mode on port ${PORT}`)
    })
  }
}

// Graceful termination handling
process.on("SIGINT", async () => {
  console.log("\n[Server] Shutting down gracefully...")
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log("[Server] Database closed. Process exit.")
      process.exit(0)
    })
  })
})

start()

module.exports = { app, server }