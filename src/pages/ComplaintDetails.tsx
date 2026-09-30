import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Home,
  LoaderCircle,
  Package,
  UserRound,
  Wrench,
  XCircle,
} from "lucide-react"

import {
  useEffect,
  useState,
  type ReactNode,
} from "react"

import type {
  Complaint,
  ComplaintStatus,
} from "../types"

interface ComplaintDetailsProps {
  complaint: Complaint
  onBack: () => void
  isWarden?: boolean

  onStatusChange?: (
    status: ComplaintStatus
  ) => void

  onAssignStaff?: (
    staffName: string
  ) => void
}

interface ComplaintUpdate {
  id: number
  complaint_id: number
  user_id: number | null
  old_status: string | null
  new_status: string
  note: string | null
  created_at: string
  user_name: string | null
  user_role: string | null
}

const API_URL =
  "http://localhost:5000"

function ComplaintDetails({
  complaint,
  onBack,
  isWarden = false,
  onStatusChange,
  onAssignStaff,
}: ComplaintDetailsProps) {
  const [history, setHistory] =
    useState<ComplaintUpdate[]>([])

  const [isLoadingHistory, setIsLoadingHistory] =
    useState(true)

  // =====================================================
  // LOAD REAL COMPLAINT HISTORY
  // =====================================================

  useEffect(() => {
    const fetchHistory =
      async () => {
        try {
          setIsLoadingHistory(true)

          const databaseId =
            Number(
              complaint.id.replace(
                "HF-",
                ""
              )
            )

          if (
            !Number.isInteger(
              databaseId
            )
          ) {
            throw new Error(
              "Invalid complaint ID."
            )
          }

          const response =
            await fetch(
              `${API_URL}/api/complaints/${databaseId}/updates`
            )

          const data =
            await response.json()

          if (!response.ok) {
            throw new Error(
              data.message ||
                "Failed to load complaint history."
            )
          }

          setHistory(
            data.updates || []
          )
        } catch (error) {
          console.error(
            "Failed to load complaint history:",
            error
          )

          setHistory([])
        } finally {
          setIsLoadingHistory(false)
        }
      }

    fetchHistory()
  }, [complaint.id])

  // =====================================================
  // TIMELINE TITLE
  // =====================================================

  const getTimelineTitle = (
    status: string
  ) => {
    switch (status) {
      case "submitted":
        return "Complaint Submitted"

      case "assigned":
        return "Complaint Assigned"

      case "in-progress":
        return "Work In Progress"

      case "need-material":
        return "Material Required"

      case "cannot-complete":
        return "Unable To Complete"

      case "resolved":
        return "Complaint Resolved"

      case "rejected":
        return "Complaint Rejected"

      default:
        return formatStatus(
          status
        )
    }
  }

  // =====================================================
  // TIMELINE ICON
  // =====================================================

  const getTimelineIcon = (
    status: string
  ) => {
    switch (status) {
      case "need-material":
        return (
          <Package size={15} />
        )

      case "cannot-complete":
        return (
          <XCircle size={15} />
        )

      default:
        return (
          <CheckCircle2
            size={15}
          />
        )
    }
  }

  // =====================================================
  // TIMELINE CLASS
  // =====================================================

  const getTimelineClass =
    (status: string) => {
      switch (status) {
        case "need-material":
          return "timeline-warning"

        case "cannot-complete":
          return "timeline-danger"

        case "resolved":
          return "timeline-success"

        case "rejected":
          return "timeline-danger"

        default:
          return ""
      }
    }

  return (
    <div className="details-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="dashboard-header">

        <div className="header-brand">

          <button
            className="back-button"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft
              size={19}
            />
          </button>

          <div className="brand-icon">
            <FileText
              size={22}
            />
          </div>

          <div>
            <h2>
              HostelFix
            </h2>

            <span>
              Complaint Details
            </span>
          </div>

        </div>

      </header>

      {/* =================================================
          MAIN
      ================================================= */}

      <main className="details-main">

        {/* =================================================
            TITLE
        ================================================= */}

        <section className="details-title">

          <div>

            <p className="eyebrow">
              COMPLAINT{" "}
              {complaint.id}
            </p>

            <h1>
              {complaint.title}
            </h1>

            <p>
              Submitted on{" "}
              {formatDate(
                complaint.createdAt
              )}
            </p>

          </div>

          <div className="details-title-badges">

            <span
              className={`status-badge status-${complaint.status}`}
            >
              {formatStatus(
                complaint.status
              )}
            </span>

            <span
              className={`priority-badge priority-${complaint.priority}`}
            >
              {complaint.priority}
            </span>

          </div>

        </section>

        {/* =================================================
            COMPLAINT INFORMATION
        ================================================= */}

        <section className="details-grid">

          <div className="details-card">

            <div className="details-card-header">

              <FileText
                size={20}
              />

              <h2>
                Complaint Information
              </h2>

            </div>

            <div className="details-info-grid">

              <InfoItem
                icon={
                  <FileText
                    size={17}
                  />
                }
                label="Category"
                value={
                  complaint.category
                }
              />

              <InfoItem
                icon={
                  <Wrench
                    size={17}
                  />
                }
                label="Priority"
                value={
                  complaint.priority
                }
              />

              <InfoItem
                icon={
                  <Home
                    size={17}
                  />
                }
                label="Hostel"
                value={
                  complaint.hostel
                }
              />

              <InfoItem
                icon={
                  <Home
                    size={17}
                  />
                }
                label="Room"
                value={
                  complaint.room
                }
              />

              <InfoItem
                icon={
                  <CalendarDays
                    size={17}
                  />
                }
                label="Submitted"
                value={formatDate(
                  complaint.createdAt
                )}
              />

              <InfoItem
                icon={
                  <Clock3
                    size={17}
                  />
                }
                label="Last Updated"
                value={formatDate(
                  complaint.updatedAt
                )}
              />

            </div>

          </div>

          {/* =================================================
              STUDENT
          ================================================= */}

          <div className="details-card">

            <div className="details-card-header">

              <UserRound
                size={20}
              />

              <h2>
                Student
              </h2>

            </div>

            <div className="assigned-person">

              <div className="assigned-avatar">

                {getInitials(
                  complaint.studentName
                )}

              </div>

              <div>

                <strong>
                  {
                    complaint.studentName
                  }
                </strong>

                <span>
                  Student ID:{" "}
                  {
                    complaint.studentId
                  }
                </span>

              </div>

            </div>

          </div>

        </section>

        {/* =================================================
            MAINTENANCE STAFF
        ================================================= */}

        <section className="details-card">

          <div className="details-card-header">

            <Wrench
              size={20}
            />

            <h2>
              Maintenance Staff
            </h2>

          </div>

          {complaint.assignedStaff ? (

            <div className="assigned-person">

              <div className="assigned-avatar">

                {getInitials(
                  complaint.assignedStaff
                )}

              </div>

              <div>

                <strong>
                  {
                    complaint.assignedStaff
                  }
                </strong>

                <span>
                  Assigned maintenance
                  staff
                </span>

              </div>

            </div>

          ) : (

            <div className="not-assigned">

              <Wrench
                size={20}
              />

              <div>

                <strong>
                  Not assigned yet
                </strong>

                <span>
                  A maintenance staff
                  member has not been
                  assigned.
                </span>

              </div>

            </div>

          )}

        </section>

        {/* =================================================
            WARDEN MANAGEMENT
        ================================================= */}

        {isWarden && (

          <section className="warden-management-card">

            <div className="details-card-header">

              <Wrench
                size={20}
              />

              <div>

                <h2>
                  Manage Complaint
                </h2>

                <p>
                  Assign staff and update
                  the complaint status.
                </p>

              </div>

            </div>

            <div className="warden-management-grid">

              {/* ASSIGN STAFF */}

              <div className="management-control">

                <label htmlFor="staff">
                  Assign Maintenance
                  Staff
                </label>

                <select
                  id="staff"
                  value={
                    complaint.assignedStaff ||
                    ""
                  }
                  onChange={(
                    event
                  ) =>
                    onAssignStaff?.(
                      event.target
                        .value
                    )
                  }
                >

                  <option value="">
                    Select staff member
                  </option>

                  <option value="Vaishnavi Bhoiwade">
                    Vaishnavi Bhoiwade
                  </option>

                  <option value="Bhargavi Borkhade">
                    Bhargavi Borkhade
                  </option>

                  <option value="Bhavesh Bhut">
                    Bhavesh Bhut
                  </option>

                  <option value="Ruturaj Bhome">
                    Ruturaj Bhome
                  </option>

                </select>

              </div>

              {/* UPDATE STATUS */}

              <div className="management-control">

                <label htmlFor="status">
                  Update Status
                </label>

                <select
                  id="status"
                  value={
                    complaint.status
                  }
                  onChange={(
                    event
                  ) =>
                    onStatusChange?.(
                      event.target
                        .value as ComplaintStatus
                    )
                  }
                >

                  <option value="submitted">
                    Submitted
                  </option>

                  <option value="assigned">
                    Assigned
                  </option>

                  <option value="in-progress">
                    In Progress
                  </option>

                  <option value="need-material">
                    Need Material
                  </option>

                  <option value="cannot-complete">
                    Can't Complete
                  </option>

                  <option value="resolved">
                    Resolved
                  </option>

                  <option value="rejected">
                    Rejected
                  </option>

                </select>

              </div>

            </div>

          </section>

        )}

        {/* =================================================
            DESCRIPTION
        ================================================= */}

        <section className="description-card">

          <div className="details-card-header">

            <FileText
              size={20}
            />

            <h2>
              Description
            </h2>

          </div>

          <p>
            {complaint.description}
          </p>

        </section>

        {/* =================================================
            REAL COMPLAINT TIMELINE
        ================================================= */}

        <section className="timeline-card">

          <div className="details-card-header">

            <Clock3
              size={20}
            />

            <h2>
              Complaint Timeline
            </h2>

          </div>

          {isLoadingHistory ? (

            <div className="timeline-loading">

              <LoaderCircle
                size={22}
                className="timeline-spinner"
              />

              <span>
                Loading complaint
                history...
              </span>

            </div>

          ) : (

            <div className="timeline">

              {/* SUBMITTED IS ALWAYS THE FIRST EVENT */}

              <TimelineItem
                title="Complaint Submitted"
                date={
                  complaint.createdAt
                }
                completed
              />

              {/* REAL DATABASE EVENTS */}

              {history.map(
                (update) => (

                  <TimelineItem
                    key={
                      update.id
                    }
                    title={getTimelineTitle(
                      update.new_status
                    )}
                    date={formatDateTime(
                      update.created_at
                    )}
                    completed
                    className={getTimelineClass(
                      update.new_status
                    )}
                    icon={getTimelineIcon(
                      update.new_status
                    )}
                    note={
                      update.note ||
                      undefined
                    }
                    userName={
                      update.user_name ||
                      undefined
                    }
                  />

                )
              )}

              {/* FALLBACK FOR OLD COMPLAINTS */}

              {history.length ===
                0 &&
                complaint.status !==
                  "submitted" && (

                  <TimelineItem
                    title={getTimelineTitle(
                      complaint.status
                    )}
                    date={
                      complaint.updatedAt
                    }
                    completed
                    note="Historical update was not recorded."
                  />

                )}

            </div>

          )}

        </section>

      </main>

    </div>
  )
}

