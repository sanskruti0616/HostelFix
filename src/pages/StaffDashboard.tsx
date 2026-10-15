import { useState, useMemo, useRef } from "react"
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LogOut,
  Package,
  RefreshCw,
  Search,
  Wrench,
  X,
} from "lucide-react"
import type { Complaint, ComplaintStatus, User } from "../types"
import { api } from "../services/api"

interface StaffDashboardProps {
  currentUser: User
  complaints: Complaint[]
  onLogout: () => void
  onViewComplaint: (complaint: Complaint) => void
  onStatusChange: (complaintId: string, status: ComplaintStatus, note?: string) => void
  onRefresh?: () => void
}

export default function StaffDashboard({
  currentUser,
  complaints,
  onLogout,
  onViewComplaint,
  onStatusChange,
  onRefresh,
}: StaffDashboardProps) {
  const [search, setSearch] = useState("")
  const [resolutionModalComplaint, setResolutionModalComplaint] = useState<Complaint | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [resolutionFiles, setResolutionFiles] = useState<File[]>([])
  const [resolutionPreviews, setResolutionPreviews] = useState<string[]>([])
  const [isUploadingResolution, setIsUploadingResolution] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Filter complaints assigned to this logged-in technician
  const assignedComplaints = useMemo(() => {
    return complaints.filter((c) => {
      // Check assignedStaff name or assignedStaffId
      if (c.assignedStaffId && c.assignedStaffId === currentUser.id) return true
      if (c.assignedStaff && c.assignedStaff.toLowerCase() === currentUser.name.toLowerCase()) return true
      return false
    })
  }, [complaints, currentUser])

  const filteredComplaints = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return assignedComplaints
    return assignedComplaints.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.room.toLowerCase().includes(query) ||
        c.category.toLowerCase().includes(query) ||
        c.id.toLowerCase().includes(query)
    )
  }, [assignedComplaints, search])

  // Real statistics
  const totalAssigned = assignedComplaints.length
  const pending = assignedComplaints.filter((c) => c.status === "assigned").length
  const inProgress = assignedComplaints.filter(
    (c) => c.status === "in-progress" || c.status === "need-material"
  ).length
  const resolved = assignedComplaints.filter(
    (c) => c.status === "resolved" || c.status === "closed"
  ).length

  const handleOpenResolutionModal = (complaint: Complaint, e: React.MouseEvent) => {
    e.stopPropagation()
    setResolutionModalComplaint(complaint)
    setResolutionNotes("")
    setResolutionFiles([])
    setResolutionPreviews([])
  }

  const handleResolutionFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setResolutionFiles((prev) => [...prev, ...files])
    const newPreviews = files.map((f) => URL.createObjectURL(f))
    setResolutionPreviews((prev) => [...prev, ...newPreviews])
  }

  const handleRemoveResolutionFile = (idx: number) => {
    setResolutionFiles((prev) => prev.filter((_, i) => i !== idx))
    setResolutionPreviews((prev) => {
      URL.revokeObjectURL(prev[idx])
      return prev.filter((_, i) => i !== idx)
    })
  }

  const handleSubmitResolution = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resolutionModalComplaint) return
    setIsUploadingResolution(true)

    try {
      if (resolutionFiles.length > 0) {
        await api.uploads.uploadResolution(
          resolutionModalComplaint.id,
          resolutionFiles,
          resolutionNotes || "Work completed by technician"
        )
      }

      await onStatusChange(
        resolutionModalComplaint.id,
        "resolved",
        resolutionNotes || "Maintenance completed"
      )

      setResolutionModalComplaint(null)
    } catch (err: any) {
      alert(err.message || "Failed to mark as completed")
    } finally {
      setIsUploadingResolution(false)
    }
  }

  return (
    <div className="dashboard-page">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-brand">
          <div className="brand-icon">
            <Wrench size={22} />
          </div>
          <div>
            <h2>HostelFix</h2>
            <span>Maintenance Staff Portal</span>
          </div>
        </div>

        <div className="header-user">
          {onRefresh && (
            <button
              className="header-logout"
              onClick={onRefresh}
              title="Refresh"
              style={{ marginRight: "12px" }}
            >
              <RefreshCw size={18} />
            </button>
          )}

          <div className="user-avatar">
            {currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : "ST"}
          </div>

          <div className="header-user-info">
            <strong>{currentUser.name}</strong>
            <span>Technician</span>
          </div>

          <button className="header-logout" onClick={onLogout} title="Logout">
            <LogOut size={19} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Welcome */}
        <section className="welcome-section">
          <div>
            <p className="eyebrow">
              <Wrench size={15} />
              MAINTENANCE TASK LIST
            </p>
            <h1>Hello, {currentUser.name} 👋</h1>
            <p>You have {pending + inProgress} active maintenance tasks to attend to.</p>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon stat-total">
              <Wrench size={22} />
            </div>
            <div>
              <span className="stat-value">{totalAssigned}</span>
              <span className="stat-label">Assigned Tasks</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-pending">
              <Clock3 size={22} />
            </div>
            <div>
              <span className="stat-value">{pending}</span>
              <span className="stat-label">Pending Acceptance</span>
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
              <CheckCircle2 size={22} />
            </div>
            <div>
              <span className="stat-value">{resolved}</span>
              <span className="stat-label">Completed</span>
            </div>
          </div>
        </section>

        {/* Search */}
        <div style={{ margin: "24px 0", position: "relative" }}>
          <Search
            size={18}
            style={{ position: "absolute", left: "14px", top: "12px", color: "#94a3b8" }}
          />
          <input
            type="text"
            placeholder="Search your assigned tasks by ID, room, or problem..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px 10px 42px",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
              fontSize: "14px",
              background: "white",
            }}
          />
        </div>

        {/* Tasks List */}
        <section className="tasks-section">
          {filteredComplaints.length > 0 ? (
            <div className="complaints-list">
              {filteredComplaints.map((complaint) => (
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
                      <span>🏠 Room {complaint.room}</span>
                      <span>🏢 {complaint.hostel}</span>
                      <span>🏷️ {complaint.category}</span>
                      <span>👤 Student: {complaint.studentName}</span>
                    </div>
                  </div>

                  {/* Technician status action buttons */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {complaint.status === "assigned" && (
                      <button
                        type="button"
                        onClick={() => onStatusChange(complaint.id, "in-progress", "Started work on site")}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          border: "none",
                          background: "#2563eb",
                          color: "white",
                          fontWeight: 600,
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        Start Work
                      </button>
                    )}

                    {complaint.status === "in-progress" && (
                      <>
                        <button
                          type="button"
                          onClick={() => onStatusChange(complaint.id, "need-material", "Waiting for replacement parts")}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: "1px solid #f59e0b",
                            background: "#fffbeb",
                            color: "#b45309",
                            fontSize: "12px",
                            cursor: "pointer",
                          }}
                        >
                          <Package size={13} style={{ verticalAlign: "middle", marginRight: "4px" }} />
                          Need Parts
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleOpenResolutionModal(complaint, e)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            border: "none",
                            background: "#16a34a",
                            color: "white",
                            fontWeight: 600,
                            fontSize: "13px",
                            cursor: "pointer",
                          }}
                        >
                          <CheckCircle2 size={14} style={{ verticalAlign: "middle", marginRight: "4px" }} />
                          Mark Resolved
                        </button>
                      </>
                    )}

                    {complaint.status === "need-material" && (
                      <button
                        type="button"
                        onClick={() => onStatusChange(complaint.id, "in-progress", "Material received, resuming repair")}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          border: "none",
                          background: "#2563eb",
                          color: "white",
                          fontWeight: 600,
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        Resume Work
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
              <Wrench size={38} color="#94a3b8" style={{ marginBottom: "12px" }} />
              <h3 style={{ margin: "0 0 6px", color: "#1e293b", fontSize: "18px" }}>
                No maintenance tasks assigned
              </h3>
              <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
                {search
                  ? "No tasks match your search filter."
                  : "You currently have no maintenance assignments pending."}
              </p>
            </div>
          )}
        </section>
      </main>

      {/* Resolution Photo Upload Modal */}
      {resolutionModalComplaint && (
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
          onClick={() => !isUploadingResolution && setResolutionModalComplaint(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "28px",
              maxWidth: "500px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 8px", fontSize: "20px", color: "#0f172a" }}>
              Complete Maintenance: #{resolutionModalComplaint.id}
            </h2>
            <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: "14px" }}>
              Upload photographic evidence of the completed repair for student and warden review.
            </p>

            <form onSubmit={handleSubmitResolution}>
              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600 }}>
                  Work Notes / Resolution Details
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="e.g. Replaced leaking tap washer and tested water flow without leaks."
                  rows={3}
                  required
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Photos */}
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600 }}>
                  Attach Resolution Photograph (Optional)
                </label>

                {resolutionPreviews.length > 0 && (
                  <div style={{ display: "flex", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
                    {resolutionPreviews.map((url, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: "relative",
                          width: "90px",
                          height: "90px",
                          borderRadius: "8px",
                          overflow: "hidden",
                          border: "1px solid #cbd5e1",
                        }}
                      >
                        <img src={url} alt="resolution" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button
                          type="button"
                          onClick={() => handleRemoveResolutionFile(idx)}
                          style={{
                            position: "absolute",
                            top: "4px",
                            right: "4px",
                            background: "rgba(0,0,0,0.7)",
                            color: "white",
                            border: "none",
                            borderRadius: "50%",
                            width: "20px",
                            height: "20px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px dashed #94a3b8",
                    background: "#f8fafc",
                    cursor: "pointer",
                    fontSize: "13px",
                    color: "#475569",
                  }}
                >
                  <Camera size={16} /> Select Photo from Device
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  hidden
                  onChange={handleResolutionFileChange}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setResolutionModalComplaint(null)}
                  disabled={isUploadingResolution}
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
                  disabled={isUploadingResolution}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#16a34a",
                    color: "white",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {isUploadingResolution ? "Uploading & Resolving..." : "Confirm Resolved"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}