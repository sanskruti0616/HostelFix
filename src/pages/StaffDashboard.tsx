import { useMemo, useState } from "react"

import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  LogOut,
  Search,
  Wrench,
  XCircle,
  Package,
} from "lucide-react"

import type {
  Complaint,
  ComplaintStatus,
} from "../types"

interface StaffDashboardProps {
  complaints: Complaint[]
  staffName: string
  onLogout: () => void
  onViewComplaint: (
    complaint: Complaint
  ) => void
  onStatusChange: (
    complaintId: string,
    status: ComplaintStatus
  ) => void
}

// ======================================================
// STATUS LABEL
// ======================================================

function formatStatus(
  status: ComplaintStatus
) {
  switch (status) {
    case "submitted":
      return "Submitted"

    case "assigned":
      return "Assigned"

    case "in-progress":
      return "In Progress"

    case "need-material":
      return "Need Material"

    case "cannot-complete":
      return "Can't Complete"

    case "resolved":
      return "Completed"

    case "rejected":
      return "Rejected"

    default:
      return status
  }
}

// ======================================================
// PRIORITY LABEL
// ======================================================

function formatPriority(
  priority: Complaint["priority"]
) {
  return (
    priority.charAt(0).toUpperCase() +
    priority.slice(1)
  )
}

// ======================================================
// STAFF DASHBOARD
// ======================================================

