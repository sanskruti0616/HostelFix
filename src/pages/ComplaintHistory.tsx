import { ArrowLeft, ChevronRight, ClipboardList, Search } from "lucide-react"
import { useState, useMemo } from "react"
import type { Complaint } from "../types"

interface ComplaintHistoryProps {
  complaints: Complaint[]
  onBack: () => void
  onViewComplaint: (complaint: Complaint) => void
}

export default function ComplaintHistory({
  complaints,
  onBack,
  onViewComplaint,
}: ComplaintHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredComplaints = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return complaints
    return complaints.filter((c) => {
      return (
        c.title.toLowerCase().includes(term) ||
        c.id.toLowerCase().includes(term) ||
        c.category.toLowerCase().includes(term) ||
        c.description.toLowerCase().includes(term)
      )
    })
  }, [complaints, searchTerm])

  return (
    <div className="history-page">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-brand">
          <button className="back-button" onClick={onBack}>
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
            <p className="eyebrow">YOUR RECORD</p>
            <h1>Complaint History</h1>
            <p>View all complaints you have submitted and track their resolution progress.</p>
          </div>

          <div className="history-summary">
            <ClipboardList size={18} />
            <span>{complaints.length} complaints on record</span>
          </div>
        </section>

        {/* Search */}
        <div className="history-search">
          <Search size={19} />
          <input
            type="text"
            placeholder="Search by ID, title, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Complaint List */}
        <section className="history-list">
          {filteredComplaints.length > 0 ? (
            filteredComplaints.map((complaint) => (
              <div
                key={complaint.id}
                className="history-complaint-row"
                onClick={() => onViewComplaint(complaint)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onViewComplaint(complaint)
                }}
              >
                <div className="history-complaint-icon">
                  <ClipboardList size={21} />
                </div>

                <div className="history-complaint-content">
                  <div className="history-complaint-top">
                    <span className="complaint-id">{complaint.id}</span>
                    <span className={`status-badge status-${complaint.status}`}>
                      {complaint.status.replace("-", " ").replace("_", " ")}
                    </span>
                    <span className={`priority-badge priority-${complaint.priority}`}>
                      {complaint.priority}
                    </span>
                  </div>

                  <h3>{complaint.title}</h3>
                  <p>{complaint.description}</p>

                  <div className="history-complaint-meta">
                    <span>🏷️ {complaint.category}</span>
                    <span>🏠 Room {complaint.room}</span>
                    <span>📅 {complaint.createdAt}</span>
                    {complaint.assignedStaff && <span>🔧 Staff: {complaint.assignedStaff}</span>}
                  </div>
                </div>

                <div className="history-view">
                  <ChevronRight size={20} />
                </div>
              </div>
            ))
          ) : (
            <div className="history-empty">
              <div className="empty-icon">
                <ClipboardList size={28} />
              </div>
              <h3>No complaints found</h3>
              <p>
                {complaints.length === 0
                  ? "You have not submitted any complaints yet."
                  : "No complaints match your search query."}
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}