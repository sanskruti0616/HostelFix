const path = require("path")
const fs = require("fs")
const dotenv = require("dotenv")

// Load .env from backend folder or root workspace folder
const backendEnvPath = path.resolve(__dirname, "..", ".env")
const rootEnvPath = path.resolve(__dirname, "..", "..", ".env")

if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath })
}
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath })
}

// Fallback to default dotenv if neither matched explicitly
dotenv.config()