function StaffDashboard({
  complaints,
  staffName,
  onLogout,
  onViewComplaint,
  onStatusChange,
}: StaffDashboardProps) {
  const [search, setSearch] =
    useState("")

  const [updatingComplaintId, setUpdatingComplaintId] =
    useState<string | null>(null)

  // ====================================================
  // ONLY SHOW JOBS ASSIGNED TO THIS WORKER
  // ====================================================

  const assignedComplaints =
    useMemo(() => {
      return complaints.filter(
        (complaint) =>
          complaint.assignedStaff ===
          staffName
      )
    }, [
      complaints,
      staffName,
    ])

  // ====================================================
  // SEARCH
  // ====================================================

  const filteredComplaints =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase()

      if (!query) {
        return assignedComplaints
      }

      return assignedComplaints.filter(
        (complaint) =>
          complaint.title
            .toLowerCase()
            .includes(query) ||
          complaint.room
            .toLowerCase()
            .includes(query) ||
          complaint.category
            .toLowerCase()
            .includes(query) ||
          complaint.id
            .toLowerCase()
            .includes(query)
      )
    }, [
      assignedComplaints,
      search,
    ])

  // ====================================================
  // STATS
  // ====================================================

  const totalJobs =
    assignedComplaints.length

  const completedJobs =
    assignedComplaints.filter(
      (complaint) =>
        complaint.status ===
        "resolved"
    ).length

  const activeJobs =
    assignedComplaints.filter(
      (complaint) =>
        complaint.status !==
          "resolved" &&
        complaint.status !==
          "rejected"
    ).length

  // ====================================================
  // STATUS UPDATE
  // ====================================================

  const changeStatus = async (
    complaintId: string,
    status: ComplaintStatus
  ) => {
    try {
      setUpdatingComplaintId(
        complaintId
      )

      await Promise.resolve(
        onStatusChange(
          complaintId,
          status
        )
      )
    } finally {
      setUpdatingComplaintId(
        null
      )
    }
  }

  // ====================================================
  // INITIAL
  // ====================================================

  const initial =
    staffName
      ? staffName
          .charAt(0)
          .toUpperCase()
      : "W"

  // ====================================================
  // UI
  // ====================================================

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 80% 0%, rgba(99,102,241,0.07), transparent 25%), #f5f7fb",
        color: "#111827",
      }}
    >

      {/* =================================================
          HEADER
      ================================================= */}

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          minHeight: 76,
          padding:
            "0 clamp(16px, 5vw, 60px)",
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
          background:
            "rgba(255,255,255,0.94)",
          borderBottom:
            "1px solid #e5e7eb",
          backdropFilter:
            "blur(16px)",
        }}
      >

        {/* BRAND */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >

          <div
            style={{
              width: 44,
              height: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 14,
              background:
                "#eef2ff",
              color: "#4f46e5",
            }}
          >
            <Wrench size={23} />
          </div>

          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 800,
                letterSpacing:
                  "-0.5px",
              }}
            >
              HostelFix
            </h1>

            <p
              style={{
                margin: "3px 0 0",
                color: "#8a94a6",
                fontSize: 11,
              }}
            >
              Maintenance Worker
            </p>
          </div>
        </div>

        {/* PROFILE */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >

            <div
              style={{
                width: 40,
                height: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background:
                  "#eef2ff",
                color: "#4f46e5",
                fontWeight: 800,
              }}
            >
              {initial}
            </div>

            <div
              style={{
                display: "block",
              }}
            >
              <strong
                style={{
                  display: "block",
                  fontSize: 12,
                }}
              >
                {staffName}
              </strong>

              <span
                style={{
                  display: "block",
                  marginTop: 2,
                  color: "#8a94a6",
                  fontSize: 10,
                }}
              >
                Maintenance Staff
              </span>
            </div>

          </div>

          <button
            onClick={onLogout}
            title="Logout"
            style={{
              width: 42,
              height: 42,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border:
                "1px solid #dfe3ea",
              borderRadius: 11,
              background: "white",
              color: "#667085",
              cursor: "pointer",
            }}
          >
            <LogOut size={18} />
          </button>

        </div>
      </header>

      {/* =================================================
          MAIN
      ================================================= */}

      <main
        style={{
          width:
            "min(1100px, 92%)",
          margin: "0 auto",
          padding:
            "32px 0 60px",
        }}
      >

        {/* =================================================
            WELCOME
        ================================================= */}

        <section
          style={{
            padding:
              "28px 30px",
            borderRadius: 22,
            background:
              "linear-gradient(135deg, #4f46e5, #6d5dfc)",
            color: "white",
            marginBottom: 20,
            boxShadow:
              "0 18px 40px rgba(79,70,229,0.18)",
          }}
        >

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent:
                "space-between",
              gap: 20,
            }}
          >

            <div>

              <p
                style={{
                  margin:
                    "0 0 7px",
                  fontSize: 13,
                  opacity: 0.85,
                  fontWeight: 600,
                }}
              >
                Welcome back 👋
              </p>

              <h2
                style={{
                  margin: 0,
                  fontSize:
                    "clamp(24px, 4vw, 31px)",
                  fontWeight: 800,
                  letterSpacing:
                    "-0.8px",
                }}
              >
                {staffName}
              </h2>

              <p
                style={{
                  margin:
                    "8px 0 0",
                  fontSize: 13,
                  opacity: 0.88,
                }}
              >
                Here are the maintenance
                jobs assigned to you.
              </p>

            </div>

            <div
              style={{
                width: 72,
                height: 72,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 20,
                background:
                  "rgba(255,255,255,0.17)",
              }}
            >
              <Wrench size={36} />
            </div>

          </div>

        </section>

        {/* =================================================
            STATS
        ================================================= */}

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(3, 1fr)",
            gap: 16,
            marginBottom: 22,
          }}
        >

          {/* TOTAL */}

          <StatCard
            icon={
              <Wrench size={21} />
            }
            value={totalJobs}
            label="Total Jobs"
            iconBackground="#eef2ff"
            iconColor="#4f46e5"
          />

          {/* ACTIVE */}

          <StatCard
            icon={
              <Clock3 size={21} />
            }
            value={activeJobs}
            label="Active Jobs"
            iconBackground="#fff7ed"
            iconColor="#f59e0b"
          />

          {/* COMPLETED */}

          <StatCard
            icon={
              <CheckCircle2
                size={21}
              />
            }
            value={completedJobs}
            label="Completed"
            iconBackground="#f0fdf4"
            iconColor="#16a34a"
          />

        </section>

        {/* =================================================
            JOB SECTION
        ================================================= */}

        <section
          style={{
            padding:
              "26px",
            background: "white",
            border:
              "1px solid #e5e7eb",
            borderRadius: 20,
            boxShadow:
              "0 5px 20px rgba(15,23,42,0.04)",
          }}
        >

          {/* SECTION HEADER */}

          <div
            style={{
              display: "flex",
              alignItems:
                "flex-start",
              justifyContent:
                "space-between",
              gap: 15,
              marginBottom: 20,
            }}
          >

            <div>

              <h2
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 800,
                }}
              >
                My Assigned Jobs
              </h2>

              <p
                style={{
                  margin:
                    "6px 0 0",
                  color: "#8a94a6",
                  fontSize: 12,
                }}
              >
                Work only on the
                complaints assigned to
                you.
              </p>

            </div>

            <div
              style={{
                minWidth: 40,
                height: 40,
                padding:
                  "0 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                background:
                  "#eef2ff",
                color: "#4f46e5",
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              {totalJobs}
            </div>

          </div>

          {/* SEARCH */}

          <div
            style={{
              position: "relative",
              marginBottom: 20,
            }}
          >

            <Search
              size={19}
              style={{
                position:
                  "absolute",
                left: 15,
                top: "50%",
                transform:
                  "translateY(-50%)",
                color: "#98a2b3",
              }}
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search by complaint, room or category..."
              style={{
                width: "100%",
                height: 46,
                boxSizing:
                  "border-box",
                padding:
                  "0 15px 0 45px",
                border:
                  "1px solid #dfe3ea",
                borderRadius: 12,
                outline: "none",
                fontSize: 12,
                color: "#344054",
              }}
            />

          </div>

          {/* =================================================
              JOB LIST
          ================================================= */}

          {filteredComplaints.length ===
          0 ? (
            <div
              style={{
                padding:
                  "55px 20px",
                textAlign: "center",
              }}
            >

              <div
                style={{
                  width: 58,
                  height: 58,
                  margin:
                    "0 auto 15px",
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  borderRadius: 17,
                  background:
                    "#f8f9fc",
                  color: "#98a2b3",
                }}
              >
                <CheckCircle2
                  size={28}
                />
              </div>

              <h3
                style={{
                  margin:
                    "0 0 7px",
                  fontSize: 16,
                }}
              >
                {search
                  ? "No matching jobs"
                  : "No jobs assigned"}
              </h3>

              <p
                style={{
                  margin: 0,
                  color: "#98a2b3",
                  fontSize: 12,
                }}
              >
                {search
                  ? "Try another search."
                  : "You currently don't have any maintenance jobs assigned to you."}
              </p>

            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection:
                  "column",
                gap: 15,
              }}
            >

              {filteredComplaints.map(
                (complaint) => (
                  <JobCard
                    key={
                      complaint.id
                    }
                    complaint={
                      complaint
                    }
                    updating={
                      updatingComplaintId ===
                      complaint.id
                    }
                    onView={() =>
                      onViewComplaint(
                        complaint
                      )
                    }
                    onStatusChange={
                      changeStatus
                    }
                  />
                )
              )}

            </div>
          )}

        </section>

      </main>
    </div>
  )
}

