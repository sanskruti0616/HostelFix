import { useState, useMemo, useRef } from "react"
import {
  AlertCircle,
  Briefcase,
  Building,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock3,
  History,
  LogOut,
  Mail,
  Package,
  Phone,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Shield,
  Star,
  Upload,
  User as UserIcon,
  Wrench,
  X,
  CalendarClock,
} from "lucide-react"
import type { Complaint, ComplaintStatus, User } from "../types"
import { api } from "../services/api"
import PreventiveMaintenancePlanner from "../components/PreventiveMaintenancePlanner"

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
  const [activeTab, setActiveTab] = useState<"assigned" | "scheduled" | "history" | "profile">("assigned")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [historySearch, setHistorySearch] = useState("")
  const [historyRatingFilter, setHistoryRatingFilter] = useState<string>("all")

  // Profile edit state
  const [phoneInput, setPhoneInput] = useState(currentUser.phone || "")
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileSaveSuccess, setProfileSaveSuccess] = useState<string | null>(null)
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null)

  // Zoom modal for photos
  const [zoomImage, setZoomImage] = useState<string | null>(null)

  // Resolution modal state
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

  // Active / pending tasks
  const activeTasks = useMemo(() => {
    return assignedComplaints.filter(
      (c) => c.status !== "resolved" && c.status !== "closed"
    )
  }, [assignedComplaints])

  const filteredActiveTasks = useMemo(() => {
    const query = search.trim().toLowerCase()
    return activeTasks.filter((c) => {
      const matchesSearch =
        !query ||
        c.title.toLowerCase().includes(query) ||
        c.room.toLowerCase().includes(query) ||
        c.category.toLowerCase().includes(query) ||
        c.id.toLowerCase().includes(query) ||
        c.studentName.toLowerCase().includes(query)

      const matchesStatus = statusFilter === "all" || c.status === statusFilter
      const matchesPriority = priorityFilter === "all" || c.priority === priorityFilter
      const matchesCategory = categoryFilter === "all" || c.category === categoryFilter

      return matchesSearch && matchesStatus && matchesPriority && matchesCategory
    })
  }, [activeTasks, search, statusFilter, priorityFilter, categoryFilter])

  // Completed work history
  const completedComplaints = useMemo(() => {
    return assignedComplaints.filter(
      (c) => c.status === "resolved" || c.status === "closed"
    )
  }, [assignedComplaints])

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase()
    return completedComplaints.filter((c) => {
      const matchesSearch =
        !query ||
        c.title.toLowerCase().includes(query) ||
        c.room.toLowerCase().includes(query) ||
        c.category.toLowerCase().includes(query) ||
        c.id.toLowerCase().includes(query) ||
        c.studentName.toLowerCase().includes(query) ||
        (c.workNotes && c.workNotes.toLowerCase().includes(query))

      const matchesRating =
        historyRatingFilter === "all" ||
        (historyRatingFilter === "rated" && c.rating && c.rating > 0) ||
        (historyRatingFilter === "unrated" && !c.rating) ||
        (c.rating && String(c.rating) === historyRatingFilter)

      return matchesSearch && matchesRating
    })
  }, [completedComplaints, historySearch, historyRatingFilter])

  // Real statistics
  const totalAssigned = assignedComplaints.length
  const pending = assignedComplaints.filter((c) => c.status === "assigned").length
  const inProgress = assignedComplaints.filter(
    (c) => c.status === "in-progress" || c.status === "need-material"
  ).length
  const urgentCount = activeTasks.filter(
    (c) => c.priority === "urgent" || c.priority === "high"
  ).length
  const resolved = completedComplaints.length

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

    if (
      resolutionFiles.length === 0 &&
      (!resolutionModalComplaint.resolutionImages || resolutionModalComplaint.resolutionImages.length === 0)
    ) {
      alert("A completion photograph is mandatory before marking this complaint as resolved.")
      return
    }

    if (!resolutionNotes.trim()) {
      alert("Please enter resolution notes describing the work completed.")
      return
    }

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
      if (onRefresh) onRefresh()
    } catch (err: any) {
      alert(err.message || "Failed to mark as completed")
    } finally {
      setIsUploadingResolution(false)
    }
  }

  // Handle phone update in profile
  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingProfile(true)
    setProfileSaveSuccess(null)
    setProfileSaveError(null)

    try {
      await api.auth.updateProfile({ phone: phoneInput.trim() })
      setProfileSaveSuccess("Phone number updated successfully!")
      currentUser.phone = phoneInput.trim()
      if (onRefresh) onRefresh()
      setTimeout(() => setProfileSaveSuccess(null), 3000)
    } catch (err: any) {
      setProfileSaveError(err.message || "Failed to update phone number")
    } finally {
      setIsSavingProfile(false)
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
            <span>
              Maintenance Staff Portal {currentUser.hostel ? `· ${currentUser.hostel}` : ""}
            </span>
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
            <span>{currentUser.specialization || "Technician"}</span>
          </div>

          <button className="header-logout" onClick={onLogout} title="Logout">
            <LogOut size={19} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Welcome Section */}
        <section className="welcome-section">
          <div>
            <p className="eyebrow">
              <Wrench size={15} />
              MAINTENANCE PORTAL
            </p>
            <h1>Hello, {currentUser.name} 👋</h1>
            <p>
              Specialization: <strong>{currentUser.specialization || "General Maintenance"}</strong> · Assigned to {currentUser.hostel || "your hostel property"}.
            </p>
          </div>
        </section>

        {/* Tab Switcher */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            borderBottom: "2px solid #e2e8f0",
            marginBottom: "24px",
            paddingBottom: "4px",
            overflowX: "auto",
            whiteSpace: "nowrap",
            scrollbarWidth: "none",
          }}
        >
          <button
            onClick={() => setActiveTab("assigned")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              borderBottom: activeTab === "assigned" ? "3px solid #4f46e5" : "3px solid transparent",
              background: "transparent",
              color: activeTab === "assigned" ? "#4f46e5" : "#64748b",
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}
          >
            <Wrench size={18} />
            My Assigned Work ({pending + inProgress})
          </button>

          <button
            onClick={() => setActiveTab("scheduled")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              borderBottom: activeTab === "scheduled" ? "3px solid #4f46e5" : "3px solid transparent",
              background: "transparent",
              color: activeTab === "scheduled" ? "#4f46e5" : "#64748b",
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}
          >
            <CalendarClock size={18} />
            My Preventive Tasks
          </button>

          <button
            onClick={() => setActiveTab("history")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              borderBottom: activeTab === "history" ? "3px solid #4f46e5" : "3px solid transparent",
              background: "transparent",
              color: activeTab === "history" ? "#4f46e5" : "#64748b",
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}
          >
            <History size={18} />
            Work History ({resolved})
          </button>

          <button
            onClick={() => setActiveTab("profile")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              borderBottom: activeTab === "profile" ? "3px solid #4f46e5" : "3px solid transparent",
              background: "transparent",
              color: activeTab === "profile" ? "#4f46e5" : "#64748b",
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}
          >
            <UserIcon size={18} />
            My Profile
          </button>
        </div>

        {/* TAB 1: ASSIGNED TASKS */}
        {activeTab === "assigned" && (
          <>
            {/* Stats Grid */}
            <section className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon stat-total">
                  <Wrench size={22} />
                </div>
                <div>
                  <span className="stat-value">{totalAssigned}</span>
                  <span className="stat-label">Total Assigned</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon stat-pending">
                  <Clock3 size={22} />
                </div>
                <div>
                  <span className="stat-value">{pending}</span>
                  <span className="stat-label">Awaiting Action</span>
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
                <div
                  className="stat-icon"
                  style={{
                    background: urgentCount > 0 ? "#fef2f2" : "#f8fafc",
                    color: urgentCount > 0 ? "#dc2626" : "#64748b",
                  }}
                >
                  <AlertCircle size={22} />
                </div>
                <div>
                  <span className="stat-value" style={{ color: urgentCount > 0 ? "#dc2626" : "#1e293b" }}>
                    {urgentCount}
                  </span>
                  <span className="stat-label">Urgent / High Priority</span>
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

            {/* Filter Bar */}
            <section className="filters-section" style={{ margin: "24px 0" }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "12px",
                  background: "white",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1, minWidth: "220px", position: "relative" }}>
                  <Search
                    size={18}
                    style={{ position: "absolute", left: "12px", top: "11px", color: "#94a3b8" }}
                  />
                  <input
                    type="text"
                    placeholder="Search active tasks by ID, room, student, or category..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px 9px 38px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      background: "white",
                    }}
                  >
                    <option value="all">All Active ({activeTasks.length})</option>
                    <option value="assigned">Awaiting Action ({pending})</option>
                    <option value="in-progress">In Progress</option>
                    <option value="need-material">Waiting for Parts</option>
                  </select>

                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    style={{
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      background: "white",
                    }}
                  >
                    <option value="all">All Priorities</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>

                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    style={{
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      background: "white",
                    }}
                  >
                    <option value="all">All Categories</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Plumbing">Plumbing</option>
                    <option value="Cleaning">Cleaning</option>
                    <option value="Furniture">Furniture</option>
                    <option value="Water Supply">Water Supply</option>
                    <option value="Security">Security</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Tasks List */}
            <section className="tasks-section">
              {filteredActiveTasks.length > 0 ? (
                <div className="complaints-list">
                  {filteredActiveTasks.map((complaint) => (
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
                          <span>📅 Filed: {complaint.createdAt}</span>
                        </div>

                        {/* Student Evidence Photographs Thumbnail Strip */}
                        {complaint.evidenceImages && complaint.evidenceImages.length > 0 && (
                          <div style={{ display: "flex", gap: "8px", marginTop: "10px", alignItems: "center" }}>
                            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Evidence:</span>
                            <div style={{ display: "flex", gap: "6px", overflowX: "auto" }}>
                              {complaint.evidenceImages.slice(0, 3).map((img, i) => (
                                <img
                                  key={i}
                                  src={img.url}
                                  alt="evidence thumbnail"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setZoomImage(img.url)
                                  }}
                                  title="Click to enlarge student evidence"
                                  style={{
                                    width: "44px",
                                    height: "44px",
                                    borderRadius: "6px",
                                    objectFit: "cover",
                                    border: "1.5px solid #cbd5e1",
                                    cursor: "zoom-in",
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Status Action Buttons */}
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
                              padding: "7px 14px",
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
                                padding: "6px 12px",
                                borderRadius: "6px",
                                border: "1px solid #f59e0b",
                                background: "#fffbeb",
                                color: "#b45309",
                                fontSize: "12px",
                                fontWeight: 600,
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
                                padding: "7px 14px",
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
                              padding: "7px 14px",
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
                    No active maintenance tasks
                  </h3>
                  <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
                    {search
                      ? "No active tasks match your search filter."
                      : "You currently have no maintenance tasks awaiting action."}
                  </p>
                </div>
              )}
            </section>
          </>
        )}

        {/* TAB: SCHEDULED PREVENTIVE MAINTENANCE */}
        {activeTab === "scheduled" && (
          <section className="scheduled-maintenance-section">
            <PreventiveMaintenancePlanner
              role="staff"
              currentUserId={currentUser.id}
              hostelId={currentUser.hostelId}
              hostelName={currentUser.hostel || currentUser.hostelName}
            />
          </section>
        )}

        {/* TAB 2: WORK HISTORY */}
        {activeTab === "history" && (
          <section className="work-history-section">
            <div style={{ marginBottom: "20px" }}>
              <h2 style={{ margin: "0 0 4px", fontSize: "20px", color: "#0f172a" }}>
                Completed Work History
              </h2>
              <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
                Past maintenance jobs completed by you with resolution photographs and student ratings.
              </p>
            </div>

            {/* History Search & Filters */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "20px",
                alignItems: "center",
              }}
            >
              <div style={{ flex: 1, minWidth: "220px", position: "relative" }}>
                <Search
                  size={18}
                  style={{ position: "absolute", left: "14px", top: "12px", color: "#94a3b8" }}
                />
                <input
                  type="text"
                  placeholder="Search completed jobs by room, title, category, or notes..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
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

              <select
                value={historyRatingFilter}
                onChange={(e) => setHistoryRatingFilter(e.target.value)}
                style={{
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                  background: "white",
                }}
              >
                <option value="all">All Reviews ({completedComplaints.length})</option>
                <option value="rated">Reviewed by Student</option>
                <option value="unrated">Awaiting Review</option>
                <option value="5">5 Stars (Excellent)</option>
                <option value="4">4 Stars (Good)</option>
                <option value="3">3 Stars (Fair)</option>
                <option value="2">2 Stars (Poor)</option>
                <option value="1">1 Star (Very Poor)</option>
              </select>
            </div>

            {filteredHistory.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {filteredHistory.map((complaint) => (
                  <div
                    key={complaint.id}
                    style={{
                      background: "white",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      padding: "20px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: "10px",
                        marginBottom: "10px",
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontWeight: 700,
                            color: "#4f46e5",
                            fontSize: "14px",
                            marginRight: "8px",
                          }}
                        >
                          {complaint.id}
                        </span>
                        <span className={`status-badge status-${complaint.status}`}>
                          {complaint.status}
                        </span>
                        <h3 style={{ margin: "6px 0 2px", fontSize: "17px", color: "#0f172a" }}>
                          {complaint.title}
                        </h3>
                        <div style={{ fontSize: "13px", color: "#64748b" }}>
                          Room {complaint.room} · {complaint.hostel} · Category: {complaint.category} · Student: {complaint.studentName}
                        </div>
                      </div>

                      {/* Rating stars if available */}
                      {complaint.rating ? (
                        <div
                          style={{
                            background: "#fef9c3",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: "1px solid #fef08a",
                            textAlign: "right",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "2px", color: "#ca8a04" }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                size={15}
                                fill={star <= complaint.rating! ? "#ca8a04" : "none"}
                              />
                            ))}
                            <span style={{ fontWeight: 700, marginLeft: "4px", fontSize: "14px" }}>
                              {complaint.rating}.0
                            </span>
                          </div>
                          {complaint.ratingComments && (
                            <div style={{ fontSize: "12px", color: "#854d0e", marginTop: "2px", maxWidth: "220px" }}>
                              "{complaint.ratingComments}"
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>
                          Awaiting student review
                        </div>
                      )}
                    </div>

                    {/* Work Notes */}
                    {complaint.workNotes && (
                      <div
                        style={{
                          background: "#f8fafc",
                          padding: "10px 14px",
                          borderRadius: "8px",
                          borderLeft: "3px solid #16a34a",
                          marginBottom: "12px",
                          fontSize: "13px",
                          color: "#334155",
                        }}
                      >
                        <strong>Resolution Notes:</strong> {complaint.workNotes}
                      </div>
                    )}

                    {/* Completion Photographs */}
                    {complaint.resolutionImages && complaint.resolutionImages.length > 0 ? (
                      <div>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "6px" }}>
                          Completion Evidence Photographs:
                        </div>
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                          {complaint.resolutionImages.map((img, i) => (
                            <img
                              key={i}
                              src={img.url}
                              alt={`Resolution proof ${i + 1}`}
                              onClick={() => setZoomImage(img.url)}
                              style={{
                                width: "80px",
                                height: "80px",
                                borderRadius: "8px",
                                objectFit: "cover",
                                border: "1px solid #cbd5e1",
                                cursor: "pointer",
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                        No completion photographs attached
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: "12px",
                        paddingTop: "10px",
                        borderTop: "1px solid #f1f5f9",
                        fontSize: "12px",
                        color: "#94a3b8",
                      }}
                    >
                      <span>Completed on: {complaint.resolvedAt || complaint.updatedAt || "N/A"}</span>
                      <button
                        onClick={() => onViewComplaint(complaint)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#4f46e5",
                          fontWeight: 600,
                          cursor: "pointer",
                          fontSize: "13px",
                        }}
                      >
                        View Full Details →
                      </button>
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
                <History size={38} color="#94a3b8" style={{ marginBottom: "12px" }} />
                <h3 style={{ margin: "0 0 6px", color: "#1e293b", fontSize: "18px" }}>
                  No completed work recorded
                </h3>
                <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
                  {historySearch
                    ? "No completed jobs match your search."
                    : "Jobs you resolve with completion photos will appear here in your work history."}
                </p>
              </div>
            )}
          </section>
        )}

        {/* TAB 3: MY PROFILE */}
        {activeTab === "profile" && (
          <section className="staff-profile-section" style={{ maxWidth: "680px" }}>
            <div
              style={{
                background: "white",
                borderRadius: "16px",
                border: "1px solid #e2e8f0",
                padding: "28px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    background: "#e0e7ff",
                    color: "#4f46e5",
                    fontSize: "24px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {currentUser.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 style={{ margin: "0 0 4px", fontSize: "20px", color: "#0f172a" }}>
                    {currentUser.name}
                  </h2>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 10px",
                      borderRadius: "12px",
                      background: "#dcfce7",
                      color: "#166534",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    Active Technician
                  </span>
                </div>
              </div>

              {profileSaveSuccess && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "#dcfce7",
                    color: "#166534",
                    borderRadius: "8px",
                    marginBottom: "18px",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>{profileSaveSuccess}</span>
                </div>
              )}

              {profileSaveError && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "#fee2e2",
                    color: "#991b1b",
                    borderRadius: "8px",
                    marginBottom: "18px",
                    fontSize: "13px",
                  }}
                >
                  {profileSaveError}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "4px" }}>
                    ACCOUNT ROLE
                  </label>
                  <div
                    style={{
                      padding: "10px 14px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      color: "#334155",
                      fontSize: "14px",
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Shield size={16} color="#64748b" />
                    Maintenance Staff (Technician)
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "4px" }}>
                    SPECIALIZATION
                  </label>
                  <div
                    style={{
                      padding: "10px 14px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      color: "#334155",
                      fontSize: "14px",
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Briefcase size={16} color="#64748b" />
                    {currentUser.specialization || "General Maintenance"}
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "4px" }}>
                    ASSIGNED HOSTEL & PROPERTY
                  </label>
                  <div
                    style={{
                      padding: "10px 14px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      color: "#334155",
                      fontSize: "14px",
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Building size={16} color="#64748b" />
                    {currentUser.hostel || "All Assigned Hostels"}
                    {currentUser.organizationName ? ` (${currentUser.organizationName})` : ""}
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "4px" }}>
                    EMAIL ADDRESS (LOGIN ID)
                  </label>
                  <div
                    style={{
                      padding: "10px 14px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      color: "#334155",
                      fontSize: "14px",
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Mail size={16} color="#64748b" />
                    {currentUser.email}
                  </div>
                </div>

                {/* Editable Phone Number */}
                <form onSubmit={handleSavePhone}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "4px" }}>
                    CONTACT PHONE NUMBER
                  </label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <div style={{ flex: 1, position: "relative" }}>
                      <Phone
                        size={16}
                        style={{ position: "absolute", left: "12px", top: "11px", color: "#94a3b8" }}
                      />
                      <input
                        type="tel"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder="Enter your mobile number"
                        style={{
                          width: "100%",
                          padding: "9px 12px 9px 36px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "14px",
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "9px 18px",
                        background: "#4f46e5",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: 600,
                        fontSize: "13px",
                        cursor: isSavingProfile ? "not-allowed" : "pointer",
                      }}
                    >
                      <Save size={15} />
                      {isSavingProfile ? "Saving..." : "Save Phone"}
                    </button>
                  </div>
                </form>

                <div
                  style={{
                    background: "#eff6ff",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    fontSize: "12.5px",
                    color: "#1e40af",
                    border: "1px solid #bfdbfe",
                    marginTop: "8px",
                  }}
                >
                  ℹ️ <strong>System Note:</strong> Your hostel property affiliation and maintenance specialization are governed by the Warden. To request transfer or specialization adjustments, contact your hostel administration.
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Full-size Image Zoom Modal */}
      {zoomImage && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setZoomImage(null)}
        >
          <div style={{ position: "relative", maxWidth: "90%", maxHeight: "90%" }}>
            <img
              src={zoomImage}
              alt="Enlarged evidence"
              style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: "8px", objectFit: "contain" }}
            />
            <button
              onClick={() => setZoomImage(null)}
              style={{
                position: "absolute",
                top: "-36px",
                right: 0,
                background: "white",
                border: "none",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Resolution Photo Upload & Completion Modal */}
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
                  Resolution Notes & Verification Details *
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
                  Photographic Proof of Resolution *
                </label>
                <p style={{ margin: "0 0 10px", color: "#64748b", fontSize: "12px" }}>
                  A completion photograph is mandatory to certify work quality before marking resolved.
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
                    <div
                      style={{
                        position: "relative",
                        borderRadius: "8px",
                        overflow: "hidden",
                        background: "black",
                        minHeight: "220px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ width: "100%", maxHeight: "240px", objectFit: "cover" }}
                      />
                      {cameraError && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            padding: "20px",
                            background: "rgba(15, 23, 42, 0.9)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
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
                          background: "transparent",
                          color: "#cbd5e1",
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        Cancel Camera
                      </button>
                    </div>
                  </div>
                )}

                {/* Upload Action Trigger Buttons */}
                {!isCameraOpen && (
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={startCamera}
                      style={{
                        flex: 1,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #4f46e5",
                        background: "#eef2ff",
                        color: "#4338ca",
                        fontWeight: 600,
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      <Camera size={16} /> Take Completion Photo
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        flex: 1,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        background: "white",
                        color: "#334155",
                        fontWeight: 600,
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      <Upload size={16} /> Upload Completion Photo
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleResolutionFileChange}
                      style={{ display: "none" }}
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={handleCloseResolutionModal}
                  disabled={isUploadingResolution}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "white",
                    color: "#475569",
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isUploadingResolution || resolutionFiles.length === 0 || !resolutionNotes.trim()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 22px",
                    borderRadius: "8px",
                    border: "none",
                    background:
                      resolutionFiles.length === 0 || !resolutionNotes.trim()
                        ? "#94a3b8"
                        : "#16a34a",
                    color: "white",
                    fontWeight: 700,
                    fontSize: "14px",
                    cursor:
                      resolutionFiles.length === 0 || !resolutionNotes.trim() || isUploadingResolution
                        ? "not-allowed"
                        : "pointer",
                    boxShadow: "0 2px 4px rgba(22, 163, 74, 0.25)",
                  }}
                >
                  <CheckCircle2 size={16} />
                  {isUploadingResolution ? "Uploading & Resolving..." : "Mark as Resolved"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}