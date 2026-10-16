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
  BarChart3,
  Building,
  ShieldAlert,
  Star,
  Users,
} from "lucide-react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import type { Complaint, User, AdminAnalyticsData } from "../types"
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
  const [activeTab, setActiveTab] = useState<"complaints" | "analytics" | "recurring" | "users" | "health">("complaints")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Admin user list state
  const [userList, setUserList] = useState<User[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [healthStatus, setHealthStatus] = useState<any>(null)
  const [analyticsData, setAnalyticsData] = useState<AdminAnalyticsData | null>(null)
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)

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

  // Load platform analytics when analytics or recurring tab is opened
  useEffect(() => {
    if (activeTab === "analytics" || activeTab === "recurring") {
      setIsLoadingAnalytics(true)
      setAnalyticsError(null)
      api.analytics
        .getAdmin()
        .then((res) => {
          if (res.success) setAnalyticsData(res)
        })
        .catch((err) => {
          console.error("Error loading admin analytics:", err)
          setAnalyticsError(err.message || "Failed to load platform analytics")
        })
        .finally(() => setIsLoadingAnalytics(false))
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
              onClick={() => setActiveTab("analytics")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: activeTab === "analytics" ? "#2563eb" : "white",
                color: activeTab === "analytics" ? "white" : "#475569",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <BarChart3 size={15} />
              Platform Analytics
            </button>

            <button
              onClick={() => setActiveTab("recurring")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: activeTab === "recurring" ? "#2563eb" : "white",
                color: activeTab === "recurring" ? "white" : "#475569",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <ShieldAlert size={15} />
              Recurring Issues
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

        {/* TAB: PLATFORM ANALYTICS */}
        {activeTab === "analytics" && (
          <section style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
            {isLoadingAnalytics ? (
              <div style={{ textAlign: "center", padding: "60px", background: "white", borderRadius: "18px", border: "1px solid #e7eaf0" }}>
                <RefreshCw size={32} className="animate-spin text-blue-600 mx-auto" />
                <p style={{ marginTop: "12px", color: "#64748b" }}>Loading platform analytics...</p>
              </div>
            ) : analyticsData ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Platform KPI Summary */}
                <div className="analytics-kpi-grid">
                  <div className="analytics-kpi-card">
                    <span className="analytics-kpi-label">Registered Hostels</span>
                    <div className="analytics-kpi-value-row">
                      <span className="analytics-kpi-value">{analyticsData.hostelOverview.totalHostels}</span>
                      <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: 700 }}>({analyticsData.hostelOverview.activeHostels} Active)</span>
                    </div>
                    <span className="analytics-kpi-subtext">Platform-wide</span>
                  </div>

                  <div className="analytics-kpi-card">
                    <span className="analytics-kpi-label">Total Complaints</span>
                    <div className="analytics-kpi-value-row">
                      <span className="analytics-kpi-value">{analyticsData.complaintOverview.totalComplaints}</span>
                      <span style={{ fontSize: "12px", color: "#d97706", fontWeight: 700 }}>({analyticsData.complaintOverview.openComplaints} Open)</span>
                    </div>
                    <span className="analytics-kpi-subtext">All registered properties</span>
                  </div>

                  <div className="analytics-kpi-card">
                    <span className="analytics-kpi-label">Platform Resolution Rate</span>
                    <div className="analytics-kpi-value-row">
                      <span className="analytics-kpi-value emerald">{analyticsData.complaintOverview.resolutionRate}%</span>
                    </div>
                    <span className="analytics-kpi-subtext" style={{ color: "#16a34a" }}>{analyticsData.complaintOverview.resolvedComplaints} resolved tickets</span>
                  </div>

                  <div className="analytics-kpi-card">
                    <span className="analytics-kpi-label">Avg Turnaround</span>
                    <div className="analytics-kpi-value-row">
                      <span className="analytics-kpi-value blue">{analyticsData.complaintOverview.avgResolutionHours}</span>
                      <span style={{ fontSize: "12px", color: "#2563eb", fontWeight: 700 }}>hrs</span>
                    </div>
                    <span className="analytics-kpi-subtext">Submission to resolution</span>
                  </div>
                </div>

                {/* Performance by Hostel Table */}
                <div className="analytics-chart-card">
                  <div className="analytics-chart-header">
                    <div>
                      <h3>
                        <Building size={18} color="#2563eb" />
                        Hostel Maintenance Performance
                      </h3>
                      <p>Aggregated resolution rate and complaint volume by hostel</p>
                    </div>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table className="analytics-table">
                      <thead>
                        <tr>
                          <th>Hostel</th>
                          <th style={{ textAlign: "center" }}>Total Complaints</th>
                          <th style={{ textAlign: "center" }}>Open</th>
                          <th style={{ textAlign: "center" }}>Resolved</th>
                          <th style={{ textAlign: "center" }}>Resolution Rate</th>
                          <th style={{ textAlign: "center" }}>Avg Turnaround</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyticsData.hostelPerformance.length > 0 ? (
                          analyticsData.hostelPerformance.map((h) => (
                            <tr key={h.hostelId || h.hostelName}>
                              <td style={{ fontWeight: 600, color: "#111827" }}>{h.hostelName}</td>
                              <td style={{ textAlign: "center", fontWeight: 600, color: "#374151" }}>{h.totalComplaints}</td>
                              <td style={{ textAlign: "center", color: "#d97706", fontWeight: 700 }}>{h.openComplaints}</td>
                              <td style={{ textAlign: "center", color: "#16a34a", fontWeight: 700 }}>{h.resolvedComplaints}</td>
                              <td style={{ textAlign: "center" }}>
                                <span style={{
                                  display: "inline-block",
                                  padding: "2px 8px",
                                  borderRadius: "999px",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  background: h.resolutionRate >= 70 ? "#dcfce7" : h.resolutionRate >= 40 ? "#fef3c7" : "#f1f5f9",
                                  color: h.resolutionRate >= 70 ? "#166534" : h.resolutionRate >= 40 ? "#92400e" : "#475569",
                                }}>
                                  {h.resolutionRate}%
                                </span>
                              </td>
                              <td style={{ textAlign: "center", color: "#64748b" }}>{h.avgResolutionHours} hrs</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "#94a3b8" }}>No hostel records available.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Category Distribution across Platform */}
                <div className="analytics-chart-card">
                  <div className="analytics-chart-header">
                    <div>
                      <h3>Platform Category Distribution</h3>
                      <p>Frequency of maintenance categories across all hostels</p>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
                    {analyticsData.categoryDistribution.map((cat) => (
                      <div key={cat.category} style={{ background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: "10px", padding: "12px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#374151", display: "block" }}>{cat.category}</span>
                        <div style={{ marginTop: "4px", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "18px", fontWeight: 800, color: "#111827" }}>{cat.count}</span>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "#2563eb" }}>({cat.percentage}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Additional Platform Indicators: Users & Ratings */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
                  {analyticsData.userOverview && (
                    <div className="analytics-chart-card">
                      <span className="analytics-kpi-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Users size={14} color="#2563eb" />
                        Platform Users &amp; Roles
                      </span>
                      <div className="analytics-kpi-value-row">
                        <span className="analytics-kpi-value">{analyticsData.userOverview.totalUsers}</span>
                        <span style={{ fontSize: "12px", color: "#7c3aed", fontWeight: 700 }}>({analyticsData.userOverview.students} Students)</span>
                      </div>
                      <span className="analytics-kpi-subtext" style={{ color: "#64748b" }}>
                        {analyticsData.userOverview.wardens} Wardens · {analyticsData.userOverview.staff} Maintenance Staff · {analyticsData.userOverview.admins} Administrators
                      </span>
                    </div>
                  )}

                  {analyticsData.ratingsOverview && (
                    <div className="analytics-chart-card">
                      <span className="analytics-kpi-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Star size={14} color="#f59e0b" />
                        Student Satisfaction &amp; Ratings
                      </span>
                      <div className="analytics-kpi-value-row">
                        <span className="analytics-kpi-value" style={{ color: "#d97706", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Star size={20} fill="#f59e0b" color="#f59e0b" />
                          {analyticsData.ratingsOverview.avgRating > 0 ? analyticsData.ratingsOverview.avgRating : "—"}
                        </span>
                        {analyticsData.ratingsOverview.avgRating > 0 && <span style={{ fontSize: "12px", color: "#64748b" }}>/ 5.0</span>}
                      </div>
                      <span className="analytics-kpi-subtext" style={{ color: "#64748b" }}>
                        {analyticsData.ratingsOverview.totalRated} rated complaints across platform
                      </span>
                    </div>
                  )}
                </div>

                {/* 30-Day Platform Trend Chart */}
                {analyticsData.platformTrend.length > 0 && (
                  <div className="analytics-chart-card">
                    <div className="analytics-chart-header">
                      <div>
                        <h3>30-Day Platform Trend</h3>
                        <p>Daily complaint volume across all properties</p>
                      </div>
                    </div>
                    <div className="analytics-chart-container" style={{ height: "240px", minHeight: "240px" }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analyticsData.platformTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7280" }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} />
                          <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e5e7eb", borderRadius: "0.5rem", fontSize: "0.75rem" }} />
                          <Line type="monotone" dataKey="submitted" name="Complaints" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "50px", background: "white", borderRadius: "18px", border: "1px solid #e7eaf0" }}>
                <p style={{ color: "#64748b" }}>{analyticsError || "Failed to load platform analytics."}</p>
                <button
                  onClick={() => {
                    setIsLoadingAnalytics(true)
                    api.analytics
                      .getAdmin()
                      .then((res) => { if (res.success) setAnalyticsData(res) })
                      .catch((err) => setAnalyticsError(err.message))
                      .finally(() => setIsLoadingAnalytics(false))
                  }}
                  className="preventive-schedule-btn"
                  style={{ marginTop: "12px", background: "#2563eb" }}
                >
                  Retry
                </button>
              </div>
            )}
          </section>
        )}

        {/* TAB: RECURRING ISSUES (PLATFORM OVERVIEW) */}
        {activeTab === "recurring" && (
          <section style={{ marginTop: "20px" }}>
            <div className="recurring-card">
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "#f5f3ff", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontWeight: 800, color: "#111827", fontSize: "18px" }}>Platform-Wide Recurring Maintenance Issues</h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                    Proactive detection of repeated maintenance complaints across all hostels to identify underlying infrastructure defects.
                  </p>
                </div>
              </div>

              {isLoadingAnalytics ? (
                <div className="recurring-empty-box" style={{ padding: "40px" }}>
                  <RefreshCw size={28} className="animate-spin text-blue-600 mx-auto" />
                  <p style={{ marginTop: "10px", color: "#64748b", fontSize: "13px" }}>Scanning platform recurring patterns...</p>
                </div>
              ) : analyticsError ? (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px", padding: "16px", textAlign: "center", margin: "16px 0" }}>
                  <p style={{ color: "#b91c1c", fontSize: "13px", fontWeight: 600, margin: 0 }}>{analyticsError}</p>
                </div>
              ) : analyticsData && analyticsData.recurringHotspots && analyticsData.recurringHotspots.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
                    <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: "12px", padding: "14px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#7c3aed", textTransform: "uppercase" }}>Hotspot Clusters</span>
                      <div style={{ fontSize: "24px", fontWeight: 800, color: "#581c87", marginTop: "4px" }}>{analyticsData.recurringHotspots.length}</div>
                      <span style={{ fontSize: "11px", color: "#7c3aed" }}>Locations with repeated reports</span>
                    </div>
                    <div style={{ background: "#fffdf5", border: "1px solid #fde68a", borderRadius: "12px", padding: "14px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#b45309", textTransform: "uppercase" }}>Review Window</span>
                      <div style={{ fontSize: "24px", fontWeight: 800, color: "#78350f", marginTop: "4px" }}>30 Days</div>
                      <span style={{ fontSize: "11px", color: "#b45309" }}>Rolling evaluation window</span>
                    </div>
                    <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "12px", padding: "14px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase" }}>Detection Mode</span>
                      <div style={{ fontSize: "24px", fontWeight: 800, color: "#1e3a8a", marginTop: "4px" }}>Automated</div>
                      <span style={{ fontSize: "11px", color: "#1d4ed8" }}>Room &amp; category clustering</span>
                    </div>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table className="analytics-table">
                      <thead>
                        <tr>
                          <th>Location</th>
                          <th>Category</th>
                          <th style={{ textAlign: "center" }}>Occurrences (30d)</th>
                          <th>Recent Complaints</th>
                          <th>Root Cause Investigation Suggestion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyticsData.recurringHotspots.map((h, idx) => (
                          <tr key={`${h.roomNumber}-${h.category}-${idx}`}>
                            <td style={{ fontWeight: 800, color: "#111827" }}>Room {h.roomNumber}</td>
                            <td>
                              <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, background: "#f1f5f9", color: "#475569" }}>
                                {h.category}
                              </span>
                            </td>
                            <td style={{ textAlign: "center", fontWeight: 800, color: "#be123c", fontSize: "14px" }}>
                              {h.complaintCount}
                            </td>
                            <td style={{ fontFamily: "monospace", fontSize: "11px", color: "#475569" }}>
                              {(h.complaintNumbers || []).slice(0, 4).join(", ")}
                            </td>
                            <td style={{ color: "#374151", maxWidth: "340px", lineHeight: 1.45 }}>
                              {h.suggestion}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="recurring-empty-box" style={{ padding: "40px 20px", marginTop: "16px" }}>
                  <ShieldCheck size={36} color="#10b981" style={{ marginBottom: "8px" }} />
                  <h4 style={{ margin: 0, fontWeight: 700, color: "#1f2937", fontSize: "15px" }}>No Recurring Issues Flagged</h4>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b", maxWidth: "420px" }}>
                    No room has logged multiple complaints in the same maintenance category within the rolling 30-day window.
                  </p>
                </div>
              )}
            </div>
          </section>
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