// =========================================================
// INFORMATION ITEM
// =========================================================

interface InfoItemProps {
  icon: ReactNode
  label: string
  value: string
}

function InfoItem({
  icon,
  label,
  value,
}: InfoItemProps) {
  return (
    <div className="details-info-item">

      <div className="details-info-icon">
        {icon}
      </div>

      <div>

        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>

      </div>

    </div>
  )
}

// =========================================================
// TIMELINE ITEM
// =========================================================

interface TimelineItemProps {
  title: string
  date: string
  completed: boolean
  className?: string
  note?: string
  userName?: string
  icon?: ReactNode
}

function TimelineItem({
  title,
  date,
  completed,
  className = "",
  note,
  userName,
  icon,
}: TimelineItemProps) {
  return (
    <div
      className={`timeline-item ${className}`}
    >

      <div
        className={`timeline-dot ${
          completed
            ? "completed"
            : ""
        }`}
      >

        {completed &&
          (icon || (
            <CheckCircle2
              size={15}
            />
          ))}

      </div>

      <div className="timeline-content">

        <strong>
          {title}
        </strong>

        <span>
          {date}
        </span>

        {userName && (
          <small>
            By {userName}
          </small>
        )}

        {note && (
          <p className="timeline-note">
            {note}
          </p>
        )}

      </div>

    </div>
  )
}

// =========================================================
// FORMAT STATUS
// =========================================================
// IMPORTANT:
// This accepts string because new_status comes directly
// from the backend database.

function formatStatus(
  status: string
) {
  return status
    .split("-")
    .map(
      (word) =>
        word
          .charAt(0)
          .toUpperCase() +
        word.slice(1)
    )
    .join(" ")
}

// =========================================================
// FORMAT DATE
// =========================================================

function formatDate(
  date: string
) {
  if (!date) {
    return "—"
  }

  return new Date(
    `${date}T00:00:00`
  ).toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  )
}

// =========================================================
// FORMAT DATE + TIME
// =========================================================

function formatDateTime(
  date: string
) {
  if (!date) {
    return "—"
  }

  return new Date(
    date
  ).toLocaleString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  )
}

// =========================================================
// INITIALS
// =========================================================

function getInitials(
  name: string
) {
  return name
    .split(" ")
    .map(
      (word) =>
        word[0]
    )
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export default ComplaintDetails