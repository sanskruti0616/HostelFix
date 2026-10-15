const mongoose = require("mongoose")
require("dotenv").config()

let isConnected = false

async function connectDB(customUri) {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection
  }

  const uri = customUri || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/hostelfix"
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
    console.error(`[Database] MongoDB connection failed: ${error.message}`)
    throw error
  }
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
    isConnected = false
    console.log("[Database] Disconnected from MongoDB")
  }
}

module.exports = {
  connectDB,
  disconnectDB,
  mongoose,
}
