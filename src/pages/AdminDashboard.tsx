
import { useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  LogOut,
  Search,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react"

import type { Complaint } from "../types"

interface AdminDashboardProps {
  complaints?: Complaint[]
  onLogout: () => void
  onViewComplaint: (complaint: Complaint) => void
}

type StatusFilter =
  | "all"
  | "submitted"
  | "assigned"
  | "in-progress"
  | "need-material"
  | "cannot-complete"
  | "resolved"
  | "rejected"

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    submitted: "Submitted",
    assigned: "Assigned",
    "in-progress": "In Progress",
    "need-material": "Need Material",
    "cannot-complete": "Can't Complete",
    resolved: "Resolved",
    rejected: "Rejected",
  }

  return labels[status] || status
}

function getStatusClass(status: string) {
  return `admin-status ${status}`
}

function getPriorityClass(priority: string) {
  return `admin-priority ${priority}`
}

function AdminDashboard({
  complaints = [],
  onLogout,
  onViewComplaint,
}: AdminDashboardProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all")

  // Always work with an array, even if the prop is missing.
  const safeComplaints = Array.isArray(complaints)
    ? complaints
    : []

  const totalComplaints = safeComplaints.length

  const activeComplaints = safeComplaints.filter(
    (complaint) =>
      complaint.status !== "resolved" &&
      complaint.status !== "rejected"
  ).length

  const resolvedComplaints = safeComplaints.filter(
    (complaint) => complaint.status === "resolved"
  ).length

  const urgentComplaints = safeComplaints.filter(
    (complaint) => complaint.priority === "urgent"
  ).length

  const filteredComplaints = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return safeComplaints.filter((complaint) => {
      const matchesSearch =
        !normalizedSearch ||
        (complaint.id || "").toLowerCase().includes(normalizedSearch) ||
        (complaint.title || "").toLowerCase().includes(normalizedSearch) ||
        (complaint.studentName || "").toLowerCase().includes(normalizedSearch) ||
        (complaint.room || "").toLowerCase().includes(normalizedSearch) ||
        (complaint.category || "").toLowerCase().includes(normalizedSearch)

      const matchesStatus =
        statusFilter === "all" ||
        complaint.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [safeComplaints, searchTerm, statusFilter])

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <div className="dashboard-logo">
            <ShieldCheck size={24} />
          </div>

          <div>
            <h1 className="dashboard-title">HostelFix</h1>
            <p className="dashboard-subtitle">
              Administrator Panel
            </p>
          </div>
        </div>

        <button
          className="dashboard-logout"
          onClick={onLogout}
        >
          <LogOut size={18} />
          Logout
        </button>
      </header>

      <main className="dashboard-main">
        <section className="welcome-section">
          <div>
            <p className="welcome-date">
              SYSTEM ADMINISTRATION
            </p>

            <h2>Administrator Dashboard</h2>

            <p>
              Monitor complaints and maintenance activity
              across HostelFix.
            </p>
          </div>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-top">
              <div className="stat-icon">
                <ClipboardList size={22} />
              </div>
            </div>
            <div className="stat-value">{totalComplaints}</div>
            <div className="stat-label">Total Complaints</div>
            <div className="stat-description">
              All complaints in the system
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-top">
              <div className="stat-icon">
                <AlertTriangle size={22} />
              </div>
            </div>
            <div className="stat-value">{activeComplaints}</div>
            <div className="stat-label">Active Complaints</div>
            <div className="stat-description">
              Complaints still requiring action
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-top">
              <div className="stat-icon">
                <CheckCircle2 size={22} />
              </div>
            </div>
            <div className="stat-value">{resolvedComplaints}</div>
            <div className="stat-label">Resolved</div>
            <div className="stat-description">
              Successfully completed complaints
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-top">
              <div className="stat-icon">
                <XCircle size={22} />
              </div>
            </div>
            <div className="stat-value">{urgentComplaints}</div>
            <div className="stat-label">Urgent</div>
            <div className="stat-description">
              Complaints marked as urgent
            </div>
          </div>
        </section>

        <section className="complaints-section">
          <div className="section-heading">
            <div>
              <h2>All Complaints</h2>
              <span className="complaint-count">
                {filteredComplaints.length} complaints
              </span>
            </div>
          </div>

          <div className="warden-filters">
            <div className="search-box">
              <Search size={18} />
              <input
                type="text"
                placeholder="Search by complaint, student, room or category..."
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
              />
            </div>

            <select
              className="filter-control"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as StatusFilter
                )
              }
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="assigned">Assigned</option>
              <option value="in-progress">In Progress</option>
              <option value="need-material">Need Material</option>
              <option value="cannot-complete">Can't Complete</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {filteredComplaints.length === 0 ? (
            <div className="warden-empty-state">
              <ClipboardList size={40} />
              <h3>No complaints found</h3>
              <p>
                Try changing your search or status filter.
              </p>
            </div>
          ) : (
            <div className="warden-complaint-list">
              {filteredComplaints.map((complaint) => (
                <div
                  className="warden-complaint-card"
                  key={complaint.id}
                >
                  <div className="warden-complaint-main">
                    <div className="warden-complaint-icon">
                      <ClipboardList size={22} />
                    </div>

                    <div className="warden-complaint-content">
                      <div className="warden-complaint-top">
                        <div>
                          <h3>{complaint.title}</h3>

                          <div className="warden-complaint-meta">
                            <span>{complaint.id}</span>
                            <span>{complaint.category}</span>
                            <span>{complaint.room}</span>
                          </div>
                        </div>

                        <span
                          className={getPriorityClass(
                            complaint.priority
                          )}
                        >
                          {(complaint.priority || "medium").toUpperCase()}
                        </span>
                      </div>

                      <p>{complaint.description}</p>

                      <div className="warden-complaint-meta">
                        <span>
                          Student: {complaint.studentName || "Unknown"}
                        </span>
                        <span>
                          Hostel: {complaint.hostel || "Not specified"}
                        </span>
                        <span>
                          Staff: {complaint.assignedStaff || "Not assigned"}
                        </span>
                      </div>

                      <div className="admin-complaint-bottom">
                        <span
                          className={getStatusClass(
                            complaint.status
                          )}
                        >
                          {getStatusLabel(complaint.status)}
                        </span>

                        <button
                          className="warden-view-button"
                          onClick={() =>
                            onViewComplaint(complaint)
                          }
                        >
                          View Complaint
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="admin-system-info">
          <div>
            <UserRound size={20} />
            <div>
              <strong>HostelFix Administration</strong>
              <span>
                System-level complaint monitoring and
                maintenance management
              </span>
            </div>
          </div>

          <span className="admin-system-badge">ADMIN</span>
        </section>
      </main>
    </div>
  )
}

export default AdminDashboard