import { useState } from "react"
import {
  ClipboardList,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  ChevronRight,
  LogOut,
  Star,
  RefreshCw,
} from "lucide-react"
import type { Complaint, User } from "../types"
import { api } from "../services/api"

interface StudentDashboardProps {
  currentUser: User
  complaints: Complaint[]
  onLogout: () => void
  onRaiseComplaint: () => void
  onViewHistory: () => void
  onViewComplaint: (complaint: Complaint) => void
  onRefresh?: () => void
}

export default function StudentDashboard({
  currentUser,
  complaints,
  onLogout,
  onRaiseComplaint,
  onViewHistory,
  onViewComplaint,
  onRefresh,
}: StudentDashboardProps) {
  const [feedbackModalComplaint, setFeedbackModalComplaint] = useState<Complaint | null>(null)
  const [feedbackRating, setFeedbackRating] = useState(5)
  const [feedbackComments, setFeedbackComments] = useState("")
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  // Real statistics calculated from persistent database complaints
  const total = complaints.length

  const pending = complaints.filter(
    (c) =>
      c.status === "submitted" ||
      c.status === "pending_verification" ||
      c.status === "needs_information"
  ).length

  const inProgress = complaints.filter(
    (c) =>
      c.status === "assigned" ||
      c.status === "in-progress" ||
      c.status === "need-material"
  ).length

  const resolved = complaints.filter(
    (c) => c.status === "resolved" || c.status === "closed"
  ).length

  const recentComplaints = complaints.slice(0, 5)

  const handleOpenFeedback = (complaint: Complaint, e: React.MouseEvent) => {
    e.stopPropagation()
    setFeedbackModalComplaint(complaint)
    setFeedbackRating(5)
    setFeedbackComments("")
    setFeedbackMessage(null)
  }

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!feedbackModalComplaint) return
    setIsSubmittingFeedback(true)

    try {
      await api.complaints.submitFeedback(
        feedbackModalComplaint.id,
        feedbackRating,
        feedbackComments
      )
      setFeedbackMessage("Thank you! Your feedback has been recorded.")
      setTimeout(() => {
        setFeedbackModalComplaint(null)
        onRefresh?.()
      }, 1500)
    } catch (err: any) {
      alert(err.message || "Failed to submit feedback")
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div>
          <h1>🏠 HostelFix</h1>
          <p>Hostel Complaint & Maintenance System</p>
        </div>

        <div className="header-right">
          {onRefresh && (
            <button
              className="logout-button"
              onClick={onRefresh}
              title="Refresh Data"
              style={{ marginRight: "8px" }}
            >
              <RefreshCw size={17} />
            </button>
          )}

          <div className="student-profile">
            <div className="profile-avatar">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "S"}
            </div>
            <div>
              <strong>{currentUser.name}</strong>
              <span>
                Student {currentUser.organizationName ? `• ${currentUser.organizationName}` : ""}
              </span>
            </div>
          </div>

          <button className="logout-button" onClick={onLogout} title="Logout">
            <LogOut size={17} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-content">
        {/* Welcome Section */}
        <section className="welcome-section">
          <div>
            <h2>
              Welcome back, {currentUser.name.split(" ")[0]} 👋
            </h2>
            <p>
              {currentUser.organizationName && <span style={{ fontWeight: 600, color: "var(--primary)" }}>{currentUser.organizationName} · </span>}
              {currentUser.hostel || "Main Hostel"} · Room {currentUser.room || "Assigned"}
            </p>
          </div>

          <button className="new-complaint-button" onClick={onRaiseComplaint}>
            <Plus size={18} />
            Raise Complaint
          </button>
        </section>

        {/* Statistics Grid */}
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon stat-total">
              <ClipboardList size={22} />
            </div>
            <div>
              <span className="stat-value">{total}</span>
              <span className="stat-label">Total Complaints</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-pending">
              <Clock size={22} />
            </div>
            <div>
              <span className="stat-value">{pending}</span>
              <span className="stat-label">Pending Review</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-progress">
              <AlertCircle size={22} />
            </div>
            <div>
              <span className="stat-value">{inProgress}</span>
              <span className="stat-label">In Progress</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-resolved">
              <CheckCircle size={22} />
            </div>
            <div>
              <span className="stat-value">{resolved}</span>
              <span className="stat-label">Resolved</span>
            </div>
          </div>
        </section>

        {/* Recent Activity */}
        <section className="recent-section">
          <div className="section-header">
            <h2>Recent Activity</h2>
            <button className="view-all-button" onClick={onViewHistory}>
              View All History <ChevronRight size={16} />
            </button>
          </div>

          {recentComplaints.length > 0 ? (
            <div className="complaints-list">
              {recentComplaints.map((complaint) => (
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
                    </div>

                    <h3>{complaint.title}</h3>
                    <p>{complaint.description}</p>

                    <div className="complaint-meta">
                      <span>{complaint.category}</span>
                      <span>Room {complaint.room}</span>
                      <span>{complaint.createdAt}</span>
                      {complaint.assignedStaff && (
                        <span>Staff: {complaint.assignedStaff}</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {complaint.status === "resolved" && (
                      <button
                        type="button"
                        onClick={(e) => handleOpenFeedback(complaint, e)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          border: "1px solid #f59e0b",
                          background: "#fffbeb",
                          color: "#b45309",
                          fontSize: "13px",
                          fontWeight: 500,
                        }}
                      >
                        <Star size={14} /> Leave Feedback
                      </button>
                    )}
                    <span className="complaint-arrow">
                      <ChevronRight size={20} />
                    </span>
                  </div>
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
                No complaints submitted yet
              </h3>
              <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: "14px" }}>
                Everything looks good in your room! If you face any maintenance issue, click "Raise Complaint" above.
              </p>
              <button className="new-complaint-button" onClick={onRaiseComplaint}>
                <Plus size={16} /> Raise First Complaint
              </button>
            </div>
          )}
        </section>
      </main>

      {/* Feedback Modal */}
      {feedbackModalComplaint && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 1000,
          }}
          onClick={() => !isSubmittingFeedback && setFeedbackModalComplaint(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "28px",
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 8px", fontSize: "20px", color: "#0f172a" }}>
              Resolution Feedback
            </h2>
            <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: "14px" }}>
              How satisfied are you with the resolution of #{feedbackModalComplaint.id}?
            </p>

            {feedbackMessage ? (
              <div
                style={{
                  padding: "16px",
                  background: "#f0fdf4",
                  color: "#166534",
                  borderRadius: "8px",
                  fontSize: "14px",
                  textAlign: "center",
                }}
              >
                {feedbackMessage}
              </div>
            ) : (
              <form onSubmit={handleSubmitFeedback}>
                <div style={{ marginBottom: "20px", textAlign: "center" }}>
                  <label style={{ display: "block", marginBottom: "10px", fontSize: "14px", fontWeight: 600 }}>
                    Rating (1 to 5 Stars)
                  </label>
                  <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setFeedbackRating(star)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: star <= feedbackRating ? "#f59e0b" : "#cbd5e1",
                          padding: "4px",
                        }}
                      >
                        <Star size={32} fill={star <= feedbackRating ? "#f59e0b" : "none"} />
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600 }}>
                    Comments (Optional)
                  </label>
                  <textarea
                    value={feedbackComments}
                    onChange={(e) => setFeedbackComments(e.target.value)}
                    placeholder="Share any comments on technician punctuality, work quality, etc."
                    rows={4}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setFeedbackModalComplaint(null)}
                    disabled={isSubmittingFeedback}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      background: "white",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingFeedback}
                    style={{
                      padding: "8px 18px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#2563eb",
                      color: "white",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {isSubmittingFeedback ? "Submitting..." : "Submit Feedback"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}