// ======================================================
// STAT CARD
// ======================================================

interface StatCardProps {
  icon: React.ReactNode
  value: number
  label: string
  iconBackground: string
  iconColor: string
}

function StatCard({
  icon,
  value,
  label,
  iconBackground,
  iconColor,
}: StatCardProps) {
  return (
    <div
      style={{
        minHeight: 105,
        padding: 18,
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxSizing: "border-box",
        background: "white",
        border:
          "1px solid #e5e7eb",
        borderRadius: 17,
        boxShadow:
          "0 5px 18px rgba(15,23,42,0.04)",
      }}
    >

      <div
        style={{
          width: 46,
          height: 46,
          flexShrink: 0,
          display: "flex",
          alignItems:
            "center",
          justifyContent:
            "center",
          borderRadius: 14,
          background:
            iconBackground,
          color: iconColor,
        }}
      >
        {icon}
      </div>

      <div>

        <strong
          style={{
            display: "block",
            fontSize: 23,
            lineHeight: 1,
          }}
        >
          {value}
        </strong>

        <span
          style={{
            display: "block",
            marginTop: 7,
            color: "#7b8494",
            fontSize: 11,
          }}
        >
          {label}
        </span>

      </div>

    </div>
  )
}

// ======================================================
// JOB CARD
// ======================================================

interface JobCardProps {
  complaint: Complaint
  updating: boolean
  onView: () => void
  onStatusChange: (
    complaintId: string,
    status: ComplaintStatus
  ) => void
}

