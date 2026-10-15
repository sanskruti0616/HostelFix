import { useMemo, useState, useEffect } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Database,
  Download,
  LogOut,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react"
import type { Complaint, User } from "../types"
import { api } from "../services/api"

interface AdminDashboardProps {
  currentUser: User
  complaints?: Complaint[]
  onLogout: () => void
  onViewComplaint: (complaint: Complaint) => void
  onRefresh?: () => void
}

export default function AdminDashboard({
  currentUser,
  complaints = [],
  onLogout,
  onViewComplaint,
  onRefresh,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<"complaints" | "users" | "health">("complaints")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Admin user list state
  const [userList, setUserList] = useState<User[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [healthStatus, setHealthStatus] = useState<any>(null)

  const safeComplaints = Array.isArray(complaints) ? complaints : []

  const totalComplaints = safeComplaints.length
  const activeComplaints = safeComplaints.filter(
    (c) => c.status !== "resolved" && c.status !== "closed" && c.status !== "rejected"
  ).length
  const resolvedComplaints = safeComplaints.filter(
    (c) => c.status === "resolved" || c.status === "closed"
  ).length
  const urgentComplaints = safeComplaints.filter((c) => c.priority === "urgent").length

  // Load system health
  useEffect(() => {
    api.checkHealth()
      .then((data) => setHealthStatus(data))
      .catch((err) => console.warn("Failed health check:", err))
  }, [])

  // Load users when users tab is opened
  useEffect(() => {
    if (activeTab === "users") {
      setIsLoadingUsers(true)
      api.auth.getAllUsers()
        .then((res) => setUserList(res.users))
        .catch((err) => console.error("Error loading users:", err))
        .finally(() => setIsLoadingUsers(false))
    }
  }, [activeTab])

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.auth.updateUserRole(userId, newRole)
      setUserList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole as any } : u))
      )
      alert("User role updated successfully")
    } catch (err: any) {
      alert(err.message || "Failed to update role")
    }
  }

  const filteredComplaints = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return safeComplaints.filter((c) => {
      const matchesSearch =
        !query ||
        c.id.toLowerCase().includes(query) ||
        c.title.toLowerCase().includes(query) ||
        c.studentName.toLowerCase().includes(query) ||
        c.room.toLowerCase().includes(query) ||
        c.category.toLowerCase().includes(query)

      const matchesStatus = statusFilter === "all" || c.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [safeComplaints, searchTerm, statusFilter])

  return (
    <div className="dashboard-page">
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <div className="dashboard-logo">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="dashboard-title">HostelFix</h1>
            <p className="dashboard-subtitle">
              Administrator Control Center {currentUser.organizationName ? `· ${currentUser.organizationName}` : ""}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {onRefresh && (
            <button className="dashboard-logout" onClick={onRefresh} title="Refresh">
              <RefreshCw size={17} />
            </button>
          )}

          <button
            className="dashboard-logout"
            onClick={() => window.open(api.complaints.getExportCsvUrl(), "_blank")}
            title="Export CSV"
          >
            <Download size={17} /> Export Data
          </button>

          <button className="dashboard-logout" onClick={onLogout}>
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Welcome Section */}
        <section className="welcome-section">
          <div>
            <p className="welcome-date">SYSTEM OVERVIEW</p>
            <h2>Welcome, {currentUser.name} 👋</h2>
            <p>Full operational governance, real-time metrics, user access, and infrastructure health.</p>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <button
              onClick={() => setActiveTab("complaints")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: activeTab === "complaints" ? "#2563eb" : "white",
                color: activeTab === "complaints" ? "white" : "#475569",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            >
              Complaints Management
            </button>

            <button
              onClick={() => setActiveTab("users")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: activeTab === "users" ? "#2563eb" : "white",
                color: activeTab === "users" ? "white" : "#475569",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            >
              User Access & Roles
            </button>

            <button
              onClick={() => setActiveTab("health")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: activeTab === "health" ? "#2563eb" : "white",
                color: activeTab === "health" ? "white" : "#475569",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            >
              Infrastructure Health
            </button>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon stat-total">
              <ClipboardList size={22} />
            </div>
            <div>
              <span className="stat-value">{totalComplaints}</span>
              <span className="stat-label">Total Operational Records</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-progress">
              <Wrench size={22} />
            </div>
            <div>
              <span className="stat-value">{activeComplaints}</span>
              <span className="stat-label">Active Work Items</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-resolved">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <span className="stat-value">{resolvedComplaints}</span>
              <span className="stat-label">Resolved / Closed</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-pending">
              <AlertTriangle size={22} />
            </div>
            <div>
              <span className="stat-value">{urgentComplaints}</span>
              <span className="stat-label">Urgent Escalations</span>
            </div>
          </div>
        </section>

        {/* TAB 1: COMPLAINTS */}
        {activeTab === "complaints" && (
          <>
            <div style={{ margin: "20px 0", display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <Search size={18} style={{ position: "absolute", left: "12px", top: "11px", color: "#94a3b8" }} />
                <input
                  type="text"
                  placeholder="Search across all complaints..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px 9px 38px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    background: "white",
                  }}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                  background: "white",
                }}
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="verified">Verified</option>
                <option value="assigned">Assigned</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <section className="complaints-section">
              {filteredComplaints.length > 0 ? (
                <div className="complaints-list">
                  {filteredComplaints.map((c) => (
                    <div
                      key={c.id}
                      className="complaint-row"
                      onClick={() => onViewComplaint(c)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="complaint-main">
                        <div className="complaint-top">
                          <span className="complaint-id">{c.id}</span>
                          <span className={`status-badge status-${c.status}`}>
                            {c.status.replace("-", " ").replace("_", " ")}
                          </span>
                          <span className={`priority-badge priority-${c.priority}`}>{c.priority}</span>
                          {c.verification && (
                            <span style={{ fontSize: "12px", color: "#64748b" }}>
                              AI: {c.verification.result} ({Math.round((c.verification.confidence || 0) * 100)}%)
                            </span>
                          )}
                        </div>

                        <h3>{c.title}</h3>
                        <p>{c.description}</p>

                        <div className="complaint-meta">
                          <span>👤 {c.studentName}</span>
                          <span>🏢 {c.hostel} · Room {c.room}</span>
                          <span>🏷️ {c.category}</span>
                          {c.assignedStaff && <span>🔧 Technician: {c.assignedStaff}</span>}
                        </div>
                      </div>

                      <span className="complaint-arrow">
                        <ChevronRight size={20} />
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "50px", background: "white", borderRadius: "12px" }}>
                  <ClipboardList size={36} color="#94a3b8" />
                  <p style={{ marginTop: "10px", color: "#64748b" }}>No complaints found.</p>
                </div>
              )}
            </section>
          </>
        )}

        {/* TAB 2: USERS */}
        {activeTab === "users" && (
          <section style={{ background: "white", borderRadius: "12px", padding: "20px", marginTop: "20px" }}>
            <h3 style={{ margin: "0 0 16px" }}>Authorized Users & Role Provisioning</h3>
            {isLoadingUsers ? (
              <p>Loading users...</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                    <th style={{ padding: "10px" }}>Name</th>
                    <th style={{ padding: "10px" }}>Email</th>
                    <th style={{ padding: "10px" }}>Assigned Hostel/Room</th>
                    <th style={{ padding: "10px" }}>Current Role</th>
                    <th style={{ padding: "10px" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {userList.map((user) => (
                    <tr key={user.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px 10px", fontWeight: 600 }}>{user.name}</td>
                      <td style={{ padding: "12px 10px", color: "#64748b" }}>{user.email}</td>
                      <td style={{ padding: "12px 10px" }}>
                        {user.hostel || "—"} {user.room ? `· Room ${user.room}` : ""}
                      </td>
                      <td style={{ padding: "12px 10px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            fontWeight: 600,
                            background:
                              user.role === "admin"
                                ? "#fee2e2"
                                : user.role === "warden"
                                ? "#fef3c7"
                                : user.role === "staff"
                                ? "#e0e7ff"
                                : "#dcfce7",
                            color:
                              user.role === "admin"
                                ? "#991b1b"
                                : user.role === "warden"
                                ? "#92400e"
                                : user.role === "staff"
                                ? "#3730a3"
                                : "#166534",
                          }}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td style={{ padding: "12px 10px" }}>
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            fontSize: "13px",
                          }}
                        >
                          <option value="student">Student</option>
                          <option value="warden">Warden</option>
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {/* TAB 3: INFRASTRUCTURE HEALTH */}
        {activeTab === "health" && (
          <section style={{ background: "white", borderRadius: "12px", padding: "24px", marginTop: "20px" }}>
            <h3 style={{ margin: "0 0 16px" }}>HostelFix System Services Status</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
              <div style={{ padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <Database size={20} color="#2563eb" />
                  <strong>Database (MongoDB Atlas)</strong>
                </div>
                <p style={{ margin: 0, fontSize: "14px", color: healthStatus?.database?.connected ? "#16a34a" : "#dc2626" }}>
                  ● {healthStatus?.database?.connected ? "Connected & Synchronized" : "Disconnected / Degraded"}
                </p>
                <small style={{ color: "#64748b" }}>Database Name: {healthStatus?.database?.name || "hostelfix"}</small>
              </div>

              <div style={{ padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <Server size={20} color="#2563eb" />
                  <strong>Cloud Object Storage</strong>
                </div>
                <p style={{ margin: 0, fontSize: "14px", color: "#16a34a" }}>
                  ● Provider: {healthStatus?.cloudStorage?.provider === "cloudinary" ? "Cloudinary (Cloud Storage)" : "Local Secure Fallback (/uploads)"}
                </p>
                <small style={{ color: "#64748b" }}>
                  {healthStatus?.cloudStorage?.configured ? "Cloud credentials active" : "Using local upload fallback"}
                </small>
              </div>

              <div style={{ padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <Sparkles size={20} color="#2563eb" />
                  <strong>AI Complaint Verification</strong>
                </div>
                <p style={{ margin: 0, fontSize: "14px", color: "#16a34a" }}>
                  ● Mode: {healthStatus?.aiProvider?.mode === "gemini_vision" ? "Google Gemini Vision AI" : "Heuristic NLP & Perceptual Hashing"}
                </p>
                <small style={{ color: "#64748b" }}>Multi-stage consistency & duplicate detector active</small>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}