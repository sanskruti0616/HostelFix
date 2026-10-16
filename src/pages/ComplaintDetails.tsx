import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Home,
  Image as ImageIcon,
  LoaderCircle,
  Sparkles,
  UserRound,
  Wrench,
  X,
  Star,
  Check,
  AlertTriangle,
} from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import type { Complaint, ComplaintStatus, ComplaintUpdate, User } from "../types"
import { api } from "../services/api"

interface ComplaintDetailsProps {
  complaint: Complaint
  currentUser?: User | null
  onBack: () => void
  isWarden?: boolean
  onStatusChange?: (status: ComplaintStatus, note?: string) => void
  onAssignStaff?: (staffName: string) => void
  onRefreshComplaint?: () => void
}

const RATING_LABELS: Record<number, string> = {
  1: "Very poor",
  2: "Poor",
  3: "Fair",
  4: "Good",
  5: "Excellent",
}

export default function ComplaintDetails({
  complaint,
  currentUser,
  onBack,
  isWarden = false,
  onStatusChange,
  onAssignStaff,
  onRefreshComplaint,
}: ComplaintDetailsProps) {
  const [history, setHistory] = useState<ComplaintUpdate[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [staffOptions, setStaffOptions] = useState<{ id: string; name: string; specialization?: string }[]>([])
  const [selectedStaff, setSelectedStaff] = useState(complaint.assignedStaffId || complaint.assignedStaff || "")
  const [activeImageZoom, setActiveImageZoom] = useState<string | null>(null)

  // Student Rating State
  const [ratingValue, setRatingValue] = useState<number>(5)
  const [ratingHover, setRatingHover] = useState<number>(0)
  const [ratingComments, setRatingComments] = useState<string>("")
  const [workQuality, setWorkQuality] = useState<number>(5)
  const [timeliness, setTimeliness] = useState<number>(5)
  const [professionalism, setProfessionalism] = useState<number>(5)
  const [isSubmittingRating, setIsSubmittingRating] = useState(false)
  const [ratingSuccess, setRatingSuccess] = useState<string | null>(null)
  const [ratingError, setRatingError] = useState<string | null>(null)

  // Warden verification dialog state
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false)
  const [verifyAction, setVerifyAction] = useState<"approve" | "reject" | "request_info">("approve")
  const [verifyReason, setVerifyReason] = useState("")
  const [isSubmittingVerify, setIsSubmittingVerify] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null)

  // Load real history from backend
  useEffect(() => {
    let isMounted = true
    setIsLoadingHistory(true)
    api.complaints.getUpdates(complaint.id)
      .then((res) => {
        if (isMounted) setHistory(res.updates || [])
      })
      .catch((err) => {
        console.error("Failed to load timeline:", err)
        if (isMounted) setHistory([])
      })
      .finally(() => {
        if (isMounted) setIsLoadingHistory(false)
      })

    return () => {
      isMounted = false
    }
  }, [complaint.id])

  // Load active staff technicians for warden assignment (strictly scoped to hostel)
  useEffect(() => {
    if (isWarden) {
      api.staff.list({ status: "active" })
        .then((res) => {
          const staffList = (res.staff || []).map((s) => ({
            id: s.id,
            name: s.name,
            specialization: s.specialization,
          }))
          setStaffOptions(staffList)
          if (complaint.assignedStaff && !complaint.assignedStaffId) {
            const match = staffList.find((s) => s.name === complaint.assignedStaff)
            if (match) setSelectedStaff(match.id)
          }
        })
        .catch((err) => console.warn("Failed to load staff list:", err))
    }
  }, [isWarden, complaint.assignedStaff, complaint.assignedStaffId])

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingVerify(true)
    setVerifyError(null)
    setVerifySuccess(null)
    try {
      const res = await api.complaints.verify(complaint.id, verifyAction, verifyReason)
      setVerifySuccess(res.message || `Complaint verification updated: ${verifyAction}`)
      onRefreshComplaint?.()
      setTimeout(() => {
        setVerifyDialogOpen(false)
        setVerifySuccess(null)
      }, 700)
    } catch (err: any) {
      setVerifyError(err.message || "Failed to update verification. Please try again.")
    } finally {
      setIsSubmittingVerify(false)
    }
  }

  const handleRatingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingRating(true)
    setRatingError(null)
    setRatingSuccess(null)
    try {
      await api.complaints.submitFeedback(complaint.id, ratingValue, ratingComments, {
        workQuality,
        timeliness,
        professionalism,
      })
      setRatingSuccess("Thank you! Your rating and feedback have been recorded.")
      onRefreshComplaint?.()
    } catch (err: any) {
      setRatingError(err.message || "Failed to submit rating. Please try again.")
    } finally {
      setIsSubmittingRating(false)
    }
  }

  const getTimelineTitle = (status: string) => {
    switch (status) {
      case "submitted":
        return "Complaint Submitted"
      case "pending_verification":
        return "Under AI & Warden Review"
      case "verified":
        return "Complaint Verified"
      case "assigned":
        return "Technician Assigned"
      case "in-progress":
        return "Work In Progress"
      case "need-material":
        return "Material Parts Required"
      case "cannot-complete":
        return "Unable To Complete"
      case "resolved":
        return "Work Completed"
      case "closed":
        return "Feedback Provided & Closed"
      case "needs_information":
        return "Additional Information Requested"
      case "rejected":
        return "Complaint Rejected"
      case "reopened":
        return "Complaint Reopened"
      default:
        return formatStatus(status)
    }
  }

  return (
    <div className="details-page">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-brand">
          <button className="back-button" onClick={onBack} type="button">
            <ArrowLeft size={19} />
          </button>
          <div className="brand-icon">
            <FileText size={22} />
          </div>
          <div>
            <h2>HostelFix</h2>
            <span>Complaint Details</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="details-main">
        {/* Title Bar */}
        <section className="details-title">
          <div>
            <p className="eyebrow">COMPLAINT {complaint.id}</p>
            <h1>{complaint.title}</h1>
            <p>Submitted on {formatDate(complaint.createdAt)}</p>
          </div>

          <div className="details-title-badges">
            <span className={`status-badge status-${complaint.status}`}>
              {formatStatus(complaint.status)}
            </span>
            <span className={`priority-badge priority-${complaint.priority}`}>
              {complaint.priority}
            </span>
          </div>
        </section>

        {/* AI Verification Assessment Card (For Warden/Admin) */}
        {complaint.verification && (
          <section
            style={{
              background: "white",
              borderRadius: "14px",
              padding: "20px",
              marginBottom: "20px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={20} color="#6366f1" />
                <h2 style={{ margin: 0, fontSize: "16px", color: "#1e293b" }}>
                  AI Validity & Duplicate Assessment
                </h2>
              </div>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: 600,
                  background:
                    complaint.verification.result === "verified"
                      ? "#dcfce7"
                      : complaint.verification.result === "potential_duplicate"
                      ? "#fee2e2"
                      : "#fef9c3",
                  color:
                    complaint.verification.result === "verified"
                      ? "#166534"
                      : complaint.verification.result === "potential_duplicate"
                      ? "#991b1b"
                      : "#854d0e",
                }}
              >
                {(complaint.verification.result || "pending").replace("_", " ").toUpperCase()} (
                {Math.round((complaint.verification.confidence || 0) * 100)}% Confidence)
              </span>
            </div>

            <p style={{ margin: "0 0 12px", fontSize: "14px", color: "#475569", lineHeight: 1.5 }}>
              {complaint.verification.explanation ||
                "Complaint evaluated against hostel category dictionary and perceptual image hash database."}
            </p>

            {/* Warden verification buttons */}
            {isWarden && (
              <div style={{ display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    setVerifyAction("approve")
                    setVerifyReason("Verified complaint evidence and description.")
                    setVerifyError(null)
                    setVerifySuccess(null)
                    setVerifyDialogOpen(true)
                  }}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: "none",
                    background: "#16a34a",
                    color: "white",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  ✓ Approve & Verify
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setVerifyAction("request_info")
                    setVerifyReason("Please provide clearer photos or more specific location details.")
                    setVerifyError(null)
                    setVerifySuccess(null)
                    setVerifyDialogOpen(true)
                  }}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: "1px solid #f59e0b",
                    background: "#fffbeb",
                    color: "#b45309",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Request More Info
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setVerifyAction("reject")
                    setVerifyReason("Does not meet hostel maintenance criteria or duplicate record.")
                    setVerifyError(null)
                    setVerifySuccess(null)
                    setVerifyDialogOpen(true)
                  }}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: "1px solid #ef4444",
                    background: "#fef2f2",
                    color: "#dc2626",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Reject Complaint
                </button>
              </div>
            )}
          </section>
        )}

        {/* Info Grid */}
        <section className="details-grid">
          <div className="details-card">
            <div className="details-card-header">
              <FileText size={20} />
              <h2>Complaint Information</h2>
            </div>

            <div className="details-info-grid">
              <InfoItem icon={<FileText size={17} />} label="Category" value={complaint.category} />
              <InfoItem icon={<Wrench size={17} />} label="Priority" value={complaint.priority} />
              <InfoItem icon={<Home size={17} />} label="Hostel" value={complaint.hostel} />
              <InfoItem icon={<Home size={17} />} label="Room" value={complaint.room} />
              <InfoItem icon={<CalendarDays size={17} />} label="Submitted" value={formatDate(complaint.createdAt)} />
              <InfoItem icon={<Clock3 size={17} />} label="Last Updated" value={formatDate(complaint.updatedAt)} />
            </div>
          </div>

          <div className="details-card">
            <div className="details-card-header">
              <UserRound size={20} />
              <h2>Student Contact</h2>
            </div>
            <div className="assigned-person">
              <div className="assigned-avatar">{getInitials(complaint.studentName)}</div>
              <div>
                <strong>{complaint.studentName}</strong>
                <span>Student ID: {complaint.studentId}</span>
                {complaint.studentEmail && (
                  <small style={{ display: "block", color: "#64748b" }}>{complaint.studentEmail}</small>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Assigned Staff Card */}
        <section className="details-card" style={{ marginTop: "20px" }}>
          <div className="details-card-header">
            <Wrench size={20} />
            <h2>Assigned Maintenance Technician</h2>
          </div>

          {complaint.assignedStaff ? (
            <div className="assigned-person">
              <div className="assigned-avatar">{getInitials(complaint.assignedStaff)}</div>
              <div>
                <strong>{complaint.assignedStaff}</strong>
                <span>Assigned Maintenance Staff</span>
              </div>
            </div>
          ) : (
            <div className="not-assigned">
              <Wrench size={20} />
              <div>
                <strong>Not assigned yet</strong>
                <span>A maintenance technician has not been assigned to this ticket.</span>
              </div>
            </div>
          )}
        </section>

        {/* Warden Management Section */}
        {isWarden && (
          <section className="warden-management-card" style={{ marginTop: "20px" }}>
            <div className="details-card-header">
              <Wrench size={20} />
              <div>
                <h2>Manage Assignment & Status</h2>
                <p>Assign technicians and advance the lifecycle state.</p>
              </div>
            </div>

            <div className="warden-management-grid">
              <div className="management-control">
                <label htmlFor="staff">Assign Technician</label>
                <select
                  id="staff"
                  value={selectedStaff}
                  onChange={(e) => {
                    setSelectedStaff(e.target.value)
                    if (e.target.value) {
                      onAssignStaff?.(e.target.value)
                    }
                  }}
                >
                  <option value="">Select technician</option>
                  {staffOptions.length > 0 ? (
                    staffOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.specialization || "General Maintenance"})
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>
                      No active technicians registered for this hostel
                    </option>
                  )}
                </select>
              </div>

              <div className="management-control">
                <label htmlFor="status">Update Lifecycle Status</label>
                <select
                  id="status"
                  value={complaint.status}
                  onChange={(e) => onStatusChange?.(e.target.value as ComplaintStatus)}
                >
                  <option value="submitted">Submitted</option>
                  <option value="verified">Verified</option>
                  <option value="assigned">Assigned</option>
                  <option value="in-progress">In Progress</option>
                  <option value="need-material">Need Material</option>
                  <option value="cannot-complete">Can't Complete</option>
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </section>
        )}

        {/* Description */}
        <section className="description-card" style={{ marginTop: "20px" }}>
          <div className="details-card-header">
            <FileText size={20} />
            <h2>Description</h2>
          </div>
          <p>{complaint.description}</p>
        </section>

        {/* Evidence Photographs Gallery */}
        {complaint.evidenceImages && complaint.evidenceImages.length > 0 && (
          <section className="details-card" style={{ marginTop: "20px" }}>
            <div className="details-card-header">
              <ImageIcon size={20} />
              <h2>Attached Evidence Photographs ({complaint.evidenceImages.length})</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
              {complaint.evidenceImages.map((img, idx) => {
                const imageUrl = img.url.startsWith("http")
                  ? img.url
                  : `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${img.url}`
                return (
                  <div
                    key={idx}
                    onClick={() => setActiveImageZoom(imageUrl)}
                    style={{
                      borderRadius: "10px",
                      overflow: "hidden",
                      border: "1px solid #e2e8f0",
                      height: "150px",
                      cursor: "zoom-in",
                      position: "relative",
                    }}
                  >
                    <img src={imageUrl} alt="evidence" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    {img.isBlurry && (
                      <span
                        style={{
                          position: "absolute",
                          bottom: "6px",
                          left: "6px",
                          background: "rgba(180, 83, 9, 0.85)",
                          color: "white",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "11px",
                        }}
                      >
                        ⚠️ Blurry
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Resolution Details & Photographs (Uploaded by Technician) */}
        {Boolean(complaint.workNotes || (complaint.resolutionImages && complaint.resolutionImages.length > 0)) && (
          <section className="details-card" style={{ marginTop: "20px", borderLeft: "4px solid #16a34a" }}>
            <div className="details-card-header">
              <CheckCircle2 size={20} color="#16a34a" />
              <div>
                <h2>Technician Resolution &amp; Completion Report</h2>
                <p>Maintenance completion notes and evidence recorded by technician</p>
              </div>
            </div>

            {complaint.workNotes && (
              <div
                style={{
                  padding: "14px 16px",
                  background: "#f0fdf4",
                  borderRadius: "10px",
                  border: "1px solid #bbf7d0",
                  marginBottom: complaint.resolutionImages && complaint.resolutionImages.length > 0 ? "16px" : "0",
                }}
              >
                <strong style={{ display: "block", fontSize: "13px", color: "#166534", marginBottom: "4px" }}>
                  Resolution Notes:
                </strong>
                <p style={{ margin: 0, fontSize: "14px", color: "#14532d", lineHeight: 1.5 }}>
                  {complaint.workNotes}
                </p>
                {complaint.resolvedAt && (
                  <small style={{ display: "block", marginTop: "8px", color: "#15803d", fontSize: "12px" }}>
                    Completed on {formatDate(complaint.resolvedAt)} {complaint.assignedStaff ? `by ${complaint.assignedStaff}` : ""}
                  </small>
                )}
              </div>
            )}

            {complaint.resolutionImages && complaint.resolutionImages.length > 0 && (
              <div>
                <strong style={{ display: "block", fontSize: "13px", color: "#334155", marginBottom: "10px" }}>
                  Completion Photographs ({complaint.resolutionImages.length}):
                </strong>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
                  {complaint.resolutionImages.map((img, idx) => {
                    const imageUrl = img.url.startsWith("http")
                      ? img.url
                      : `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${img.url}`
                    return (
                      <div
                        key={idx}
                        onClick={() => setActiveImageZoom(imageUrl)}
                        style={{
                          borderRadius: "10px",
                          overflow: "hidden",
                          border: "1px solid #bbf7d0",
                          height: "150px",
                          cursor: "zoom-in",
                        }}
                      >
                        <img src={imageUrl} alt="resolution" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Existing Rating Display Card */}
        {complaint.rating && (
          <section className="details-card" style={{ marginTop: "20px", borderLeft: "4px solid #f59e0b" }}>
            <div className="details-card-header">
              <Star size={20} color="#f59e0b" fill="#f59e0b" />
              <div>
                <h2>Student Service Rating &amp; Review</h2>
                <p>Feedback provided for maintenance resolution</p>
              </div>
            </div>

            <div style={{ padding: "16px", background: "#fffbeb", borderRadius: "12px", border: "1px solid #fef3c7" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <div style={{ display: "flex", gap: "4px" }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={20}
                      color={s <= complaint.rating! ? "#f59e0b" : "#cbd5e1"}
                      fill={s <= complaint.rating! ? "#f59e0b" : "none"}
                    />
                  ))}
                </div>
                <strong style={{ fontSize: "16px", color: "#92400e" }}>
                  {complaint.rating}/5 · {RATING_LABELS[complaint.rating] || "Rated"}
                </strong>
              </div>

              {complaint.ratingComments && (
                <p style={{ margin: "0 0 10px", fontSize: "14px", color: "#78350f", lineHeight: "1.5" }}>
                  "{complaint.ratingComments}"
                </p>
              )}

              {complaint.ratedAt && (
                <small style={{ color: "#b45309", fontSize: "12px" }}>
                  Rated on {formatDate(complaint.ratedAt)}
                </small>
              )}
            </div>
          </section>
        )}

        {/* Interactive Student Rating Form (when resolved/closed, staff assigned, and not yet rated) */}
        {!complaint.rating &&
          currentUser?.role === "student" &&
          (complaint.status === "resolved" || complaint.status === "closed") &&
          Boolean(complaint.assignedStaff || complaint.assignedStaffId) && (
            <section className="details-card" style={{ marginTop: "20px", borderLeft: "4px solid #6366f1" }}>
              <div className="details-card-header">
                <Star size={20} color="#4f46e5" />
                <div>
                  <h2>Rate Maintenance Service</h2>
                  <p>
                    Please share your experience with the resolution provided by{" "}
                    <strong>{complaint.assignedStaff || "the technician"}</strong>.
                  </p>
                </div>
              </div>

              {ratingSuccess && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "12px 16px",
                    marginBottom: "16px",
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: "10px",
                    color: "#15803d",
                    fontSize: "14px",
                  }}
                >
                  <Check size={18} />
                  <span>{ratingSuccess}</span>
                </div>
              )}

              {ratingError && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "12px 16px",
                    marginBottom: "16px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "10px",
                    color: "#b91c1c",
                    fontSize: "14px",
                  }}
                >
                  <AlertTriangle size={18} />
                  <span>{ratingError}</span>
                </div>
              )}

              <form onSubmit={handleRatingSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: 600 }}>
                    Overall Rating
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {[1, 2, 3, 4, 5].map((star) => {
                        const isFilled = star <= (ratingHover || ratingValue)
                        return (
                          <button
                            type="button"
                            key={star}
                            onClick={() => setRatingValue(star)}
                            onMouseEnter={() => setRatingHover(star)}
                            onMouseLeave={() => setRatingHover(0)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "4px",
                              transition: "transform 0.15s ease",
                            }}
                            title={`${star} star: ${RATING_LABELS[star]}`}
                          >
                            <Star
                              size={28}
                              color={isFilled ? "#f59e0b" : "#cbd5e1"}
                              fill={isFilled ? "#f59e0b" : "none"}
                            />
                          </button>
                        )
                      })}
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#d97706" }}>
                      {RATING_LABELS[ratingHover || ratingValue]}
                    </span>
                  </div>
                </div>

                {/* Additional Dimensions */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "12px",
                    padding: "14px",
                    background: "#f8fafc",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                      Work Quality
                    </label>
                    <select
                      value={workQuality}
                      onChange={(e) => setWorkQuality(Number(e.target.value))}
                      style={{ width: "100%", padding: "6px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                    >
                      <option value={5}>5 - Excellent</option>
                      <option value={4}>4 - Good</option>
                      <option value={3}>3 - Fair</option>
                      <option value={2}>2 - Poor</option>
                      <option value={1}>1 - Very Poor</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                      Timeliness
                    </label>
                    <select
                      value={timeliness}
                      onChange={(e) => setTimeliness(Number(e.target.value))}
                      style={{ width: "100%", padding: "6px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                    >
                      <option value={5}>5 - Prompt &amp; Fast</option>
                      <option value={4}>4 - Reasonable</option>
                      <option value={3}>3 - Acceptable</option>
                      <option value={2}>2 - Delayed</option>
                      <option value={1}>1 - Very Late</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                      Professionalism
                    </label>
                    <select
                      value={professionalism}
                      onChange={(e) => setProfessionalism(Number(e.target.value))}
                      style={{ width: "100%", padding: "6px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                    >
                      <option value={5}>5 - Highly Courteous</option>
                      <option value={4}>4 - Professional</option>
                      <option value={3}>3 - Satisfactory</option>
                      <option value={2}>2 - Needs Improvement</option>
                      <option value={1}>1 - Rude</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600 }}>
                    Written Feedback / Comments (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={ratingComments}
                    onChange={(e) => setRatingComments(e.target.value)}
                    placeholder="Tell us what went well or how the maintenance service could be improved..."
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isSubmittingRating}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 24px",
                      borderRadius: "10px",
                      border: "none",
                      background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                      color: "white",
                      fontWeight: 700,
                      fontSize: "14px",
                      cursor: isSubmittingRating ? "not-allowed" : "pointer",
                      boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)",
                    }}
                  >
                    {isSubmittingRating ? (
                      <>
                        <LoaderCircle size={16} className="timeline-spinner" />
                        <span>Submitting Rating...</span>
                      </>
                    ) : (
                      <>
                        <Star size={16} fill="white" />
                        <span>Submit Rating</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>
          )}

        {/* Real Complaint Timeline */}
        <section className="timeline-card" style={{ marginTop: "20px" }}>
          <div className="details-card-header">
            <Clock3 size={20} />
            <h2>Audit History & Progress Timeline</h2>
          </div>

          {isLoadingHistory ? (
            <div className="timeline-loading">
              <LoaderCircle size={22} className="timeline-spinner" />
              <span>Loading complaint history...</span>
            </div>
          ) : (
            <div className="timeline">
              <TimelineItem
                title="Complaint Registered"
                date={complaint.createdAt}
                completed
                note="Ticket registered in MongoDB Atlas."
              />

              {history.map((update) => (
                <TimelineItem
                  key={update.id}
                  title={getTimelineTitle(update.new_status)}
                  date={formatDateTime(update.created_at)}
                  completed
                  note={update.note || undefined}
                  userName={update.user_name || undefined}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Image Zoom Modal */}
      {activeImageZoom && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "20px",
          }}
          onClick={() => setActiveImageZoom(null)}
        >
          <div style={{ position: "relative", maxWidth: "90%", maxHeight: "90%" }}>
            <img
              src={activeImageZoom}
              alt="enlarged evidence"
              style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: "8px", objectFit: "contain" }}
            />
            <button
              onClick={() => setActiveImageZoom(null)}
              style={{
                position: "absolute",
                top: "-40px",
                right: "0",
                background: "white",
                border: "none",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Warden Verification Reason Modal */}
      {verifyDialogOpen && (
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
            zIndex: 1500,
          }}
          onClick={() => !isSubmittingVerify && setVerifyDialogOpen(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "460px",
              width: "100%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 10px" }}>
              {verifyAction === "approve"
                ? "Approve & Verify Complaint"
                : verifyAction === "reject"
                ? "Reject Complaint"
                : "Request Information from Student"}
            </h3>
            <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: "14px" }}>
              Please provide documentation or comments explaining your decision.
            </p>

            {verifyError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 14px",
                  marginBottom: "14px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  color: "#b91c1c",
                  fontSize: "13px",
                }}
              >
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{verifyError}</span>
              </div>
            )}

            {verifySuccess && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 14px",
                  marginBottom: "14px",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "8px",
                  color: "#15803d",
                  fontSize: "13px",
                }}
              >
                <Check size={16} style={{ flexShrink: 0 }} />
                <span>{verifySuccess}</span>
              </div>
            )}

            <form onSubmit={handleVerifySubmit}>
              <textarea
                value={verifyReason}
                onChange={(e) => setVerifyReason(e.target.value)}
                placeholder="Reason or instructions for the record..."
                rows={4}
                required
                disabled={isSubmittingVerify}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontFamily: "inherit",
                  marginBottom: "16px",
                  opacity: isSubmittingVerify ? 0.7 : 1,
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setVerifyDialogOpen(false)}
                  disabled={isSubmittingVerify}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "white",
                    cursor: isSubmittingVerify ? "not-allowed" : "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingVerify}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "8px",
                    border: "none",
                    background: verifyAction === "reject" ? "#dc2626" : "#2563eb",
                    color: "white",
                    fontWeight: 600,
                    cursor: isSubmittingVerify ? "not-allowed" : "pointer",
                    opacity: isSubmittingVerify ? 0.7 : 1,
                  }}
                >
                  {isSubmittingVerify ? "Submitting..." : "Confirm Decision"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="details-info-item">
      <div className="details-info-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  )
}

function TimelineItem({
  title,
  date,
  completed,
  note,
  userName,
}: {
  title: string
  date: string
  completed: boolean
  note?: string
  userName?: string
}) {
  return (
    <div className="timeline-item">
      <div className={`timeline-dot ${completed ? "completed" : ""}`}>
        {completed && <CheckCircle2 size={15} />}
      </div>
      <div className="timeline-content">
        <strong>{title}</strong>
        <span>{date}</span>
        {userName && <small>By {userName}</small>}
        {note && <p className="timeline-note">{note}</p>}
      </div>
    </div>
  )
}

function formatStatus(status: string) {
  return status
    .split("-")
    .join(" ")
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

function formatDate(date: string) {
  if (!date) return "—"
  try {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch {
    return date
  }
}

function formatDateTime(date: string) {
  if (!date) return "—"
  try {
    return new Date(date).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return date
  }
}

function getInitials(name: string) {
  if (!name) return "—"
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}