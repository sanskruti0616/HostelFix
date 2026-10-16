import React, { useState, useEffect } from "react"
import {
  AlertTriangle,
  History,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Lightbulb,
  ShieldAlert,
} from "lucide-react"
import { api } from "../services/api"
import type { RecurringMatch, RecurringReview } from "../types"

interface RecurringIssueBannerProps {
  complaintId: string
  complaintNumber?: string
  category: string
  roomNumber: string
  initialRecurringReview?: RecurringReview
  canReview?: boolean
  onNavigateToComplaint?: (complaintId: string) => void
  onReviewUpdated?: () => void
}

export const RecurringIssueBanner: React.FC<RecurringIssueBannerProps> = ({
  complaintId,
  complaintNumber,
  category,
  roomNumber,
  initialRecurringReview,
  canReview = false,
  onNavigateToComplaint,
  onReviewUpdated,
}) => {
  const [matches, setMatches] = useState<RecurringMatch[]>([])
  const [suggestion, setSuggestion] = useState<string>("")
  const [timeWindowDays, setTimeWindowDays] = useState<number>(30)
  const [review, setReview] = useState<RecurringReview | undefined>(initialRecurringReview)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [rootCauseNote, setRootCauseNote] = useState<string>(initialRecurringReview?.rootCauseNote || "")
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const fetchMatches = async () => {
      try {
        setLoading(true)
        const res = await api.recurrence.getMatches(complaintId, 30)
        if (isMounted && res.success) {
          setMatches(res.matches || [])
          setSuggestion(res.rootCauseSuggestion || "")
          setTimeWindowDays(res.timeWindowDays || 30)
          if (res.recurringReview) {
            setReview(res.recurringReview)
            if (res.recurringReview.rootCauseNote) {
              setRootCauseNote(res.recurringReview.rootCauseNote)
            }
          }
        }
      } catch (err: any) {
        console.warn("[RecurringIssueBanner] Could not load matches:", err.message)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    if (complaintId) {
      fetchMatches()
    }

    return () => {
      isMounted = false
    }
  }, [complaintId])

  const handleReviewAction = async (decision: "confirmed" | "unrelated") => {
    try {
      setSubmittingReview(true)
      const res = await api.recurrence.submitReview(complaintId, {
        decision,
        rootCauseNote,
        relatedComplaintIds: matches.map((m) => m.complaintId),
      })
      if (res.success) {
        setReview(res.complaint.recurringReview)
        setActionSuccess(
          decision === "confirmed"
            ? "Classified as confirmed recurring issue."
            : "Marked as unrelated complaints."
        )
        if (onReviewUpdated) onReviewUpdated()
        setTimeout(() => setActionSuccess(null), 4000)
      }
    } catch (err: any) {
      console.error("[RecurringIssueBanner] Review error:", err)
      alert("Failed to submit review: " + err.message)
    } finally {
      setSubmittingReview(false)
    }
  }

  // If no recurring matches and not previously confirmed as recurring, don't show
  if (!loading && matches.length === 0 && (!review || review.decision !== "confirmed")) {
    return null
  }

  const isConfirmed = review?.decision === "confirmed"
  const isUnrelated = review?.decision === "unrelated"

  return (
    <div
      className={`recurring-banner ${
        isConfirmed ? "confirmed" : isUnrelated ? "unrelated" : "review"
      }`}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <div
            style={{
              padding: "8px",
              borderRadius: "10px",
              background: isConfirmed ? "#f3e8ff" : isUnrelated ? "#f1f5f9" : "#fef3c7",
              color: isConfirmed ? "#7c3aed" : isUnrelated ? "#475569" : "#d97706",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {isConfirmed ? (
              <ShieldAlert size={20} />
            ) : isUnrelated ? (
              <XCircle size={20} />
            ) : (
              <AlertTriangle size={20} />
            )}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h4
                style={{
                  margin: 0,
                  fontWeight: 800,
                  fontSize: "14px",
                  color: isConfirmed ? "#581c87" : isUnrelated ? "#1f2937" : "#78350f",
                }}
              >
                {isConfirmed
                  ? "Confirmed Recurring Issue"
                  : isUnrelated
                  ? "Marked as Unrelated"
                  : "Possible Recurring Issue"}
              </h4>
              <span style={{ fontSize: "11px", background: "white", border: "1px solid #e2e8f0", padding: "2px 8px", borderRadius: "999px", color: "#475569", fontWeight: 600 }}>
                {category} • Room {roomNumber}
              </span>
              {complaintNumber && (
                <span style={{ fontSize: "11px", background: "white", border: "1px solid #e2e8f0", padding: "2px 8px", borderRadius: "999px", color: "#1e293b", fontFamily: "monospace", fontWeight: 700 }}>
                  #{complaintNumber}
                </span>
              )}
              <span style={{ fontSize: "11px", background: "white", border: "1px solid #e2e8f0", padding: "2px 8px", borderRadius: "999px", color: "#475569", fontWeight: 600 }}>
                {matches.length} similar in last {timeWindowDays} days
              </span>
            </div>

            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#4b5563", lineHeight: 1.45 }}>
              {isConfirmed
                ? "Warden has classified repeated complaints in this location as a recurring problem."
                : isUnrelated
                ? "Warden reviewed and determined these reports are independent occurrences."
                : "Multiple complaints share the same room and maintenance category within the past month."}
            </p>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", padding: "4px" }}
          title={expanded ? "Collapse details" : "Expand details"}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Root-cause investigation insight suggestion */}
          {suggestion && (
            <div style={{ background: "rgba(255,255,255,0.9)", border: "1px solid #fde68a", borderRadius: "10px", padding: "10px 14px", fontSize: "12px", color: "#78350f", display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <Lightbulb size={16} color="#d97706" style={{ marginTop: "2px", flexShrink: 0 }} />
              <div>
                <span style={{ fontWeight: 700, display: "block", color: "#78350f", marginBottom: "2px" }}>
                  Investigation Suggestion
                </span>
                <p style={{ margin: 0, color: "#92400e", lineHeight: 1.45 }}>{suggestion}</p>
              </div>
            </div>
          )}

          {/* Related Complaints List */}
          {matches.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "8px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <History size={14} color="#7c3aed" />
                  Related Previous Complaints in Room {roomNumber}:
                </span>
                <span style={{ color: "#64748b", fontWeight: 400 }}>
                  {matches.length} matching complaint{matches.length === 1 ? "" : "s"}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {matches.map((m) => (
                  <div
                    key={m.complaintId}
                    style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: 700, color: "#7c3aed" }}>
                        {m.complaintNumber}
                      </span>
                      <div>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "#1f2937" }}>
                          {m.title}
                        </div>
                        <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                          {new Date(m.createdAt).toLocaleDateString()} • Status:{" "}
                          <span style={{ textTransform: "capitalize", fontWeight: 600, color: "#475569" }}>
                            {m.status.replace("-", " ")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {onNavigateToComplaint && (
                      <button
                        onClick={() => onNavigateToComplaint(m.complaintId)}
                        style={{ fontSize: "12px", color: "#4f46e5", background: "#eef2ff", border: "none", borderRadius: "6px", padding: "4px 10px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                      >
                        <span>View</span>
                        <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current Review Details if already classified */}
          {review?.reviewedByName && (
            <div style={{ fontSize: "12px", color: "#4b5563", background: "rgba(255,255,255,0.8)", borderRadius: "8px", padding: "8px 12px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <span style={{ fontWeight: 600, color: "#1f2937" }}>Reviewed by:</span>{" "}
                {review.reviewedByName}
                {review.reviewedAt && (
                  <span style={{ color: "#9ca3af", marginLeft: "6px" }}>
                    on {new Date(review.reviewedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              {review.rootCauseNote && (
                <div style={{ color: "#374151", fontStyle: "italic", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  &ldquo;{review.rootCauseNote}&rdquo;
                </div>
              )}
            </div>
          )}

          {/* Action Success Alert */}
          {actionSuccess && (
            <div style={{ padding: "10px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", borderRadius: "8px", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
              <CheckCircle size={16} color="#16a34a" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Warden Review Action Buttons */}
          {canReview && (
            <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151" }}>
                Warden Classification &amp; Root-Cause Notes:
              </label>
              <textarea
                value={rootCauseNote}
                onChange={(e) => setRootCauseNote(e.target.value)}
                placeholder="Enter root-cause notes or inspection instructions for this recurring issue..."
                rows={2}
                className="analytics-select"
                style={{ width: "100%", padding: "8px 10px", fontSize: "12px", resize: "vertical" }}
              />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  disabled={submittingReview}
                  onClick={() => handleReviewAction("unrelated")}
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    background: isUnrelated ? "#e2e8f0" : "white",
                    color: isUnrelated ? "#1e293b" : "#4b5563",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <XCircle size={14} color="#6b7280" />
                  <span>Mark as Unrelated</span>
                </button>

                <button
                  type="button"
                  disabled={submittingReview}
                  onClick={() => handleReviewAction("confirmed")}
                  className="preventive-schedule-btn"
                  style={{
                    padding: "6px 14px",
                    fontSize: "12px",
                    background: isConfirmed ? "#6b21a8" : "#7c3aed",
                  }}
                >
                  <CheckCircle size={14} />
                  <span>Confirm Recurring Issue</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
export default RecurringIssueBanner
