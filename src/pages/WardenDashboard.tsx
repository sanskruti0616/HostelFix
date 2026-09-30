import React from "react"

import {
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Filter,
  LogOut,
  Search,
  ShieldCheck,
  Users,
  Wrench,
  XCircle,
} from "lucide-react"

import type {
  Complaint,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
} from "../types"

interface WardenDashboardProps {
  complaints: Complaint[]
  onLogout: () => void
  onViewComplaint: (complaint: Complaint) => void
}

function WardenDashboard({
  complaints,
  onLogout,
  onViewComplaint,
}: WardenDashboardProps) {
  const [searchTerm, setSearchTerm] = React.useState("")
  const [statusFilter, setStatusFilter] =
    React.useState<ComplaintStatus | "all">("all")
  const [categoryFilter, setCategoryFilter] =
    React.useState<ComplaintCategory | "all">("all")
  const [priorityFilter, setPriorityFilter] =
    React.useState<ComplaintPriority | "all">("all")

  const totalComplaints = complaints.length

  const pendingComplaints = complaints.filter(
    (complaint) =>
      complaint.status === "submitted" ||
      complaint.status === "assigned"
  ).length

  const inProgressComplaints = complaints.filter(
    (complaint) => complaint.status === "in-progress"
  ).length

  const resolvedComplaints = complaints.filter(
    (complaint) => complaint.status === "resolved"
  ).length

  const filteredComplaints = complaints.filter(
    (complaint) => {
      const matchesSearch =
        complaint.title
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        complaint.studentName
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        complaint.id
          .toLowerCase()
          .includes(searchTerm.toLowerCase())

      const matchesStatus =
        statusFilter === "all" ||
        complaint.status === statusFilter

      const matchesCategory =
        categoryFilter === "all" ||
        complaint.category === categoryFilter

      const matchesPriority =
        priorityFilter === "all" ||
        complaint.priority === priorityFilter

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory &&
        matchesPriority
      )
    }
  )

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
            <span>Warden Portal</span>
          </div>
        </div>

        <div className="header-user">
          <div className="user-avatar">
            PS
          </div>

          <div className="header-user-info">
            <strong>Priya Sharma</strong>
            <span>Warden</span>
          </div>

          <button
            className="header-logout"
            onClick={onLogout}
            title="Logout"
          >
            <LogOut size={19} />
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="dashboard-main">
        <section className="welcome-section">
          <div>
            <p className="eyebrow">
              <Building2 size={15} />
              WARDEN DASHBOARD
            </p>

            <h1>
              Good afternoon, Priya 👋
            </h1>

            <p>
              Monitor and manage hostel complaints
              from one place.
            </p>
          </div>

          <div className="welcome-date">
            <ClipboardList size={18} />
            <span>
              {new Date().toLocaleDateString(
                "en-IN",
                {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }
              )}
            </span>
          </div>
        </section>

        {/* Stats */}
        <section className="stats-grid">
          <StatCard
            icon={<ClipboardList size={22} />}
            label="Total Complaints"
            value={totalComplaints}
            description="All complaints"
          />

          <StatCard
            icon={<Clock3 size={22} />}
            label="Pending"
            value={pendingComplaints}
            description="Awaiting action"
          />

          <StatCard
            icon={<Wrench size={22} />}
            label="In Progress"
            value={inProgressComplaints}
            description="Being worked on"
          />

          <StatCard
            icon={<CheckCircle2 size={22} />}
            label="Resolved"
            value={resolvedComplaints}
            description="Successfully closed"
          />
        </section>

        {/* Complaint Management */}
        <section className="complaints-section">
          <div className="section-heading">
            <div>
              <h2>All Complaints</h2>
              <p>
                Review complaints raised by hostel
                students.
              </p>
            </div>

            <div className="complaint-count">
              <Users size={16} />
              {filteredComplaints.length} complaints
            </div>
          </div>

          {/* Filters */}
          <div className="warden-filters">
            <div className="search-box">
              <Search size={18} />

              <input
                type="text"
                placeholder="Search complaint, student or ID..."
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
              />
            </div>

            <div className="filter-control">
              <Filter size={16} />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as
                      | ComplaintStatus
                      | "all"
                  )
                }
              >
                <option value="all">
                  All Status
                </option>
                <option value="submitted">
                  Submitted
                </option>
                <option value="assigned">
                  Assigned
                </option>
                <option value="in-progress">
                  In Progress
                </option>
                <option value="resolved">
                  Resolved
                </option>
                <option value="rejected">
                  Rejected
                </option>
              </select>
            </div>

            <div className="filter-control">
              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(
                    event.target.value as
                      | ComplaintCategory
                      | "all"
                  )
                }
              >
                <option value="all">
                  All Categories
                </option>
                <option value="Electrical">
                  Electrical
                </option>
                <option value="Plumbing">
                  Plumbing
                </option>
                <option value="Internet">
                  Internet
                </option>
                <option value="Cleaning">
                  Cleaning
                </option>
                <option value="Furniture">
                  Furniture
                </option>
                <option value="Water Supply">
                  Water Supply
                </option>
                <option value="Security">
                  Security
                </option>
                <option value="Other">
                  Other
                </option>
              </select>
            </div>

            <div className="filter-control">
              <select
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(
                    event.target.value as
                      | ComplaintPriority
                      | "all"
                  )
                }
              >
                <option value="all">
                  All Priority
                </option>
                <option value="low">
                  Low
                </option>
                <option value="medium">
                  Medium
                </option>
                <option value="high">
                  High
                </option>
                <option value="urgent">
                  Urgent
                </option>
              </select>
            </div>
          </div>

          {/* Complaint List */}
          <div className="warden-complaint-list">
            {filteredComplaints.length > 0 ? (
              filteredComplaints.map(
                (complaint) => (
                  <WardenComplaintCard
                    key={complaint.id}
                    complaint={complaint}
                    onView={() =>
                      onViewComplaint(complaint)
                    }
                  />
                )
              )
            ) : (
              <div className="warden-empty-state">
                <div className="empty-icon">
                  <XCircle size={28} />
                </div>

                <h3>
                  No complaints found
                </h3>

                <p>
                  Try changing your search or
                  filters.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number
  description: string
}

function StatCard({
  icon,
  label,
  value,
  description,
}: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <div className="stat-icon">
          {icon}
        </div>

        <BarChart3 size={18} />
      </div>

      <div className="stat-value">
        {value}
      </div>

      <div className="stat-label">
        {label}
      </div>

      <div className="stat-description">
        {description}
      </div>
    </div>
  )
}

