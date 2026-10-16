const mongoose = require("mongoose")
require("./loadEnv")

let isConnected = false

function sanitizeMongoUri(rawUri) {
  if (!rawUri || typeof rawUri !== "string") return rawUri
  // Remove accidental angle brackets from <username>:<password> if user copy-pasted template
  return rawUri.replace(
    /^(mongodb(?:\+srv)?:\/\/)(<([^:>]+)>|([^:>]+)):(<([^@]+)>|([^@]+))@/i,
    (match, proto, u1, u2, u3, p1, p2, p3) => {
      const user = (u2 || u3 || "").trim()
      const pass = (p2 || p3 || "").trim()
      return `${proto}${user}:${pass}@`
    }
  )
}

let memoryServer = null

async function connectDB(customUri) {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection
  }

  const rawUri = customUri || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/hostelfix"
  const uri = sanitizeMongoUri(rawUri)
  const dbName = process.env.MONGODB_DATABASE || "hostelfix"

  try {
    const conn = await mongoose.connect(uri, {
      dbName,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })

    isConnected = true
    console.log(`[Database] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`)

    mongoose.connection.on("error", (err) => {
      console.error("[Database] Runtime connection error:", err.message)
    })

    mongoose.connection.on("disconnected", () => {
      console.warn("[Database] MongoDB disconnected. Attempting reconnect...")
      isConnected = false
    })

    return conn.connection
  } catch (error) {
    const isTlsAlert80 =
      error.message &&
      (error.message.includes("SSL alert number 80") ||
        error.message.includes("ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR"))

    if (isTlsAlert80) {
      console.warn(
        `[Database] Notice: MongoDB Atlas TLS rejected connection (SSL Alert 80). Current public IP is not in Atlas Network Access list.`
      )
    } else {
      console.error(`[Database] MongoDB connection failed: ${error.message}`)
    }

    // In test environment, fallback to MongoMemoryServer if remote Atlas rejects connection
    if (process.env.NODE_ENV === "test" || process.env.ALLOW_MEMORY_FALLBACK === "true") {
      try {
        console.log("[Database] Falling back to in-memory MongoDB for test execution...")
        const { MongoMemoryServer } = require("mongodb-memory-server")
        memoryServer = await MongoMemoryServer.create()
        const memUri = memoryServer.getUri()
        const conn = await mongoose.connect(memUri, { dbName: "hostelfix_test" })
        isConnected = true
        console.log(`[Database] In-memory MongoDB connected successfully for tests: ${memUri}`)
        return conn.connection
      } catch (memErr) {
        console.error("[Database] Memory server fallback failed:", memErr.message)
      }
    }

    throw error
  }
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
    isConnected = false
    console.log("[Database] Disconnected from MongoDB")
  }
  if (memoryServer) {
    await memoryServer.stop()
    memoryServer = null
    console.log("[Database] In-memory MongoDB stopped")
  }
}

module.exports = {
  connectDB,
  disconnectDB,
  mongoose,
}
