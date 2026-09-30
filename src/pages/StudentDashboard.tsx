import type { ReactNode } from "react"

import {
  ClipboardList,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  ChevronRight,
  LogOut,
} from "lucide-react"

import { users } from "../data/users"

import type { Complaint } from "../types"

interface StudentDashboardProps {
  complaints: Complaint[]
  onLogout: () => void
  onRaiseComplaint: () => void
  onViewHistory: () => void
  onViewComplaint: (complaint: Complaint) => void
}

export default function StudentDashboard({
  complaints,
  onLogout,
  onRaiseComplaint,
  onViewHistory,
  onViewComplaint,
}: StudentDashboardProps) {
  // Current logged-in student.
  // This will later come from authentication.
  const student = users.find(
    (user) => user.id === "STU001"
  )

  // Only show complaints belonging to this student.
  const studentComplaints = complaints.filter(
    (complaint) =>
      complaint.studentId === "STU001"
  )

  // Complaint statistics.
  const total = studentComplaints.length

  const pending = studentComplaints.filter(
    (complaint) =>
      complaint.status === "submitted"
  ).length

  const inProgress = studentComplaints.filter(
    (complaint) =>
      complaint.status === "assigned" ||
      complaint.status === "in-progress"
  ).length

  const resolved = studentComplaints.filter(
    (complaint) =>
      complaint.status === "resolved"
  ).length

  return (
    <div className="dashboard">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="dashboard-header">

        <div>
          <h1>🏠 HostelFix</h1>

          <p>
            Hostel Complaint & Maintenance System
          </p>
        </div>

        <div className="header-right">

          <div className="student-profile">

            <div className="profile-avatar">
              {student?.name.charAt(0)}
            </div>

            <div>
              <strong>
                {student?.name}
              </strong>

              <span>
                Student
              </span>
            </div>

          </div>

          <button
            className="logout-button"
            onClick={onLogout}
            title="Logout"
          >
            <LogOut size={17} />
          </button>

        </div>

      </header>

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <main className="dashboard-content">

        {/* ===================================================
            WELCOME SECTION
        =================================================== */}

        <section className="welcome-section">

          <div>
            <h2>
              Good morning,{" "}
              {student?.name.split(" ")[0]} 👋
            </h2>

            <p>
              {student?.hostel} · Room{" "}
              {student?.room}
            </p>
          </div>

          <button
            className="new-complaint-button"
            onClick={onRaiseComplaint}
          >
            <Plus size={18} />
            Raise Complaint
          </button>

        </section>

        {/* ===================================================
            STATISTICS
        =================================================== */}

        <section className="stats-grid">

          <StatCard
            title="Total Complaints"
            value={total}
            icon={
              <ClipboardList size={21} />
            }
            className="blue"
          />

          <StatCard
            title="Pending"
            value={pending}
            icon={
              <AlertCircle size={21} />
            }
            className="red"
          />

          <StatCard
            title="In Progress"
            value={inProgress}
            icon={
              <Clock size={21} />
            }
            className="orange"
          />

          <StatCard
            title="Resolved"
            value={resolved}
            icon={
              <CheckCircle size={21} />
            }
            className="green"
          />

        </section>

        {/* ===================================================
            MY COMPLAINTS
        =================================================== */}

        <section className="dashboard-section">

          <div className="section-heading">

            <div>
              <h2>
                My Complaints
              </h2>

              <p>
                Track all your hostel maintenance
                requests
              </p>
            </div>

            <button
              className="view-all-button"
              onClick={onViewHistory}
            >
              View All
              <ChevronRight size={16} />
            </button>

          </div>

          <div className="complaints-list">

            {studentComplaints.map(
              (complaint) => (
                <ComplaintCard
                  key={complaint.id}
                  complaint={complaint}
                  onClick={() =>
                    onViewComplaint(complaint)
                  }
                />
              )
            )}

            {studentComplaints.length === 0 && (
              <EmptyComplaints
                onRaiseComplaint={
                  onRaiseComplaint
                }
              />
            )}

          </div>

        </section>

        {/* ===================================================
            STUDENT INFORMATION
        =================================================== */}

        <section className="info-grid">

          <InfoCard
            icon="📍"
            label="Hostel"
            value={student?.hostel}
          />

          <InfoCard
            icon="🚪"
            label="Room"
            value={student?.room}
          />

          <InfoCard
            icon="📧"
            label="Email"
            value={student?.email}
          />

        </section>

      </main>

    </div>
  )
}

/* =========================================================
   STAT CARD
   ========================================================= */

function StatCard({
  title,
  value,
  icon,
  className,
}: {
  title: string
  value: number
  icon: ReactNode
  className: string
}) {
  return (
    <div className="stat-card">

      <div
        className={`stat-icon ${className}`}
      >
        {icon}
      </div>

      <div>
        <p>
          {title}
        </p>

        <h3>
          {value}
        </h3>
      </div>

    </div>
  )
}

/* =========================================================
   COMPLAINT CARD
   ========================================================= */

function ComplaintCard({
  complaint,
  onClick,
}: {
  complaint: Complaint
  onClick: () => void
}) {
  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>
  ) => {
    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <div
      className="complaint-row"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >

      {/* Complaint information */}

      <div className="complaint-main">

        <div className="complaint-top">

          <span className="complaint-id">
            {complaint.id}
          </span>

          <span className="category-badge">
            {complaint.category}
          </span>

        </div>

        <h3>
          {complaint.title}
        </h3>

        <p>
          Room {complaint.room} ·{" "}
          {complaint.createdAt}
        </p>

      </div>

      {/* Status and priority */}

      <div className="complaint-meta">

        <span
          className={`status-badge ${complaint.status}`}
        >
          {formatStatus(
            complaint.status
          )}
        </span>

        <span
          className={`priority-badge ${complaint.priority}`}
        >
          {formatStatus(
            complaint.priority
          )}
        </span>

        <ChevronRight
          size={18}
          className="complaint-arrow"
        />

      </div>

    </div>
  )
}

/* =========================================================
   EMPTY COMPLAINTS
   ========================================================= */

function EmptyComplaints({
  onRaiseComplaint,
}: {
  onRaiseComplaint: () => void
}) {
  return (
    <div className="empty-state">

      <ClipboardList size={40} />

      <h3>
        No complaints yet
      </h3>

      <p>
        You haven't submitted any complaints.
      </p>

      <button
        className="new-complaint-button"
        onClick={onRaiseComplaint}
      >
        <Plus size={17} />
        Raise Your First Complaint
      </button>

    </div>
  )
}

/* =========================================================
   INFORMATION CARD
   ========================================================= */

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: string
  label: string
  value?: string
}) {
  return (
    <div className="info-card">

      <span className="info-icon">
        {icon}
      </span>

      <div>
        <p>
          {label}
        </p>

        <strong>
          {value || "—"}
        </strong>
      </div>

    </div>
  )
}

/* =========================================================
   HELPERS
   ========================================================= */

function formatStatus(status: string) {
  return status
    .replace("-", " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    )
}