interface WardenComplaintCardProps {
  complaint: Complaint
  onView: () => void
}

function WardenComplaintCard({
  complaint,
  onView,
}: WardenComplaintCardProps) {
  return (
    <div
      className="warden-complaint-card"
      onClick={onView}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          onView()
        }
      }}
    >
      <div className="warden-complaint-main">
        <div className="warden-complaint-icon">
          <ClipboardList size={21} />
        </div>

        <div className="warden-complaint-content">
          <div className="warden-complaint-top">
            <span className="complaint-id">
              {complaint.id}
            </span>

            <span
              className={`status-badge status-${complaint.status}`}
            >
              {formatStatus(complaint.status)}
            </span>

            <span
              className={`priority-badge priority-${complaint.priority}`}
            >
              {complaint.priority}
            </span>
          </div>

          <h3>
            {complaint.title}
          </h3>

          <p>
            {complaint.description}
          </p>

          <div className="warden-complaint-meta">
            <span>
              👤 {complaint.studentName}
            </span>

            <span>
              🏠 {complaint.hostel}
            </span>

            <span>
              🚪 Room {complaint.room}
            </span>

            <span>
              🏷️ {complaint.category}
            </span>
          </div>

          <div className="warden-assigned">
            <Wrench size={15} />

            {complaint.assignedStaff ? (
              <span>
                Assigned to{" "}
                <strong>
                  {complaint.assignedStaff}
                </strong>
              </span>
            ) : (
              <span>
                <strong>
                  Not assigned
                </strong>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="warden-view-button">
        <span>View</span>
        <ChevronRight size={19} />
      </div>
    </div>
  )
}

function formatStatus(
  status: ComplaintStatus
) {
  return status
    .split("-")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ")
}

export default WardenDashboard