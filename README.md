# HostelFix — Real-World Hostel Complaint and Maintenance Management System

HostelFix is a full-stack, enterprise-grade hostel complaint registration, AI-assisted verification, and maintenance workflow platform. It replaces hardcoded/synthetic prototypes with real MongoDB Atlas persistence, Google OAuth authentication, perceptual-hash duplicate image detection, multi-stage AI complaint validity assessment, real-time WebSocket notifications, and role-based access control (Student, Warden, Maintenance Staff, Administrator).

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│             HostelFix Frontend (React 19 + Vite)        │
│  - Google Identity Services (GSI) & JWT Session        │
│  - Multi-Image Drag-and-Drop & Live Previews           │
│  - Role Dashboards (Student, Warden, Staff, Admin)     │
│  - Real-Time WebSocket Alerts (Socket.IO Client)       │
└───────────────────────────┬────────────────────────────┘
                            │ REST APIs + WebSockets
┌───────────────────────────▼────────────────────────────┐
│          HostelFix Backend (Express 5 + Node.js)       │
│  - Security: Helmet, CORS Whitelist, Rate Limiting     │
│  - Auth: Google ID Token Verification + JWT Auth       │
│  - RBAC Middleware: Strict resource scoping per role   │
│  - Perceptual Hashing: 64-bit dHash Image Matching    │
│  - AI Pipeline: Multi-Stage Validity & Gemini Vision   │
│  - Cloud Storage: Cloudinary with Local Fallback       │
│  - Real-time: Socket.IO authenticated rooms            │
└───────────────────────────┬────────────────────────────┘
                            │ Mongoose ODM
┌───────────────────────────▼────────────────────────────┐
│                    MongoDB Atlas                       │
│  - users, complaints, complaintVerification            │
│  - assignments, complaintStatusHistory, notifications  │
│  - hostels, rooms, feedback                            │
└────────────────────────────────────────────────────────┘
```

---

## Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v26)
- **MongoDB Atlas** cluster (or local MongoDB)

### 2. Backend Setup
```bash
cd HostelFix-backend
npm install
npm test            # Run automated unit/integration test suite
npm run seed        # Seed initial hostels, rooms, and test accounts
npm run dev         # Starts server on http://localhost:5000
```

### 3. Frontend Setup
```bash
# In the project root (HostelFix)
npm install
npm run build       # Verify production compilation
npm run dev         # Starts Vite dev server on http://localhost:5173
```

---

## External Services Configuration

### 1. MongoDB Atlas Configuration
1. Log in to [MongoDB Atlas](https://cloud.mongodb.com/).
2. Under **Database Deployments**, click **Create a Cluster** (Free M0 tier).
3. Under **Security -> Database Access**, create a database user (e.g., `hostelfix_user`) with read/write privileges.
4. Under **Security -> Network Access**, click **Add IP Address** -> select **Allow Access from Anywhere** (`0.0.0.0/0`) or enter your server's IP address.
5. In your cluster view, click **Connect** -> **Connect your application** -> copy the connection string.
6. In `HostelFix-backend/.env`, set:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/hostelfix?retryWrites=true&w=majority
   MONGODB_DATABASE=hostelfix
   ```

### 2. Google OAuth 2.0 / Firebase Authentication
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project (e.g., `HostelFix`).
3. Navigate to **APIs & Services -> Credentials** -> click **Create Credentials** -> **OAuth client ID**.
4. Application Type: **Web Application**.
5. Add Authorized JavaScript origins:
   - `http://localhost:5173`
   - `http://127.0.0.1:5173`
   - Your production domain
6. Copy the generated **Client ID**.
7. In `HostelFix-backend/.env`:
   ```env
   GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   ```
8. In frontend `.env` (root directory):
   ```env
   VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   ```

### 3. Cloudinary Cloud Object Storage (Evidence Photographs)
1. Sign up or log in to [Cloudinary Console](https://cloudinary.com/).
2. From the Cloudinary Dashboard, copy:
   - **Cloud Name**
   - **API Key**
   - **API Secret**
3. In `HostelFix-backend/.env`:
   ```env
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```
*(Note: If Cloudinary credentials are not configured, HostelFix automatically uses secure backend local storage under `/uploads` so file uploads always succeed).*

### 4. Google Gemini AI Verification
1. Obtain an API key from [Google AI Studio](https://aistudio.google.com/).
2. In `HostelFix-backend/.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   ```
*(Note: If the Gemini key is omitted, HostelFix operates in high-accuracy deterministic heuristic mode with keyword NLP and perceptual hash comparison without failing or charging credit).*

---

## Role-Based Access Control (RBAC)

| Role | Permissions |
|---|---|
| **Student** | Submit complaints with photos, view own complaints, track timeline, submit 1–5 star resolution feedback. |
| **Warden** | View all complaints in authorized hostel scope, inspect AI evidence assessments & duplicate warnings, approve/reject/request info, assign maintenance staff, export CSV reports. |
| **Maintenance Staff** | View assigned repair tasks, change status (`in-progress`, `need-material`, `cannot-complete`, `resolved`), upload resolution photos and notes. |
| **Administrator** | Full operational view across all hostels, manage user roles, view infrastructure health metrics, configure hostels and rooms. |

---

## API Endpoints Reference

### Authentication & Users
- `POST /api/auth/google` — Sign in / register with Google ID token
- `POST /api/auth/login-dev` — Development role switcher login
- `GET /api/users/me` — Get current profile
- `PATCH /api/users/me` — Update current user details
- `GET /api/users/staff` — List active maintenance staff
- `GET /api/users` — List all users (Admin only)
- `PATCH /api/users/:id/role` — Update user role (Admin only)

### Complaints
- `GET /api/complaints` — Filtered complaints list (scoped by role)
- `POST /api/complaints` — File complaint (triggers AI verification)
- `GET /api/complaints/:id` — Complaint details, evidence, and verification
- `PATCH /api/complaints/:id/assign` — Assign maintenance staff
- `PATCH /api/complaints/:id/status` — Lifecycle transition with audit record
- `POST /api/complaints/:id/verify` — Warden approve / reject / request info
- `GET /api/complaints/:id/updates` — Chronological audit timeline
- `POST /api/complaints/:id/feedback` — Student 1–5 star feedback
- `GET /api/complaints/export/csv` — Export complaints to CSV

### Uploads & Evidence
- `POST /api/uploads` — Upload evidence images (validation, dHash, blur check)
- `POST /api/complaints/:id/resolution-evidence` — Technician resolution photos

### Notifications & Dashboards
- `GET /api/notifications` — User notifications list with unread count
- `PATCH /api/notifications/:id/read` — Mark notification read
- `GET /api/dashboard/student` — Student metrics & recent activity
- `GET /api/dashboard/warden` — Warden scoped metrics & category charts
- `GET /api/dashboard/maintenance` — Technician assigned workload
- `GET /api/dashboard/admin` — System-wide stats & infrastructure health
- `GET /api/health` — System health check
