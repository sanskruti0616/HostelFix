import React, { useState, useEffect } from "react"
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Users,
  RefreshCw,
  MapPin,
  PieChart as PieIcon,
  BarChart3,
  Calendar,
} from "lucide-react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts"
import { api } from "../services/api"
import type { WardenAnalyticsData } from "../types"

const CATEGORY_COLORS: Record<string, string> = {
  Electrical: "#f59e0b",
  Plumbing: "#0284c7",
  Internet: "#6366f1",
  Cleaning: "#10b981",
  Furniture: "#8b5cf6",
  "Water Supply": "#06b6d4",
  Security: "#ef4444",
  Other: "#6b7280",
}

const DEFAULT_COLORS = ["#7c3aed", "#2563eb", "#059669", "#d97706", "#dc2626", "#0891b2", "#8b5cf6"]

interface AnalyticsDashboardProps {
  hostelId?: string
  hostelName?: string
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ hostelId, hostelName }) => {
  const [data, setData] = useState<WardenAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [daysFilter, setDaysFilter] = useState<string>("30")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.analytics.getWarden({
        days: daysFilter,
        category: categoryFilter,
        status: statusFilter,
        hostelId,
      })
      if (res.success) {
        setData(res)
      } else {
        setError("Failed to load analytics data")
      }
    } catch (err: any) {
      console.error("[Analytics Dashboard] Fetch error:", err)
      setError(err.message || "Failed to load maintenance analytics.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [daysFilter, categoryFilter, statusFilter, hostelId])

  const summary = data?.summary || {
    totalComplaints: 0,
    newlySubmitted: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
    rejected: 0,
    overdue: 0,
    avgResolutionHours: 0,
    resolutionRate: 0,
    slaComplianceRate: 0,
    resolvedWithinSla: 0,
  }

  return (
    <div className="analytics-dashboard">
      {/* Dashboard Top Header & Filters */}
      <div className="analytics-header-card">
        <div className="analytics-header-top">
          <div className="analytics-title-group">
            <div className="analytics-title-icon">
              <BarChart3 size={24} />
            </div>
            <div>
              <h2>Maintenance Analytics</h2>
              <p>
                Data-driven insights for {hostelName || data?.filterApplied.hostel || "your hostel"}
              </p>
            </div>
          </div>

          {/* Quick Date Range Filters */}
          <div className="analytics-controls">
            <div className="analytics-range-group">
              <span className="analytics-range-label">
                <Calendar size={13} /> Range:
              </span>
              {[
                { label: "7 Days", value: "7" },
                { label: "30 Days", value: "30" },
                { label: "90 Days", value: "90" },
                { label: "All Time", value: "all" },
              ].map((r) => (
                <button
                  key={r.value}
                  onClick={() => setDaysFilter(r.value)}
                  className={`analytics-range-btn ${daysFilter === r.value ? "active" : ""}`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Dropdown Filters */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="analytics-select"
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="analytics-select"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="verified">Verified</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>

            <button
              onClick={fetchAnalytics}
              disabled={loading}
              title="Refresh analytics"
              className="analytics-refresh-btn"
            >
              <RefreshCw size={16} className={loading ? "animate-spin text-purple-600" : ""} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "12px 18px", borderRadius: "12px", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{error}</span>
          <button onClick={fetchAnalytics} style={{ textDecoration: "underline", fontSize: "12px", fontWeight: "bold", background: "none", border: "none", color: "#b91c1c", cursor: "pointer" }}>
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="analytics-kpi-grid">
        {/* Total */}
        <div className="analytics-kpi-card">
          <div className="analytics-kpi-header">
            <span className="analytics-kpi-label">Total Logged</span>
            <div className="analytics-kpi-icon purple">
              <FileText size={18} />
            </div>
          </div>
          <div className="analytics-kpi-value-row">
            <span className="analytics-kpi-value">{summary.totalComplaints}</span>
          </div>
          <span className="analytics-kpi-subtext">In selected period</span>
        </div>

        {/* Newly Submitted */}
        <div className="analytics-kpi-card">
          <div className="analytics-kpi-header">
            <span className="analytics-kpi-label">New / Unverified</span>
            <div className="analytics-kpi-icon blue">
              <Clock size={18} />
            </div>
          </div>
          <div className="analytics-kpi-value-row">
            <span className="analytics-kpi-value blue">{summary.newlySubmitted}</span>
          </div>
          <span className="analytics-kpi-subtext" style={{ color: "#2563eb" }}>Awaiting warden</span>
        </div>

        {/* In Progress */}
        <div className="analytics-kpi-card">
          <div className="analytics-kpi-header">
            <span className="analytics-kpi-label">In Progress</span>
            <div className="analytics-kpi-icon amber">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="analytics-kpi-value-row">
            <span className="analytics-kpi-value amber">{summary.inProgress}</span>
          </div>
          <span className="analytics-kpi-subtext" style={{ color: "#d97706" }}>Active technical work</span>
        </div>

        {/* Resolved & Rate */}
        <div className="analytics-kpi-card">
          <div className="analytics-kpi-header">
            <span className="analytics-kpi-label">Resolved</span>
            <div className="analytics-kpi-icon emerald">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="analytics-kpi-value-row">
            <span className="analytics-kpi-value emerald">{summary.resolved}</span>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#16a34a" }}>({summary.resolutionRate}%)</span>
          </div>
          <span className="analytics-kpi-subtext" style={{ color: "#16a34a" }}>Resolution rate</span>
        </div>

        {/* Overdue */}
        <div className="analytics-kpi-card">
          <div className="analytics-kpi-header">
            <span className="analytics-kpi-label">Overdue SLA</span>
            <div className={`analytics-kpi-icon ${summary.overdue > 0 ? "rose" : "gray"}`}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="analytics-kpi-value-row">
            <span className={`analytics-kpi-value ${summary.overdue > 0 ? "rose" : ""}`}>
              {summary.overdue}
            </span>
          </div>
          <span className="analytics-kpi-subtext">&gt; SLA threshold</span>
        </div>

        {/* Avg Resolution Time */}
        <div className="analytics-kpi-card">
          <div className="analytics-kpi-header">
            <span className="analytics-kpi-label">Avg Turnaround</span>
            <div className="analytics-kpi-icon purple">
              <Clock size={18} />
            </div>
          </div>
          <div className="analytics-kpi-value-row">
            <span className="analytics-kpi-value purple">{summary.avgResolutionHours}</span>
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#7c3aed" }}>hrs</span>
          </div>
          <span className="analytics-kpi-subtext">
            {summary.slaComplianceRate}% in &lt;48h
          </span>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="analytics-charts-grid">
        {/* Trend Over Time Line Chart */}
        <div className="analytics-chart-card">
          <div className="analytics-chart-header">
            <div>
              <h3>
                <TrendingUp size={18} color="#7c3aed" />
                Complaints Volume &amp; Resolution Trend
              </h3>
              <p>Daily submitted vs resolved complaints</p>
            </div>
          </div>

          {data?.trends && data.trends.length > 0 ? (
            <div className="analytics-chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickFormatter={(val) => {
                      if (!val) return ""
                      const parts = val.split("-")
                      return `${parts[1]}/${parts[2]}`
                    }}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderColor: "#e5e7eb",
                      borderRadius: "0.5rem",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      fontSize: "0.75rem",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "0.75rem", paddingTop: "0.5rem" }} />
                  <Line
                    type="monotone"
                    dataKey="submitted"
                    name="Submitted"
                    stroke="#7c3aed"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="resolved"
                    name="Resolved"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="analytics-empty-chart">
              <Calendar size={36} style={{ strokeWidth: 1.5, marginBottom: "8px" }} />
              <p style={{ fontSize: "14px", fontWeight: "600", color: "#64748b", margin: 0 }}>No trend data for selected time window</p>
              <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 0" }}>Submitted complaints will appear here</p>
            </div>
          )}
        </div>

        {/* Category Breakdown Chart */}
        <div className="analytics-chart-card">
          <div className="analytics-chart-header">
            <div>
              <h3>
                <PieIcon size={18} color="#7c3aed" />
                Complaint Category Distribution
              </h3>
              <p>Breakdown by maintenance type</p>
            </div>
          </div>

          {data?.categoryDistribution && data.categoryDistribution.length > 0 ? (
            <div className="analytics-pie-layout">
              <div className="analytics-chart-container" style={{ height: "230px", minHeight: "230px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.categoryDistribution}
                      dataKey="count"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {data.categoryDistribution.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CATEGORY_COLORS[entry.category] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any) => [`${value} complaints`, name]}
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        borderColor: "#e5e7eb",
                        borderRadius: "0.5rem",
                        fontSize: "0.75rem",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Category Breakdown Table */}
              <div className="analytics-pie-table">
                {data.categoryDistribution.map((cat, i) => (
                  <div key={cat.category} className="analytics-pie-row">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          display: "inline-block",
                          backgroundColor:
                            CATEGORY_COLORS[cat.category] || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
                        }}
                      />
                      <span style={{ fontWeight: 600, color: "#374151" }}>{cat.category}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#64748b" }}>
                      <span style={{ fontWeight: 600 }}>{cat.count}</span>
                      <span style={{ color: "#94a3b8", fontFamily: "monospace" }}>({cat.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="analytics-empty-chart">
              <PieIcon size={36} style={{ strokeWidth: 1.5, marginBottom: "8px" }} />
              <p style={{ fontSize: "14px", fontWeight: "600", color: "#64748b", margin: 0 }}>No complaints in selected period</p>
            </div>
          )}
        </div>
      </div>

      {/* Second Row: Location Hotspots & Staff Workload */}
      <div className="analytics-charts-grid">
        {/* Room / Location Hotspot Analysis */}
        <div className="analytics-chart-card">
          <div className="analytics-chart-header">
            <div>
              <h3>
                <MapPin size={18} color="#7c3aed" />
                Room &amp; Location Analysis
              </h3>
              <p>Rooms with the highest frequency of complaints</p>
            </div>
          </div>

          {data?.locationHotspots && data.locationHotspots.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {data.locationHotspots.slice(0, 6).map((loc) => {
                return (
                  <div key={loc.roomNumber} className="analytics-hotspot-item">
                    <div className="analytics-hotspot-header">
                      <span>Room {loc.roomNumber}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ color: "#64748b", fontSize: "12px", fontWeight: 500 }}>
                          {loc.count} complaints ({loc.resolvedCount} resolved)
                        </span>
                        {loc.count >= 2 && (
                          <span style={{ background: "#fef3c7", color: "#92400e", fontSize: "10px", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }}>
                            Repeat Site
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="analytics-progress-track" style={{ display: "flex" }}>
                      <div
                        style={{
                          background: "#10b981",
                          height: "100%",
                          width: `${loc.count > 0 ? (loc.resolvedCount / loc.count) * 100 : 0}%`,
                          transition: "width 0.3s ease",
                        }}
                      />
                      <div
                        style={{
                          background: "#f59e0b",
                          height: "100%",
                          width: `${loc.count > 0 ? (loc.pendingCount / loc.count) * 100 : 0}%`,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                      {loc.categories.map((cat) => (
                        <span
                          key={cat}
                          style={{
                            fontSize: "10px",
                            background: "#f5f3ff",
                            color: "#7c3aed",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            fontWeight: 600,
                          }}
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="analytics-empty-chart" style={{ height: "200px" }}>
              <MapPin size={36} style={{ strokeWidth: 1.5, marginBottom: "8px" }} />
              <p style={{ fontSize: "14px", fontWeight: "600", color: "#64748b", margin: 0 }}>No location data available</p>
            </div>
          )}
        </div>

        {/* Staff Workload Analysis */}
        <div className="analytics-chart-card">
          <div className="analytics-chart-header">
            <div>
              <h3>
                <Users size={18} color="#7c3aed" />
                Maintenance Staff Workload
              </h3>
              <p>Task assignments and active technical distribution</p>
            </div>
          </div>

          {data?.staffWorkload && data.staffWorkload.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Technician</th>
                    <th style={{ textAlign: "center" }}>Assigned</th>
                    <th style={{ textAlign: "center" }}>In Progress</th>
                    <th style={{ textAlign: "center" }}>Resolved</th>
                    <th style={{ textAlign: "center" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.staffWorkload.map((staff) => (
                    <tr key={staff.staffId}>
                      <td>
                        <div style={{ fontWeight: 600, color: "#111827" }}>{staff.staffName}</div>
                        <div style={{ fontSize: "10px", color: "#9ca3af" }}>{staff.specialization}</div>
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 600, color: "#374151" }}>
                        {staff.assignedCount}
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 700, color: "#d97706" }}>
                        {staff.inProgressCount}
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 700, color: "#16a34a" }}>
                        {staff.resolvedInPeriodCount}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "999px",
                            fontSize: "10px",
                            fontWeight: 700,
                            background: staff.pendingCount > 3 ? "#fef3c7" : staff.pendingCount > 0 ? "#eff6ff" : "#f0fdf4",
                            color: staff.pendingCount > 3 ? "#92400e" : staff.pendingCount > 0 ? "#1d4ed8" : "#166534",
                          }}
                        >
                          {staff.pendingCount > 3 ? "High Load" : staff.pendingCount > 0 ? "Active" : "Available"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="analytics-empty-chart" style={{ height: "200px" }}>
              <Users size={36} style={{ strokeWidth: 1.5, marginBottom: "8px" }} />
              <p style={{ fontSize: "14px", fontWeight: "600", color: "#64748b", margin: 0 }}>No staff members assigned to this hostel</p>
              <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 0" }}>Add staff accounts under Staff Management</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
export default AnalyticsDashboard
