import React, { useState, useEffect } from "react"
import {
  Calendar,
  Clock,
  CheckCircle2,
  Plus,
  Search,
  User as UserIcon,
  MapPin,
  RefreshCw,
  Camera,
  Check,
  X,
  FileCheck,
} from "lucide-react"
import { api } from "../services/api"
import type {
  PreventiveTask,
  PreventiveStatus,
  PreventivePriority,
  PreventiveFrequency,
  StaffMember,
} from "../types"

interface PreventiveMaintenancePlannerProps {
  hostelId?: string
  hostelName?: string
  role: "warden" | "staff" | "admin"
  currentUserId?: string
}

export const PreventiveMaintenancePlanner: React.FC<PreventiveMaintenancePlannerProps> = ({
  hostelId,
  hostelName,
  role,
  currentUserId,
}) => {
  const [tasks, setTasks] = useState<PreventiveTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"all" | "due_soon" | "overdue" | "completed">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [staffList, setStaffList] = useState<StaffMember[]>([])

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState<PreventiveTask | null>(null)

  // Create form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("Plumbing")
  const [location, setLocation] = useState("")
  const [dueAt, setDueAt] = useState("")
  const [priority, setPriority] = useState<PreventivePriority>("medium")
  const [frequency, setFrequency] = useState<PreventiveFrequency>("one-time")
  const [assignedStaffId, setAssignedStaffId] = useState("")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Complete form state
  const [completionNotes, setCompletionNotes] = useState("")
  const [completionPhotoUrl, setCompletionPhotoUrl] = useState("")
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)

  const isWardenOrAdmin = role === "warden" || role === "admin"

  const fetchTasks = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.preventive.list({
        dueState: activeTab === "all" ? undefined : activeTab,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        search: searchQuery || undefined,
      })
      if (res.success) {
        setTasks(res.tasks || [])
      }
    } catch (err: any) {
      console.error("[PreventivePlanner] Fetch error:", err)
      setError(err.message || "Failed to load preventive tasks.")
    } finally {
      setLoading(false)
    }
  }

  const fetchStaff = async () => {
    try {
      const res = await api.staff.list({ status: "active" })
      if (res.success) {
        // Filter to staff matching hostel if in warden mode
        const available = res.staff.filter((s) => {
          if (!hostelName) return true
          return !s.hostelName || s.hostelName.toLowerCase() === hostelName.toLowerCase()
        })
        setStaffList(available)
      }
    } catch (err) {
      console.warn("[PreventivePlanner] Staff fetch error:", err)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [activeTab, categoryFilter])

  useEffect(() => {
    if (isWardenOrAdmin) {
      fetchStaff()
    }
  }, [hostelName])

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !description || !location || !dueAt) {
      setCreateError("Please fill in all required fields.")
      return
    }

    try {
      setCreating(true)
      setCreateError(null)
      const res = await api.preventive.create({
        title,
        description,
        category,
        location,
        dueAt: new Date(dueAt).toISOString(),
        priority,
        frequency,
        assignedStaffId: assignedStaffId || undefined,
        hostelId,
      })

      if (res.success) {
        setShowCreateModal(false)
        resetCreateForm()
        fetchTasks()
      }
    } catch (err: any) {
      console.error("[PreventivePlanner] Create error:", err)
      setCreateError(err.message || "Failed to schedule task.")
    } finally {
      setCreating(false)
    }
  }

  const resetCreateForm = () => {
    setTitle("")
    setDescription("")
    setLocation("")
    setDueAt("")
    setPriority("medium")
    setFrequency("one-time")
    setAssignedStaffId("")
    setCreateError(null)
  }

  const handleStatusUpdate = async (taskId: string, newStatus: PreventiveStatus) => {
    try {
      const res = await api.preventive.updateStatus(taskId, { status: newStatus })
      if (res.success) {
        fetchTasks()
      }
    } catch (err: any) {
      console.error("[PreventivePlanner] Status update error:", err)
      alert("Failed to update status: " + err.message)
    }
  }

  const handleCompleteTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showCompleteModal) return

    try {
      setCompleting(true)
      setCompleteError(null)
      const completionImages = completionPhotoUrl ? [{ url: completionPhotoUrl }] : []
      const res = await api.preventive.updateStatus(showCompleteModal.id, {
        status: "completed",
        completionNotes,
        completionImages,
      })

      if (res.success) {
        setShowCompleteModal(null)
        setCompletionNotes("")
        setCompletionPhotoUrl("")
        fetchTasks()
      }
    } catch (err: any) {
      console.error("[PreventivePlanner] Complete error:", err)
      setCompleteError(err.message || "Failed to complete task.")
    } finally {
      setCompleting(false)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploadingPhoto(true)
      const res = await api.uploads.uploadEvidence([file])
      if (res.success && res.images.length > 0) {
        setCompletionPhotoUrl(res.images[0].url)
      }
    } catch (err: any) {
      console.error("[PreventivePlanner] Photo upload error:", err)
      alert("Upload failed: " + err.message)
    } finally {
      setUploadingPhoto(false)
    }
  }

  const filteredTasks = tasks.filter((t) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      t.title.toLowerCase().includes(q) ||
      t.taskNumber.toLowerCase().includes(q) ||
      t.location.toLowerCase().includes(q)
    )
  })

  // Summary counts for tabs
  const dueSoonCount = tasks.filter((t) => t.dueState === "due_soon").length
  const overdueCount = tasks.filter((t) => t.dueState === "overdue").length

  return (
    <div className="preventive-container">
      {/* Top Header Card */}
      <div className="preventive-header-card">
        <div className="preventive-header-top">
          <div className="preventive-title-group">
            <div className="preventive-title-icon">
              <Calendar size={24} />
            </div>
            <div>
              <h2>
                {role === "staff" ? "Scheduled Maintenance" : "Preventive Maintenance Planner"}
              </h2>
              <p>
                {role === "staff"
                  ? "Routine preventive maintenance assigned to your technical queue"
                  : `Schedule inspections and routine maintenance for ${hostelName || "your hostel"}`}
              </p>
            </div>
          </div>

          <div className="preventive-header-actions">
            <button
              onClick={fetchTasks}
              disabled={loading}
              title="Refresh tasks"
              className="analytics-refresh-btn"
            >
              <RefreshCw size={16} className={loading ? "animate-spin text-purple-600" : ""} />
            </button>

            {isWardenOrAdmin && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="preventive-schedule-btn"
              >
                <Plus size={16} />
                <span>Schedule Task</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab & Search Filter Bar */}
        <div className="preventive-filter-bar">
          {/* Due State Tabs */}
          <div className="preventive-tabs">
            {[
              { id: "all", label: "All Tasks" },
              { id: "due_soon", label: "Due Soon", badge: dueSoonCount, badgeColor: "amber" },
              { id: "overdue", label: "Overdue", badge: overdueCount, badgeColor: "rose" },
              { id: "completed", label: "Completed" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`preventive-tab-btn ${activeTab === tab.id ? "active" : ""}`}
              >
                <span>{tab.label}</span>
                {tab.badge && tab.badge > 0 ? (
                  <span className={`preventive-tab-badge ${tab.badgeColor}`}>
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {/* Search & Category Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div className="preventive-search-box">
              <Search size={15} color="#9ca3af" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks, room..."
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="analytics-select"
            >
              <option value="all">All Categories</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Electrical">Electrical</option>
              <option value="Cleaning">Cleaning</option>
              <option value="Furniture">Furniture</option>
              <option value="Water Supply">Water Supply</option>
              <option value="Security">Security</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "12px 18px", borderRadius: "12px", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{error}</span>
          <button onClick={fetchTasks} style={{ textDecoration: "underline", fontSize: "12px", fontWeight: "bold", background: "none", border: "none", color: "#b91c1c", cursor: "pointer" }}>
            Retry
          </button>
        </div>
      )}

      {/* Task List Grid */}
      {loading ? (
        <div className="preventive-empty-card">
          <RefreshCw size={32} className="animate-spin text-purple-600" style={{ marginBottom: "10px" }} />
          <p style={{ fontSize: "14px", fontWeight: "600", color: "#64748b", margin: 0 }}>Loading preventive maintenance tasks...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="preventive-empty-card">
          <div className="preventive-empty-icon">
            <FileCheck size={28} />
          </div>
          <h3>No Scheduled Maintenance Tasks Found</h3>
          <p>
            {activeTab !== "all"
              ? `There are no tasks matching the '${activeTab.replace("_", " ")}' filter.`
              : "No preventive maintenance activities have been scheduled yet."}
          </p>
          {isWardenOrAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                marginTop: "10px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                background: "#eef2ff",
                color: "#4f46e5",
                fontSize: "12px",
                fontWeight: 700,
                borderRadius: "8px",
                border: "1px solid #c7d2fe",
                cursor: "pointer",
              }}
            >
              <Plus size={14} />
              Schedule First Activity
            </button>
          )}
        </div>
      ) : (
        <div className="preventive-tasks-grid">
          {filteredTasks.map((task) => {
            const isCompleted = task.status === "completed"
            const isAssignedToCurrentUser =
              task.assignedTo?.staffId && task.assignedTo.staffId === currentUserId

            return (
              <div
                key={task.id}
                className={`preventive-task-card ${
                  task.dueState === "overdue"
                    ? "overdue"
                    : task.dueState === "due_soon"
                    ? "due-soon"
                    : isCompleted
                    ? "completed"
                    : ""
                }`}
              >
                <div className="preventive-task-body">
                  {/* Top Badges */}
                  <div className="preventive-card-header">
                    <span className="preventive-task-number">
                      {task.taskNumber}
                    </span>

                    <div className="preventive-badges-group">
                      {/* Priority */}
                      <span className={`preventive-priority-badge ${task.priority}`}>
                        {task.priority}
                      </span>

                      {/* Due State Badge */}
                      <span
                        className={`preventive-state-badge ${
                          isCompleted
                            ? "completed"
                            : task.dueState === "overdue"
                            ? "overdue"
                            : task.dueState === "due_soon"
                            ? "due-soon"
                            : "upcoming"
                        }`}
                      >
                        {isCompleted
                          ? "Completed"
                          : task.dueState === "overdue"
                          ? "Overdue"
                          : task.dueState === "due_soon"
                          ? "Due Soon (<48h)"
                          : "Upcoming"}
                      </span>
                    </div>
                  </div>

                  {/* Title & Category */}
                  <h3 style={{ marginTop: "10px" }}>{task.title}</h3>
                  <div className="preventive-tags">
                    <span className="preventive-tag purple">
                      {task.category}
                    </span>
                    {task.frequency && task.frequency !== "one-time" && (
                      <span className="preventive-tag gray">
                        {task.frequency}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="preventive-task-desc">
                    {task.description}
                  </p>

                  {/* Location & Due Date Info */}
                  <div className="preventive-details-list" style={{ marginTop: "14px" }}>
                    <div className="preventive-detail-row">
                      <MapPin size={14} color="#94a3b8" />
                      <span style={{ fontWeight: 600, color: "#334155" }}>{task.location}</span>
                    </div>
                    <div className="preventive-detail-row">
                      <Clock size={14} color="#94a3b8" />
                      <span>
                        Due:{" "}
                        <strong style={{ color: "#334155" }}>
                          {new Date(task.dueAt).toLocaleDateString()}
                        </strong>
                      </span>
                    </div>
                    <div className="preventive-detail-row">
                      <UserIcon size={14} color="#94a3b8" />
                      <span>
                        Assigned:{" "}
                        <strong style={{ color: "#334155" }}>
                          {task.assignedTo?.staffName || "Unassigned"}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Completed info preview */}
                  {isCompleted && task.completionNotes && (
                    <div style={{ marginTop: "12px", padding: "10px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", fontSize: "12px", color: "#166534" }}>
                      <span style={{ fontWeight: 700, display: "block", marginBottom: "3px" }}>Completion Notes:</span>
                      <p style={{ fontStyle: "italic", margin: 0, color: "#15803d" }}>&ldquo;{task.completionNotes}&rdquo;</p>
                      {task.completionImages && task.completionImages.length > 0 && (
                        <div style={{ marginTop: "8px" }}>
                          <img
                            src={task.completionImages[0].url}
                            alt="Proof"
                            style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "6px", border: "1px solid #86efac" }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div>
                  {isCompleted ? (
                    <div style={{ textAlign: "center", fontSize: "12px", fontWeight: 700, color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", paddingTop: "8px" }}>
                      <CheckCircle2 size={16} />
                      <span>
                        Completed on{" "}
                        {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : ""}
                      </span>
                    </div>
                  ) : (
                    <div className="preventive-card-actions">
                      {/* Start work button for assigned staff or warden/admin */}
                      {task.status === "scheduled" && (isWardenOrAdmin || isAssignedToCurrentUser || role === "staff") && (
                        <button
                          onClick={() => handleStatusUpdate(task.id, "in-progress")}
                          className="preventive-action-btn start"
                          style={{ background: "#f59e0b" }}
                        >
                          Start Work
                        </button>
                      )}

                      {/* Complete task button */}
                      {(task.status === "in-progress" || task.status === "scheduled") &&
                        (isWardenOrAdmin || isAssignedToCurrentUser || role === "staff") && (
                          <button
                            onClick={() => setShowCompleteModal(task)}
                            className="preventive-action-btn complete"
                          >
                            <Check size={14} />
                            <span>Complete Task</span>
                          </button>
                        )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CREATE TASK MODAL */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: "520px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "14px", borderBottom: "1px solid #f1f5f9", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Calendar size={22} color="#4f46e5" />
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: "18px", color: "#111827" }}>Schedule Maintenance Task</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", padding: "4px" }}
              >
                <X size={20} />
              </button>
            </div>

            {createError && (
              <div style={{ marginBottom: "14px", padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: "8px", fontSize: "12px" }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateTask} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "5px" }}>
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Inspect Overhead Water Tank Valves"
                  className="analytics-select"
                  style={{ width: "100%", padding: "9px 12px", fontSize: "13px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "5px" }}>
                  Description *
                </label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the technical inspection steps or maintenance scope..."
                  className="analytics-select"
                  style={{ width: "100%", padding: "9px 12px", fontSize: "13px", resize: "vertical" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "5px" }}>
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="analytics-select"
                    style={{ width: "100%" }}
                  >
                    <option value="Plumbing">Plumbing</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Water Supply">Water Supply</option>
                    <option value="Cleaning">Cleaning</option>
                    <option value="Furniture">Furniture</option>
                    <option value="Security">Security</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "5px" }}>
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="analytics-select"
                    style={{ width: "100%" }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "5px" }}>
                    Location / Area *
                  </label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Block A Rooftop"
                    className="analytics-select"
                    style={{ width: "100%", padding: "9px 12px" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "5px" }}>
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    className="analytics-select"
                    style={{ width: "100%", padding: "9px 12px" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "5px" }}>
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="analytics-select"
                    style={{ width: "100%" }}
                  >
                    <option value="one-time">One-time</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "5px" }}>
                    Assign Staff
                  </label>
                  <select
                    value={assignedStaffId}
                    onChange={(e) => setAssignedStaffId(e.target.value)}
                    className="analytics-select"
                    style={{ width: "100%" }}
                  >
                    <option value="">Unassigned</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.specialization || "General"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", marginTop: "10px", paddingTop: "14px", borderTop: "1px solid #f1f5f9" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #d1d5db", background: "white", color: "#374151", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="preventive-schedule-btn"
                  style={{ padding: "8px 18px" }}
                >
                  {creating && <RefreshCw size={14} className="animate-spin" />}
                  <span>{creating ? "Scheduling..." : "Schedule Task"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPLETE TASK MODAL */}
      {showCompleteModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: "460px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "12px", borderBottom: "1px solid #f1f5f9", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <CheckCircle2 size={22} color="#16a34a" />
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: "17px", color: "#111827" }}>Complete Maintenance Task</h3>
              </div>
              <button
                onClick={() => setShowCompleteModal(null)}
                style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", padding: "4px" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                Task #{showCompleteModal.taskNumber}:{" "}
                <strong style={{ color: "#1f2937" }}>{showCompleteModal.title}</strong>
              </p>
            </div>

            {completeError && (
              <div style={{ marginBottom: "12px", padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: "8px", fontSize: "12px" }}>
                {completeError}
              </div>
            )}

            <form onSubmit={handleCompleteTask} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "5px" }}>
                  Completion Notes / Observations *
                </label>
                <textarea
                  required
                  rows={3}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Record what maintenance was done, parts replaced, or conditions observed..."
                  className="analytics-select"
                  style={{ width: "100%", padding: "9px 12px", fontSize: "13px", resize: "vertical" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "5px" }}>
                  Completion Photograph (Proof)
                </label>
                <div style={{ border: "1px dashed #cbd5e1", borderRadius: "10px", padding: "14px", textAlign: "center", background: "#f8fafc" }}>
                  {completionPhotoUrl ? (
                    <div style={{ position: "relative", display: "inline-block" }}>
                      <img
                        src={completionPhotoUrl}
                        alt="Completion proof"
                        style={{ width: "96px", height: "96px", objectFit: "cover", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                      />
                      <button
                        type="button"
                        onClick={() => setCompletionPhotoUrl("")}
                        style={{ position: "absolute", top: "-8px", right: "-8px", background: "#ef4444", color: "white", borderRadius: "50%", border: "none", width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <label style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                      <Camera size={26} color="#94a3b8" />
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#4f46e5" }}>
                        {uploadingPhoto ? "Uploading..." : "Upload completion photograph"}
                      </span>
                      <span style={{ fontSize: "10px", color: "#94a3b8" }}>PNG, JPG up to 10MB</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        disabled={uploadingPhoto}
                        style={{ display: "none" }}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", marginTop: "8px", paddingTop: "14px", borderTop: "1px solid #f1f5f9" }}>
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(null)}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #d1d5db", background: "white", color: "#374151", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={completing}
                  className="preventive-action-btn complete"
                  style={{ padding: "8px 18px", flex: "none" }}
                >
                  {completing && <RefreshCw size={14} className="animate-spin" />}
                  <span>{completing ? "Completing..." : "Confirm Completion"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
export default PreventiveMaintenancePlanner