function JobCard({
  complaint,
  updating,
  onView,
  onStatusChange,
}: JobCardProps) {
  return (
    <article
      style={{
        padding: 20,
        border:
          "1px solid #e3e6ed",
        borderRadius: 17,
        background: "#fff",
      }}
    >

      {/* TOP */}

      <div
        style={{
          display: "flex",
          alignItems:
            "flex-start",
          justifyContent:
            "space-between",
          gap: 15,
        }}
      >

        <div
          style={{
            minWidth: 0,
            flex: 1,
          }}
        >

          {/* BADGES */}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems:
                "center",
              gap: 7,
              marginBottom: 8,
            }}
          >

            <span
              style={{
                color: "#4f46e5",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {complaint.id}
            </span>

            <span
              style={{
                padding:
                  "4px 8px",
                borderRadius: 7,
                background:
                  "#fffbeb",
                color: "#b45309",
                fontSize: 9,
                fontWeight: 800,
              }}
            >
              {formatPriority(
                complaint.priority
              )}
            </span>

            <span
              style={{
                padding:
                  "4px 8px",
                borderRadius: 7,
                background:
                  getStatusBackground(
                    complaint.status
                  ),
                color:
                  getStatusColor(
                    complaint.status
                  ),
                fontSize: 9,
                fontWeight: 800,
              }}
            >
              {formatStatus(
                complaint.status
              )}
            </span>

          </div>

          {/* TITLE */}

          <h3
            style={{
              margin:
                "0 0 7px",
              fontSize: 17,
              fontWeight: 800,
              color: "#111827",
            }}
          >
            {complaint.title}
          </h3>

          {/* DESCRIPTION */}

          <p
            style={{
              margin:
                "0 0 13px",
              color: "#667085",
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            {complaint.description}
          </p>

          {/* DETAILS */}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >

            <InfoBadge>
              📍 {complaint.hostel}
            </InfoBadge>

            <InfoBadge>
              🚪 Room{" "}
              {complaint.room}
            </InfoBadge>

            <InfoBadge>
              🔧{" "}
              {complaint.category}
            </InfoBadge>

          </div>

        </div>

        {/* VIEW */}

        <button
          onClick={onView}
          style={{
            display: "flex",
            alignItems:
              "center",
            gap: 3,
            flexShrink: 0,
            border: "none",
            background:
              "transparent",
            color: "#4f46e5",
            fontSize: 11,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          View
          <ChevronRight
            size={15}
          />
        </button>

      </div>

      {/* =================================================
          WORKER ACTIONS
      ================================================= */}

      {complaint.status !==
        "resolved" &&
        complaint.status !==
          "rejected" && (
          <div
            style={{
              marginTop: 18,
              paddingTop: 17,
              borderTop:
                "1px solid #eef0f4",
            }}
          >

            <p
              style={{
                margin:
                  "0 0 10px",
                color: "#475467",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              UPDATE JOB
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, 1fr)",
                gap: 10,
              }}
            >

              {/* START WORK */}

              {(complaint.status ===
                "assigned" ||
                complaint.status ===
                  "need-material" ||
                complaint.status ===
                  "cannot-complete") && (
                <ActionButton
                  icon={
                    <Clock3
                      size={20}
                    />
                  }
                  label="START WORK"
                  background="#eef2ff"
                  color="#4338ca"
                  disabled={updating}
                  onClick={() =>
                    onStatusChange(
                      complaint.id,
                      "in-progress"
                    )
                  }
                />
              )}

              {/* COMPLETED */}

              {complaint.status ===
                "in-progress" && (
                <ActionButton
                  icon={
                    <CheckCircle2
                      size={20}
                    />
                  }
                  label="COMPLETED"
                  background="#f0fdf4"
                  color="#15803d"
                  disabled={updating}
                  onClick={() =>
                    onStatusChange(
                      complaint.id,
                      "resolved"
                    )
                  }
                />
              )}

              {/* NEED MATERIAL */}

              {(complaint.status ===
                "assigned" ||
                complaint.status ===
                  "in-progress") && (
                <ActionButton
                  icon={
                    <Package
                      size={20}
                    />
                  }
                  label="NEED MATERIAL"
                  background="#fff7ed"
                  color="#c2410c"
                  disabled={updating}
                  onClick={() =>
                    onStatusChange(
                      complaint.id,
                      "need-material"
                    )
                  }
                />
              )}

              {/* CAN'T COMPLETE */}

              {(complaint.status ===
                "assigned" ||
                complaint.status ===
                  "in-progress" ||
                complaint.status ===
                  "need-material") && (
                <ActionButton
                  icon={
                    <XCircle
                      size={20}
                    />
                  }
                  label="CAN'T COMPLETE"
                  background="#fef2f2"
                  color="#dc2626"
                  disabled={updating}
                  onClick={() =>
                    onStatusChange(
                      complaint.id,
                      "cannot-complete"
                    )
                  }
                />
              )}

            </div>

            {updating && (
              <p
                style={{
                  margin:
                    "11px 0 0",
                  textAlign: "center",
                  color: "#667085",
                  fontSize: 11,
                }}
              >
                Updating job...
              </p>
            )}

          </div>
        )}

      {/* COMPLETED MESSAGE */}

      {complaint.status ===
        "resolved" && (
        <div
          style={{
            marginTop: 18,
            padding: 14,
            display: "flex",
            alignItems:
              "center",
            gap: 9,
            borderRadius: 12,
            background:
              "#f0fdf4",
            color: "#15803d",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <CheckCircle2
            size={18}
          />
          This maintenance job
          has been completed.
        </div>
      )}

      {/* CAN'T COMPLETE MESSAGE */}

      {complaint.status ===
        "cannot-complete" && (
        <div
          style={{
            marginTop: 18,
            padding: 14,
            display: "flex",
            alignItems:
              "center",
            gap: 9,
            borderRadius: 12,
            background:
              "#fef2f2",
            color: "#dc2626",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <AlertCircle
            size={18}
          />
          This job was marked as
          unable to complete.
        </div>
      )}

      {/* NEED MATERIAL MESSAGE */}

      {complaint.status ===
        "need-material" && (
        <div
          style={{
            marginTop: 18,
            padding: 14,
            display: "flex",
            alignItems:
              "center",
            gap: 9,
            borderRadius: 12,
            background:
              "#fff7ed",
            color: "#c2410c",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <Package
            size={18}
          />
          Material is required
          before this job can be
          completed.
        </div>
      )}

    </article>
  )
}

// ======================================================
// INFO BADGE
// ======================================================

function InfoBadge({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <span
      style={{
        padding:
          "6px 9px",
        borderRadius: 8,
        background:
          "#f8f9fc",
        color: "#667085",
        fontSize: 10,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  )
}

// ======================================================
// ACTION BUTTON
// ======================================================

interface ActionButtonProps {
  icon: React.ReactNode
  label: string
  background: string
  color: string
  disabled: boolean
  onClick: () => void
}

function ActionButton({
  icon,
  label,
  background,
  color,
  disabled,
  onClick,
}: ActionButtonProps) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        minHeight: 58,
        display: "flex",
        alignItems:
          "center",
        justifyContent:
          "center",
        gap: 8,
        border:
          "1px solid transparent",
        borderRadius: 12,
        background:
          disabled
            ? "#f3f4f6"
            : background,
        color:
          disabled
            ? "#98a2b3"
            : color,
        fontSize: 11,
        fontWeight: 900,
        cursor:
          disabled
            ? "not-allowed"
            : "pointer",
        transition:
          "transform 0.15s ease",
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// ======================================================
// STATUS COLORS
// ======================================================

function getStatusBackground(
  status: ComplaintStatus
) {
  switch (status) {
    case "assigned":
      return "#f3f4f6"

    case "in-progress":
      return "#eef2ff"

    case "need-material":
      return "#fff7ed"

    case "cannot-complete":
      return "#fef2f2"

    case "resolved":
      return "#f0fdf4"

    case "rejected":
      return "#fef2f2"

    default:
      return "#f3f4f6"
  }
}

function getStatusColor(
  status: ComplaintStatus
) {
  switch (status) {
    case "assigned":
      return "#667085"

    case "in-progress":
      return "#4338ca"

    case "need-material":
      return "#c2410c"

    case "cannot-complete":
      return "#dc2626"

    case "resolved":
      return "#15803d"

    case "rejected":
      return "#dc2626"

    default:
      return "#667085"
  }
}

export default StaffDashboard