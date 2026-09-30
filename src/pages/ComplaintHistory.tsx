import {
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  Search,
} from "lucide-react"
import { useState } from "react"

import type { Complaint, ComplaintStatus } from "../types"

interface ComplaintHistoryProps {
  complaints: Complaint[]
  onBack: () => void
  onViewComplaint: (complaint: Complaint) => void
}

function ComplaintHistory({
  complaints,
  onBack,
  onViewComplaint,
}: ComplaintHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("")

  const studentComplaints = complaints.filter(
    (complaint) =>
      complaint.studentId === "STU001"
  )

  const filteredComplaints =
    studentComplaints.filter((complaint) => {
      const search = searchTerm.toLowerCase()

      return (
        complaint.title
          .toLowerCase()
          .includes(search) ||
        complaint.id
          .toLowerCase()
          .includes(search) ||
        complaint.category
          .toLowerCase()
          .includes(search)
      )
    })

  return (
    <div className="history-page">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-brand">
          <button
            className="back-button"
            onClick={onBack}
          >
            <ArrowLeft size={19} />
          </button>

          <div className="brand-icon">
            <ClipboardList size={22} />
          </div>

          <div>
            <h2>HostelFix</h2>
            <span>Complaint History</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="history-main">
        <section className="history-heading">
          <div>
            <p className="eyebrow">
              COMPLAINTS
            </p>

            <h1>
              Your Complaint History
            </h1>

            <p>
              View all complaints you have
              submitted.
            </p>
          </div>

          <div className="history-summary">
            <ClipboardList size={18} />
            <span>
              {studentComplaints.length}{" "}
              complaints
            </span>
          </div>
        </section>

        {/* Search */}
        <div className="history-search">
          <Search size={19} />

          <input
            type="text"
            placeholder="Search complaints..."
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(event.target.value)
            }
          />
        </div>

        {/* Complaint List */}
        <section className="history-list">
          {filteredComplaints.length > 0 ? (
            filteredComplaints.map(
              (complaint) => (
                <ComplaintHistoryRow
                  key={complaint.id}
                  complaint={complaint}
                  onView={() =>
                    onViewComplaint(
                      complaint
                    )
                  }
                />
              )
            )
          ) : (
            <div className="history-empty">
              <div className="empty-icon">
                <ClipboardList size={28} />
              </div>

              <h3>
                No complaints found
              </h3>

              <p>
                Try a different search term.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

interface ComplaintHistoryRowProps {
  complaint: Complaint
  onView: () => void
}

function ComplaintHistoryRow({
  complaint,
  onView,
}: ComplaintHistoryRowProps) {
  return (
    <div
      className="history-complaint-row"
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
      <div className="history-complaint-icon">
        <ClipboardList size={21} />
      </div>

      <div className="history-complaint-content">
        <div className="history-complaint-top">
          <span className="complaint-id">
            {complaint.id}
          </span>

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

        <h3>{complaint.title}</h3>

        <p>
          {complaint.description}
        </p>

        <div className="history-complaint-meta">
          <span>
            {complaint.category}
          </span>

          <span>
            Room {complaint.room}
          </span>

          <span>
            {complaint.createdAt}
          </span>
        </div>
      </div>

      <div className="history-view">
        <ChevronRight size={20} />
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

export default ComplaintHistory