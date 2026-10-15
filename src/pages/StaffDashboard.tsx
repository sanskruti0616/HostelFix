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
  RotateCcw,
  Search,
  Upload,
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
  const [workPerformed, setWorkPerformed] = useState("Parts Replaced / Repaired")
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [resolutionFiles, setResolutionFiles] = useState<File[]>([])
  const [resolutionPreviews, setResolutionPreviews] = useState<string[]>([])
  const [isUploadingResolution, setIsUploadingResolution] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Filter complaints assigned to this logged-in technician
  const assignedComplaints = useMemo(() => {
    return complaints.filter((c) => {
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

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsCameraOpen(false)
    setCameraError(null)
  }

  const startCamera = async () => {
    setCameraError(null)
    setIsCameraOpen(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (err: any) {
      console.error("Camera access failed:", err)
      setCameraError("Camera access denied or unavailable. Please use 'Upload Completion Photo' instead.")
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], `completion_${Date.now()}.jpg`, { type: "image/jpeg" })
            setResolutionFiles((prev) => [...prev, file])
            setResolutionPreviews((prev) => [...prev, URL.createObjectURL(file)])
            stopCamera()
          }
        },
        "image/jpeg",
        0.88
      )
    }
  }

  const handleOpenResolutionModal = (complaint: Complaint, e: React.MouseEvent) => {
    e.stopPropagation()
    setResolutionModalComplaint(complaint)
    setWorkPerformed("Parts Replaced / Repaired")
    setResolutionNotes("")
    setResolutionFiles([])
    setResolutionPreviews([])
    stopCamera()
  }

  const handleCloseResolutionModal = () => {
    if (isUploadingResolution) return
    stopCamera()
    setResolutionModalComplaint(null)
  }

  const handleResolutionFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setResolutionFiles((prev) => [...prev, ...files])
    const newPreviews = files.map((f) => URL.createObjectURL(f))
    setResolutionPreviews((prev) => [...prev, ...newPreviews])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleRemoveResolutionFile = (idx: number) => {
    setResolutionFiles((prev) => prev.filter((_, i) => i !== idx))
    setResolutionPreviews((prev) => {
      URL.revokeObjectURL(prev[idx])
      return prev.filter((_, i) => i !== idx)
    })
  }

  const handleRetakePhoto = (idx: number) => {
    handleRemoveResolutionFile(idx)
    startCamera()
  }

  const handleSubmitResolution = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resolutionModalComplaint) return
    setIsUploadingResolution(true)

    const fullNotes = `[${workPerformed}] ${resolutionNotes.trim()}`

    try {
      if (resolutionFiles.length > 0) {
        await api.uploads.uploadResolution(
          resolutionModalComplaint.id,
          resolutionFiles,
          fullNotes
        )
      }

      await onStatusChange(
        resolutionModalComplaint.id,
        "resolved",
        fullNotes
      )

      handleCloseResolutionModal()
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
            background: "rgba(15, 23, 42, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 1000,
            backdropFilter: "blur(4px)",
          }}
          onClick={handleCloseResolutionModal}
        >
          <div
            style={{
              background: "white",
              borderRadius: "18px",
              padding: "28px",
              maxWidth: "540px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
              <div>
                <h2 style={{ margin: "0 0 4px", fontSize: "20px", color: "#0f172a" }}>
                  Complete Maintenance: #{resolutionModalComplaint.id}
                </h2>
                <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
                  {resolutionModalComplaint.title} · Room {resolutionModalComplaint.room}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseResolutionModal}
                disabled={isUploadingResolution}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "8px",
                  padding: "6px",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitResolution}>
              {/* Work Category / Action Performed */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "13.5px", fontWeight: 700, color: "#1e293b" }}>
                  Work Performed / Action Taken
                </label>
                <select
                  value={workPerformed}
                  onChange={(e) => setWorkPerformed(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "9px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13.5px",
                    background: "#f8fafc",
                    fontFamily: "inherit",
                    fontWeight: 500,
                  }}
                >
                  <option value="Parts Replaced / Repaired">Parts Replaced / Repaired</option>
                  <option value="Electrical Component Fixed">Electrical Component Fixed</option>
                  <option value="Plumbing & Leak Sealed">Plumbing & Leak Sealed</option>
                  <option value="Carpentry / Door / Lock Repaired">Carpentry / Door / Lock Repaired</option>
                  <option value="Appliance / Fan Serviced">Appliance / Fan Serviced</option>
                  <option value="Sanitation / Cleaning Completed">Sanitation / Cleaning Completed</option>
                  <option value="General Maintenance & Inspection">General Maintenance & Inspection</option>
                </select>
              </div>

              {/* Work Notes */}
              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "13.5px", fontWeight: 700, color: "#1e293b" }}>
                  Resolution Notes & Verification Details
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="e.g. Replaced leaking valve with new brass fitting, tested water pressure for 10 minutes with no leaks detected."
                  rows={3}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "9px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13.5px",
                    fontFamily: "inherit",
                    lineHeight: 1.5,
                  }}
                />
              </div>

              {/* Completion Photos Section */}
              <div style={{ marginBottom: "22px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "13.5px", fontWeight: 700, color: "#1e293b" }}>
                  Photographic Proof of Resolution
                </label>
                <p style={{ margin: "0 0 10px", color: "#64748b", fontSize: "12px" }}>
                  Provide completion photographs to certify work quality before marking resolved.
                </p>

                {/* Previews Grid */}
                {resolutionPreviews.length > 0 && (
                  <div style={{ display: "flex", gap: "12px", marginBottom: "14px", flexWrap: "wrap" }}>
                    {resolutionPreviews.map((url, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: "relative",
                          width: "100px",
                          height: "100px",
                          borderRadius: "10px",
                          overflow: "hidden",
                          border: "1.5px solid #cbd5e1",
                          boxShadow: "0 2px 5px rgba(0,0,0,0.06)",
                        }}
                      >
                        <img src={url} alt={`completion-${idx}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        
                        {/* Remove Action */}
                        <button
                          type="button"
                          onClick={() => handleRemoveResolutionFile(idx)}
                          title="Remove Photo"
                          style={{
                            position: "absolute",
                            top: "4px",
                            right: "4px",
                            background: "rgba(15, 23, 42, 0.75)",
                            color: "white",
                            border: "none",
                            borderRadius: "50%",
                            width: "22px",
                            height: "22px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <X size={12} />
                        </button>

                        {/* Retake Action */}
                        <button
                          type="button"
                          onClick={() => handleRetakePhoto(idx)}
                          title="Retake Photo"
                          style={{
                            position: "absolute",
                            bottom: "4px",
                            right: "4px",
                            background: "rgba(15, 23, 42, 0.75)",
                            color: "white",
                            border: "none",
                            borderRadius: "50%",
                            width: "22px",
                            height: "22px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <RotateCcw size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Live Camera Viewfinder Overlay */}
                {isCameraOpen && (
                  <div
                    style={{
                      background: "#0f172a",
                      borderRadius: "12px",
                      padding: "12px",
                      marginBottom: "14px",
                      color: "white",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ position: "relative", borderRadius: "8px", overflow: "hidden", background: "black", minHeight: "220px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ width: "100%", maxHeight: "240px", objectFit: "cover" }}
                      />
                      {cameraError && (
                        <div style={{ position: "absolute", inset: 0, padding: "20px", background: "rgba(15, 23, 42, 0.9)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                          <AlertCircle size={28} color="#ef4444" style={{ marginBottom: "8px" }} />
                          <p style={{ margin: 0, fontSize: "12.5px", color: "#fca5a5" }}>{cameraError}</p>
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "12px" }}>
                      {!cameraError && (
                        <button
                          type="button"
                          onClick={capturePhoto}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "8px 18px",
                            borderRadius: "8px",
                            border: "none",
                            background: "#16a34a",
                            color: "white",
                            fontWeight: 700,
                            fontSize: "13px",
                            cursor: "pointer",
                          }}
                        >
                          <Camera size={16} /> Snap Frame
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={stopCamera}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "8px",
                          border: "1px solid #475569",
                          background: "#1e293b",
                          color: "white",
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        Close Camera
                      </button>
                    </div>
                  </div>
                )}

                {/* Dual Action Buttons: Take Photo & Upload Photo */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={startCamera}
                    disabled={isUploadingResolution}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "7px",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1.5px solid #6366f1",
                      background: "#eef2ff",
                      color: "#4f46e5",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 600,
                      transition: "all 0.2s ease",
                    }}
                  >
                    <Camera size={16} /> Take Completion Photo
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingResolution}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "7px",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1.5px solid #cbd5e1",
                      background: "#f8fafc",
                      color: "#334155",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 600,
                      transition: "all 0.2s ease",
                    }}
                  >
                    <Upload size={16} /> Upload Completion Photo
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    multiple
                    hidden
                    onChange={handleResolutionFileChange}
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #f1f5f9", paddingTop: "18px" }}>
                <button
                  type="button"
                  onClick={handleCloseResolutionModal}
                  disabled={isUploadingResolution}
                  style={{
                    padding: "9px 18px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    background: "white",
                    color: "#475569",
                    fontWeight: 600,
                    fontSize: "13.5px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingResolution}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "9px 20px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#16a34a",
                    color: "white",
                    fontWeight: 700,
                    fontSize: "13.5px",
                    cursor: isUploadingResolution ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(22, 163, 74, 0.2)",
                  }}
                >
                  <CheckCircle2 size={16} />
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