import { useState, useMemo } from "react"
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Download,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react"
import type {
  Complaint,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  User,
} from "../types"
import { api } from "../services/api"

interface WardenDashboardProps {
  currentUser: User
  complaints: Complaint[]
  onLogout: () => void
  onViewComplaint: (complaint: Complaint) => void
  onRefresh?: () => void
}

export default function WardenDashboard({
  currentUser,
  complaints,
  onLogout,
  onViewComplaint,
  onRefresh,
}: WardenDashboardProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | "all">("all")
  const [categoryFilter, setCategoryFilter] = useState<ComplaintCategory | "all">("all")
  const [priorityFilter, setPriorityFilter] = useState<ComplaintPriority | "all">("all")

  // Real database metrics computed from complaints
  const totalComplaints = complaints.length

  const awaitingVerification = complaints.filter(
    (c) => c.status === "submitted" || c.status === "pending_verification"
  ).length

  const awaitingAssignment = complaints.filter(
    (c) => c.status === "verified"
  ).length

  const inProgressComplaints = complaints.filter(
    (c) =>
      c.status === "assigned" ||
      c.status === "in-progress" ||
      c.status === "need-material"
  ).length

  const resolvedComplaints = complaints.filter(
    (c) => c.status === "resolved" || c.status === "closed"
  ).length

  // Filter complaints
  const filteredComplaints = useMemo(() => {
    return complaints.filter((complaint) => {
      const term = searchTerm.toLowerCase().trim()
      const matchesSearch =
        !term ||
        complaint.title.toLowerCase().includes(term) ||
        complaint.studentName.toLowerCase().includes(term) ||
        complaint.id.toLowerCase().includes(term) ||
        complaint.room.toLowerCase().includes(term)

      const matchesStatus =
        statusFilter === "all" || complaint.status === statusFilter

      const matchesCategory =
        categoryFilter === "all" || complaint.category === categoryFilter

      const matchesPriority =
        priorityFilter === "all" || complaint.priority === priorityFilter

      return matchesSearch && matchesStatus && matchesCategory && matchesPriority
    })
  }, [complaints, searchTerm, statusFilter, categoryFilter, priorityFilter])

  const handleExportCsv = () => {
    window.open(api.complaints.getExportCsvUrl(), "_blank")
  }

  return (
    <div className="dashboard-page">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-brand">
          <div className="brand-icon">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2>HostelFix</h2>
            <span>
              Warden Portal · {currentUser.organizationName ? `${currentUser.organizationName} · ` : ""}{currentUser.hostel || "All Hostels"}
            </span>
          </div>
        </div>

        <div className="header-user">
          {onRefresh && (
            <button
              className="header-logout"
              onClick={onRefresh}
              title="Refresh"
              style={{ marginRight: "12px" }}
            >
              <RefreshCw size={18} />
            </button>
          )}

          <button
            className="header-logout"
            onClick={handleExportCsv}
            title="Export CSV"
            style={{ marginRight: "12px" }}
          >
            <Download size={18} />
          </button>

          <div className="user-avatar">
            {currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : "WA"}
          </div>

          <div className="header-user-info">
            <strong>{currentUser.name}</strong>
            <span>Warden</span>
          </div>

          <button className="header-logout" onClick={onLogout} title="Logout">
            <LogOut size={19} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Welcome Section */}
        <section className="welcome-section">
          <div>
            <p className="eyebrow">
              <Building2 size={15} />
              WARDEN DASHBOARD
            </p>
            <h1>Welcome, {currentUser.name} 👋</h1>
            <p>
              Monitor, verify, and assign maintenance issues in {currentUser.hostel || "your hostel scope"}.
            </p>
          </div>

          <div className="welcome-date" style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={handleExportCsv}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                background: "white",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              <Download size={16} /> Export Reports (CSV)
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
              <span className="stat-label">Total in Scope</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-pending">
              <Sparkles size={22} />
            </div>
            <div>
              <span className="stat-value">{awaitingVerification}</span>
              <span className="stat-label">Needs Verification</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-progress">
              <Wrench size={22} />
            </div>
            <div>
              <span className="stat-value">{awaitingAssignment}</span>
              <span className="stat-label">Ready for Assignment</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-progress">
              <Clock3 size={22} />
            </div>
            <div>
              <span className="stat-value">{inProgressComplaints}</span>
              <span className="stat-label">Active Work</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-resolved">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <span className="stat-value">{resolvedComplaints}</span>
              <span className="stat-label">Resolved</span>
            </div>
          </div>
        </section>

        {/* Filter Bar */}
        <section className="filters-section" style={{ margin: "24px 0" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              background: "white",
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              alignItems: "center",
            }}
          >
            <div style={{ flex: 1, minWidth: "220px", position: "relative" }}>
              <Search
                size={18}
                style={{ position: "absolute", left: "12px", top: "11px", color: "#94a3b8" }}
              />
              <input
                type="text"
                placeholder="Search by ID, title, student, room..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px 9px 38px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
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
                <option value="pending_verification">Pending Verification</option>
                <option value="verified">Verified</option>
                <option value="assigned">Assigned</option>
                <option value="in-progress">In Progress</option>
                <option value="need-material">Need Material</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                style={{
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                  background: "white",
                }}
              >
                <option value="all">All Categories</option>
                <option value="Electrical">Electrical</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Internet">Internet</option>
                <option value="Cleaning">Cleaning</option>
                <option value="Furniture">Furniture</option>
                <option value="Water Supply">Water Supply</option>
                <option value="Security">Security</option>
                <option value="Other">Other</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                style={{
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                  background: "white",
                }}
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
        </section>

        {/* Complaints Table/List */}
        <section className="complaints-section">
          {filteredComplaints.length > 0 ? (
            <div className="complaints-list">
              {filteredComplaints.map((complaint) => (
                <div
                  key={complaint.id}
                  className="complaint-row"
                  onClick={() => onViewComplaint(complaint)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onViewComplaint(complaint)
                  }}
                >
                  <div className="complaint-main">
                    <div className="complaint-top">
                      <span className="complaint-id">{complaint.id}</span>
                      <span className={`status-badge status-${complaint.status}`}>
                        {complaint.status.replace("-", " ").replace("_", " ")}
                      </span>
                      <span className={`priority-badge priority-${complaint.priority}`}>
                        {complaint.priority}
                      </span>
                      {complaint.verification && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            fontWeight: 600,
                            background:
                              complaint.verification.result === "verified"
                                ? "#dcfce7"
                                : complaint.verification.result === "potential_duplicate"
                                ? "#fee2e2"
                                : "#fef9c3",
                            color:
                              complaint.verification.result === "verified"
                                ? "#166534"
                                : complaint.verification.result === "potential_duplicate"
                                ? "#991b1b"
                                : "#854d0e",
                          }}
                        >
                          <Sparkles size={12} />
                          AI: {(complaint.verification.result || "pending").replace("_", " ")}
                        </span>
                      )}
                    </div>

                    <h3>{complaint.title}</h3>
                    <p>{complaint.description}</p>

                    <div className="complaint-meta">
                      <span>👤 {complaint.studentName}</span>
                      <span>🏠 Room {complaint.room}</span>
                      <span>🏷️ {complaint.category}</span>
                      <span>📅 {complaint.createdAt}</span>
                      {complaint.assignedStaff ? (
                        <span>🔧 Staff: {complaint.assignedStaff}</span>
                      ) : (
                        <span style={{ color: "#d97706", fontWeight: 600 }}>⚠️ Unassigned</span>
                      )}
                    </div>
                  </div>

                  <span className="complaint-arrow">
                    <ChevronRight size={20} />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                background: "white",
                borderRadius: "16px",
                border: "1px solid #e2e8f0",
              }}
            >
              <ClipboardList size={38} color="#94a3b8" style={{ marginBottom: "12px" }} />
              <h3 style={{ margin: "0 0 6px", color: "#1e293b", fontSize: "18px" }}>
                No complaints found
              </h3>
              <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
                {complaints.length === 0
                  ? "No complaints have been reported in your hostel yet."
                  : "No complaints match the selected search or filter criteria."}
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}