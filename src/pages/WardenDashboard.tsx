import { useState, useMemo, useEffect } from "react"
import {
  AlertCircle,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Download,
  Edit3,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  Wrench,
  X,
} from "lucide-react"
import type {
  Complaint,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  StaffMember,
  User,
} from "../types"
import { api } from "../services/api"

interface WardenDashboardProps {
  currentUser: User
  complaints: Complaint[]
  onLogout: () => void
  onViewComplaint: (complaint: Complaint) => void
  onRefresh?: () => void
}

const SPECIALIZATION_OPTIONS = [
  "General Maintenance",
  "Electrical",
  "Plumbing",
  "Carpentry",
  "Cleaning",
]

export default function WardenDashboard({
  currentUser,
  complaints,
  onLogout,
  onViewComplaint,
  onRefresh,
}: WardenDashboardProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"complaints" | "staff">("complaints")

  // Complaints filter state
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | "all">("all")
  const [categoryFilter, setCategoryFilter] = useState<ComplaintCategory | "all">("all")
  const [priorityFilter, setPriorityFilter] = useState<ComplaintPriority | "all">("all")

  // Staff management state
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [isLoadingStaff, setIsLoadingStaff] = useState(false)
  const [staffError, setStaffError] = useState<string | null>(null)
  const [staffSearch, setStaffSearch] = useState("")
  const [staffStatusFilter, setStaffStatusFilter] = useState<"all" | "active" | "suspended">("all")
  const [staffSpecFilter, setStaffSpecFilter] = useState<string>("all")

  // Add staff modal state
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false)
  const [addStaffLoading, setAddStaffLoading] = useState(false)
  const [addStaffError, setAddStaffError] = useState<string | null>(null)
  const [addStaffSuccess, setAddStaffSuccess] = useState<string | null>(null)
  const [newStaffForm, setNewStaffForm] = useState({
    name: "",
    email: "",
    phone: "",
    specialization: "General Maintenance",
    password: "",
  })
  const [createdStaffActivation, setCreatedStaffActivation] = useState<{
    token: string
    link: string
    staffName: string
    email: string
  } | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Edit staff modal state
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [editStaffLoading, setEditStaffLoading] = useState(false)
  const [editStaffError, setEditStaffError] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    specialization: "General Maintenance",
  })

  // Fetch staff list scoped to Warden's hostel
  const fetchStaff = async () => {
    setIsLoadingStaff(true)
    setStaffError(null)
    try {
      const res = await api.staff.list({ includeAll: true })
      setStaffList(res.staff || [])
    } catch (err: any) {
      setStaffError(err.message || "Failed to load maintenance staff")
    } finally {
      setIsLoadingStaff(false)
    }
  }

  useEffect(() => {
    fetchStaff()
  }, [])

  // Real database metrics computed from complaints
  const totalComplaints = complaints.length

  const awaitingVerification = complaints.filter(
    (c) => c.status === "submitted" || c.status === "pending_verification"
  ).length

  const awaitingAssignment = complaints.filter(
    (c) => c.status === "verified"
  ).length

  const inProgressComplaints = complaints.filter(
    (c) =>
      c.status === "assigned" ||
      c.status === "in-progress" ||
      c.status === "need-material"
  ).length

  const resolvedComplaints = complaints.filter(
    (c) => c.status === "resolved" || c.status === "closed"
  ).length

  // Filter complaints
  const filteredComplaints = useMemo(() => {
    return complaints.filter((complaint) => {
      const term = searchTerm.toLowerCase().trim()
      const matchesSearch =
        !term ||
        complaint.title.toLowerCase().includes(term) ||
        complaint.studentName.toLowerCase().includes(term) ||
        complaint.id.toLowerCase().includes(term) ||
        complaint.room.toLowerCase().includes(term)

      const matchesStatus =
        statusFilter === "all" || complaint.status === statusFilter

      const matchesCategory =
        categoryFilter === "all" || complaint.category === categoryFilter

      const matchesPriority =
        priorityFilter === "all" || complaint.priority === priorityFilter

      return matchesSearch && matchesStatus && matchesCategory && matchesPriority
    })
  }, [complaints, searchTerm, statusFilter, categoryFilter, priorityFilter])

  // Filter staff members
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const term = staffSearch.toLowerCase().trim()
      const matchesSearch =
        !term ||
        s.name.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term) ||
        (s.phone && s.phone.includes(term)) ||
        (s.specialization && s.specialization.toLowerCase().includes(term))

      const matchesStatus =
        staffStatusFilter === "all" || s.accountStatus === staffStatusFilter

      const matchesSpec =
        staffSpecFilter === "all" || s.specialization === staffSpecFilter

      return matchesSearch && matchesStatus && matchesSpec
    })
  }, [staffList, staffSearch, staffStatusFilter, staffSpecFilter])

  // Staff stats
  const activeStaffCount = staffList.filter((s) => s.accountStatus === "active").length
  const suspendedStaffCount = staffList.filter((s) => s.accountStatus === "suspended").length
  const totalStaffWorkload = staffList.reduce((acc, s) => acc + (s.assignedCount || 0), 0)

  const handleExportCsv = () => {
    window.open(api.complaints.getExportCsvUrl(), "_blank")
  }

  // Toggle staff account status (active vs suspended)
  const handleToggleStaffStatus = async (staff: StaffMember) => {
    const nextStatus = staff.accountStatus === "active" ? "suspended" : "active"
    const confirmMsg =
      nextStatus === "suspended"
        ? `Are you sure you want to suspend "${staff.name}"? They will not be able to log in or receive new task assignments.`
        : `Reactivate account for "${staff.name}"?`

    if (!window.confirm(confirmMsg)) return

    try {
      await api.staff.updateStatus(staff.id, nextStatus)
      await fetchStaff()
    } catch (err: any) {
      alert(err.message || "Failed to update staff status")
    }
  }

  // Add staff submission
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddStaffError(null)
    setAddStaffSuccess(null)
    setCreatedStaffActivation(null)
    setCopiedLink(false)
    setAddStaffLoading(true)

    try {
      const res = await api.staff.create({
        name: newStaffForm.name.trim(),
        email: newStaffForm.email.trim(),
        phone: newStaffForm.phone.trim(),
        specialization: newStaffForm.specialization,
        password: newStaffForm.password ? newStaffForm.password : undefined,
        hostelId: currentUser.hostelId,
      })

      await fetchStaff()

      if (res.activationToken) {
        const activationLink = `${window.location.origin}/staff/signup?token=${res.activationToken}`
        setCreatedStaffActivation({
          token: res.activationToken,
          link: activationLink,
          staffName: newStaffForm.name.trim(),
          email: newStaffForm.email.trim(),
        })
        setAddStaffSuccess(`Staff invitation created! Share the activation link with ${newStaffForm.name}.`)
      } else {
        setAddStaffSuccess(`Technician ${newStaffForm.name} registered successfully!`)
        setTimeout(() => {
          setIsAddStaffOpen(false)
          setAddStaffSuccess(null)
          setNewStaffForm({
            name: "",
            email: "",
            phone: "",
            specialization: "General Maintenance",
            password: "",
          })
        }, 1500)
      }
    } catch (err: any) {
      setAddStaffError(err.message || "Failed to create staff member")
    } finally {
      setAddStaffLoading(false)
    }
  }

  // Open edit staff modal
  const handleOpenEditStaff = (staff: StaffMember) => {
    setEditingStaff(staff)
    setEditForm({
      name: staff.name,
      phone: staff.phone || "",
      specialization: staff.specialization || "General Maintenance",
    })
    setEditStaffError(null)
  }

  // Save edit staff changes
  const handleSaveEditStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingStaff) return
    setEditStaffLoading(true)
    setEditStaffError(null)

    try {
      await api.staff.update(editingStaff.id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        specialization: editForm.specialization,
      })
      await fetchStaff()
      setEditingStaff(null)
    } catch (err: any) {
      setEditStaffError(err.message || "Failed to update technician")
    } finally {
      setEditStaffLoading(false)
    }
  }

  return (
    <div className="dashboard-page">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-brand">
          <div className="brand-icon">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2>HostelFix</h2>
            <span>
              Warden Portal · {currentUser.organizationName ? `${currentUser.organizationName} · ` : ""}
              {currentUser.hostel || "All Hostels"}
            </span>
          </div>
        </div>

        <div className="header-user">
          {onRefresh && (
            <button
              className="header-logout"
              onClick={() => {
                onRefresh()
                fetchStaff()
              }}
              title="Refresh"
              style={{ marginRight: "12px" }}
            >
              <RefreshCw size={18} />
            </button>
          )}

          <button
            className="header-logout"
            onClick={handleExportCsv}
            title="Export CSV"
            style={{ marginRight: "12px" }}
          >
            <Download size={18} />
          </button>

          <div className="user-avatar">
            {currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : "WA"}
          </div>

          <div className="header-user-info">
            <strong>{currentUser.name}</strong>
            <span>Warden</span>
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
              <Building2 size={15} />
              WARDEN DASHBOARD
            </p>
            <h1>Welcome, {currentUser.name} 👋</h1>
            <p>
              Monitor, verify, assign maintenance tasks, and manage staff for {currentUser.hostel || "your hostel"}.
            </p>
          </div>

          <div className="welcome-date" style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={handleExportCsv}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                background: "white",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              <Download size={16} /> Export Reports (CSV)
            </button>
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
          }}
        >
          <button
            onClick={() => setActiveTab("complaints")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              borderBottom: activeTab === "complaints" ? "3px solid #4f46e5" : "3px solid transparent",
              background: "transparent",
              color: activeTab === "complaints" ? "#4f46e5" : "#64748b",
              transition: "all 0.15s ease",
            }}
          >
            <ClipboardList size={18} />
            Complaints Management ({complaints.length})
          </button>

          <button
            onClick={() => setActiveTab("staff")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              borderBottom: activeTab === "staff" ? "3px solid #4f46e5" : "3px solid transparent",
              background: "transparent",
              color: activeTab === "staff" ? "#4f46e5" : "#64748b",
              transition: "all 0.15s ease",
            }}
          >
            <Users size={18} />
            Manage Staff ({staffList.length})
          </button>
        </div>

        {/* TAB 1: COMPLAINTS OVERVIEW */}
        {activeTab === "complaints" && (
          <>
            {/* Stats Grid */}
            <section className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon stat-total">
                  <ClipboardList size={22} />
                </div>
                <div>
                  <span className="stat-value">{totalComplaints}</span>
                  <span className="stat-label">Total in Scope</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon stat-pending">
                  <Sparkles size={22} />
                </div>
                <div>
                  <span className="stat-value">{awaitingVerification}</span>
                  <span className="stat-label">Needs Verification</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon stat-progress">
                  <Wrench size={22} />
                </div>
                <div>
                  <span className="stat-value">{awaitingAssignment}</span>
                  <span className="stat-label">Ready for Assignment</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon stat-progress">
                  <Clock3 size={22} />
                </div>
                <div>
                  <span className="stat-value">{inProgressComplaints}</span>
                  <span className="stat-label">Active Work</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon stat-resolved">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <span className="stat-value">{resolvedComplaints}</span>
                  <span className="stat-label">Resolved</span>
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
                    placeholder="Search by ID, title, student, room..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
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
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    style={{
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      background: "white",
                    }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="submitted">Submitted</option>
                    <option value="pending_verification">Pending Verification</option>
                    <option value="verified">Verified</option>
                    <option value="assigned">Assigned</option>
                    <option value="in-progress">In Progress</option>
                    <option value="need-material">Need Material</option>
                    <option value="resolved">Resolved</option>
                    <option value="rejected">Rejected</option>
                  </select>

                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value as any)}
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
                    <option value="Internet">Internet</option>
                    <option value="Cleaning">Cleaning</option>
                    <option value="Furniture">Furniture</option>
                    <option value="Water Supply">Water Supply</option>
                    <option value="Security">Security</option>
                    <option value="Other">Other</option>
                  </select>

                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value as any)}
                    style={{
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      background: "white",
                    }}
                  >
                    <option value="all">All Priorities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Complaints Table/List */}
            <section className="complaints-section">
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
                          {complaint.verification && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "2px 8px",
                                borderRadius: "12px",
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
                              <Sparkles size={12} />
                              AI: {(complaint.verification.result || "pending").replace("_", " ")}
                            </span>
                          )}
                        </div>

                        <h3>{complaint.title}</h3>
                        <p>{complaint.description}</p>

                        <div className="complaint-meta">
                          <span>👤 {complaint.studentName}</span>
                          <span>🏠 Room {complaint.room}</span>
                          <span>🏷️ {complaint.category}</span>
                          <span>📅 {complaint.createdAt}</span>
                          {complaint.assignedStaff ? (
                            <span>🔧 Staff: {complaint.assignedStaff}</span>
                          ) : (
                            <span style={{ color: "#d97706", fontWeight: 600 }}>⚠️ Unassigned</span>
                          )}
                        </div>
                      </div>

                      <span className="complaint-arrow">
                        <ChevronRight size={20} />
                      </span>
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
                    No complaints found
                  </h3>
                  <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
                    {complaints.length === 0
                      ? "No complaints have been reported in your hostel yet."
                      : "No complaints match the selected search or filter criteria."}
                  </p>
                </div>
              )}
            </section>
          </>
        )}

        {/* TAB 2: MANAGE STAFF */}
        {activeTab === "staff" && (
          <section className="manage-staff-section">
            {/* Staff Section Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "16px",
                marginBottom: "20px",
              }}
            >
              <div>
                <h2 style={{ margin: "0 0 4px", fontSize: "20px", color: "#0f172a" }}>
                  Maintenance Technicians & Staff
                </h2>
                <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
                  Authorized technicians for {currentUser.hostel || "your hostel"}. Staff accounts cannot self-register publicly.
                </p>
              </div>

              <button
                onClick={() => {
                  setAddStaffError(null)
                  setAddStaffSuccess(null)
                  setIsAddStaffOpen(true)
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 18px",
                  background: "#4f46e5",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(79, 70, 229, 0.2)",
                }}
              >
                <UserPlus size={18} /> Add New Staff Member
              </button>
            </div>

            {/* Staff Metric Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  background: "white",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    background: "#e0e7ff",
                    color: "#4f46e5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Users size={22} />
                </div>
                <div>
                  <div style={{ fontSize: "22px", fontWeight: 700, color: "#0f172a" }}>
                    {staffList.length}
                  </div>
                  <div style={{ fontSize: "13px", color: "#64748b" }}>Total Staff</div>
                </div>
              </div>

              <div
                style={{
                  background: "white",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    background: "#dcfce7",
                    color: "#16a34a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <UserCheck size={22} />
                </div>
                <div>
                  <div style={{ fontSize: "22px", fontWeight: 700, color: "#0f172a" }}>
                    {activeStaffCount}
                  </div>
                  <div style={{ fontSize: "13px", color: "#64748b" }}>Active Technicians</div>
                </div>
              </div>

              <div
                style={{
                  background: "white",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    background: "#fee2e2",
                    color: "#dc2626",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <UserX size={22} />
                </div>
                <div>
                  <div style={{ fontSize: "22px", fontWeight: 700, color: "#0f172a" }}>
                    {suspendedStaffCount}
                  </div>
                  <div style={{ fontSize: "13px", color: "#64748b" }}>Suspended</div>
                </div>
              </div>

              <div
                style={{
                  background: "white",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    background: "#fef3c7",
                    color: "#d97706",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Wrench size={22} />
                </div>
                <div>
                  <div style={{ fontSize: "22px", fontWeight: 700, color: "#0f172a" }}>
                    {totalStaffWorkload}
                  </div>
                  <div style={{ fontSize: "13px", color: "#64748b" }}>Active Assigned Tasks</div>
                </div>
              </div>
            </div>

            {/* Staff Search and Filters */}
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
                marginBottom: "20px",
              }}
            >
              <div style={{ flex: 1, minWidth: "220px", position: "relative" }}>
                <Search
                  size={18}
                  style={{ position: "absolute", left: "12px", top: "11px", color: "#94a3b8" }}
                />
                <input
                  type="text"
                  placeholder="Search staff by name, email, phone, or skill..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px 9px 38px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                  }}
                />
              </div>

              <select
                value={staffStatusFilter}
                onChange={(e) => setStaffStatusFilter(e.target.value as any)}
                style={{
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                  background: "white",
                }}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended Only</option>
              </select>

              <select
                value={staffSpecFilter}
                onChange={(e) => setStaffSpecFilter(e.target.value)}
                style={{
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                  background: "white",
                }}
              >
                <option value="all">All Specializations</option>
                {SPECIALIZATION_OPTIONS.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>

            {/* Staff Members List */}
            {isLoadingStaff ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "48px",
                  background: "white",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  color: "#64748b",
                }}
              >
                <RefreshCw size={24} className="spin" style={{ marginBottom: "12px" }} />
                <p>Loading maintenance staff...</p>
              </div>
            ) : staffError ? (
              <div
                style={{
                  padding: "20px",
                  background: "#fee2e2",
                  color: "#991b1b",
                  borderRadius: "12px",
                  marginBottom: "20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <AlertCircle size={20} />
                <span>{staffError}</span>
              </div>
            ) : filteredStaff.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                  gap: "16px",
                }}
              >
                {filteredStaff.map((staff) => (
                  <div
                    key={staff.id}
                    style={{
                      background: "white",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      padding: "20px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                  >
                    <div>
                      {/* Top Row: Avatar + Name + Status */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: "12px",
                        }}
                      >
                        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                          <div
                            style={{
                              width: "44px",
                              height: "44px",
                              borderRadius: "50%",
                              background: staff.accountStatus === "active" ? "#e0e7ff" : "#f1f5f9",
                              color: staff.accountStatus === "active" ? "#4f46e5" : "#64748b",
                              fontWeight: 700,
                              fontSize: "16px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {staff.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h3 style={{ margin: "0 0 2px", fontSize: "16px", color: "#0f172a" }}>
                              {staff.name}
                            </h3>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                background: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                borderRadius: "6px",
                                fontSize: "12px",
                                color: "#475569",
                                fontWeight: 500,
                              }}
                            >
                              <Briefcase size={11} style={{ marginRight: "4px", verticalAlign: "-1px" }} />
                              {staff.specialization || "General Maintenance"}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "3px 9px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            fontWeight: 600,
                            background:
                              staff.accountStatus === "active"
                                ? "#dcfce7"
                                : staff.accountStatus === "pending_activation"
                                ? "#fef3c7"
                                : "#fee2e2",
                            color:
                              staff.accountStatus === "active"
                                ? "#166534"
                                : staff.accountStatus === "pending_activation"
                                ? "#92400e"
                                : "#991b1b",
                          }}
                        >
                          <span
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              background:
                                staff.accountStatus === "active"
                                  ? "#16a34a"
                                  : staff.accountStatus === "pending_activation"
                                  ? "#d97706"
                                  : "#dc2626",
                            }}
                          />
                          {staff.accountStatus === "active"
                            ? "Active"
                            : staff.accountStatus === "pending_activation"
                            ? "Pending Activation"
                            : "Suspended"}
                        </span>
                      </div>

                      {/* Contact Info */}
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#64748b",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                          marginBottom: "16px",
                          padding: "10px",
                          background: "#f8fafc",
                          borderRadius: "8px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Mail size={14} color="#94a3b8" />
                          <span style={{ color: "#334155" }}>{staff.email}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Phone size={14} color="#94a3b8" />
                          <span style={{ color: staff.phone ? "#334155" : "#94a3b8" }}>
                            {staff.phone || "No phone added"}
                          </span>
                        </div>

                        {staff.accountStatus === "pending_activation" && staff.activationToken && (
                          <div
                            style={{
                              marginTop: "6px",
                              paddingTop: "8px",
                              borderTop: "1px dashed #e2e8f0",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "6px",
                            }}
                          >
                            <span style={{ fontSize: "11px", color: "#92400e", fontWeight: 600 }}>
                              Code: <code>{staff.activationToken}</code>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const link = `${window.location.origin}/staff/signup?token=${staff.activationToken}`
                                navigator.clipboard.writeText(link)
                                alert(`Activation link for ${staff.name} copied to clipboard!`)
                              }}
                              style={{
                                padding: "3px 8px",
                                borderRadius: "4px",
                                background: "#d97706",
                                color: "white",
                                border: "none",
                                fontSize: "11px",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Copy Link
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Task Workload Counters */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "8px",
                          marginBottom: "16px",
                        }}
                      >
                        <div
                          style={{
                            padding: "8px 12px",
                            background: "#eff6ff",
                            borderRadius: "8px",
                            border: "1px solid #bfdbfe",
                          }}
                        >
                          <div style={{ fontSize: "11px", color: "#1e40af", fontWeight: 600 }}>
                            ASSIGNED TASKS
                          </div>
                          <div style={{ fontSize: "16px", fontWeight: 700, color: "#1e3a8a" }}>
                            {staff.assignedCount || 0}
                          </div>
                        </div>

                        <div
                          style={{
                            padding: "8px 12px",
                            background: "#f0fdf4",
                            borderRadius: "8px",
                            border: "1px solid #bbf7d0",
                          }}
                        >
                          <div style={{ fontSize: "11px", color: "#166534", fontWeight: 600 }}>
                            RESOLVED TASKS
                          </div>
                          <div style={{ fontSize: "16px", fontWeight: 700, color: "#14532d" }}>
                            {staff.completedCount || 0}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        borderTop: "1px solid #f1f5f9",
                        paddingTop: "14px",
                      }}
                    >
                      <button
                        onClick={() => handleOpenEditStaff(staff)}
                        style={{
                          flex: 1,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          padding: "8px 12px",
                          background: "#f8fafc",
                          border: "1px solid #cbd5e1",
                          borderRadius: "6px",
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "#334155",
                          cursor: "pointer",
                        }}
                      >
                        <Edit3 size={14} /> Edit
                      </button>

                      <button
                        onClick={() => handleToggleStaffStatus(staff)}
                        style={{
                          flex: 1,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          padding: "8px 12px",
                          background: staff.accountStatus === "active" ? "#fee2e2" : "#dcfce7",
                          border:
                            staff.accountStatus === "active"
                              ? "1px solid #fca5a5"
                              : "1px solid #86efac",
                          borderRadius: "6px",
                          fontSize: "13px",
                          fontWeight: 600,
                          color: staff.accountStatus === "active" ? "#991b1b" : "#166534",
                          cursor: "pointer",
                        }}
                      >
                        {staff.accountStatus === "active" ? (
                          <>
                            <UserX size={14} /> Suspend
                          </>
                        ) : (
                          <>
                            <UserCheck size={14} /> Activate
                          </>
                        )}
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
                <Users size={38} color="#94a3b8" style={{ marginBottom: "12px" }} />
                <h3 style={{ margin: "0 0 6px", color: "#1e293b", fontSize: "18px" }}>
                  No maintenance staff found
                </h3>
                <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: "14px" }}>
                  {staffList.length === 0
                    ? "No maintenance technicians have been registered for your hostel yet."
                    : "No technicians match the current search or filter."}
                </p>
                {staffList.length === 0 && (
                  <button
                    onClick={() => setIsAddStaffOpen(true)}
                    style={{
                      padding: "8px 16px",
                      background: "#4f46e5",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    + Register First Technician
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {/* MODAL: ADD NEW STAFF MEMBER */}
        {isAddStaffOpen && (
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
              zIndex: 1000,
              padding: "20px",
            }}
            onClick={() => !addStaffLoading && setIsAddStaffOpen(false)}
          >
            <div
              style={{
                background: "white",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "500px",
                padding: "24px",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: "#e0e7ff",
                      color: "#4f46e5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <UserPlus size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
                      Register Maintenance Staff
                    </h3>
                    <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                      Scope: {currentUser.hostel || "Your Hostel"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsAddStaffOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#64748b",
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {addStaffError && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "#fee2e2",
                    color: "#991b1b",
                    borderRadius: "8px",
                    marginBottom: "16px",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{addStaffError}</span>
                </div>
              )}

              {addStaffSuccess && !createdStaffActivation && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "#dcfce7",
                    color: "#166534",
                    borderRadius: "8px",
                    marginBottom: "16px",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>{addStaffSuccess}</span>
                </div>
              )}

              {createdStaffActivation ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div
                    style={{
                      padding: "16px",
                      background: "#f0fdf4",
                      border: "1.5px solid #86efac",
                      borderRadius: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "10px",
                        color: "#166534",
                        fontWeight: 700,
                        fontSize: "15px",
                      }}
                    >
                      <CheckCircle2 size={20} />
                      <span>Technician Invitation Generated!</span>
                    </div>

                    <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#334155", lineHeight: 1.5 }}>
                      Staff account created for <strong>{createdStaffActivation.staffName}</strong> (<code>{createdStaffActivation.email}</code>). Share the activation link or code below so they can set their password and enter the portal.
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div>
                        <span style={{ fontSize: "11px", color: "#166534", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                          ACTIVATION CODE
                        </span>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <input
                            type="text"
                            readOnly
                            value={createdStaffActivation.token}
                            style={{
                              flex: 1,
                              padding: "8px 12px",
                              borderRadius: "6px",
                              border: "1px solid #cbd5e1",
                              background: "white",
                              fontWeight: 700,
                              fontSize: "15px",
                              letterSpacing: "1px",
                              color: "#0f172a",
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(createdStaffActivation.token)
                              alert("Activation code copied to clipboard!")
                            }}
                            style={{
                              padding: "8px 14px",
                              borderRadius: "6px",
                              background: "#ffffff",
                              border: "1px solid #cbd5e1",
                              fontWeight: 600,
                              fontSize: "12px",
                              cursor: "pointer",
                            }}
                          >
                            Copy Code
                          </button>
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: "11px", color: "#166534", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                          ACTIVATION LINK (Valid for 7 Days)
                        </span>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <input
                            type="text"
                            readOnly
                            value={createdStaffActivation.link}
                            style={{
                              flex: 1,
                              padding: "8px 12px",
                              borderRadius: "6px",
                              border: "1px solid #cbd5e1",
                              background: "white",
                              fontSize: "12px",
                              color: "#475569",
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(createdStaffActivation.link)
                              setCopiedLink(true)
                              setTimeout(() => setCopiedLink(false), 2500)
                            }}
                            style={{
                              padding: "8px 14px",
                              borderRadius: "6px",
                              background: copiedLink ? "#16a34a" : "#4f46e5",
                              color: "white",
                              border: "none",
                              fontWeight: 600,
                              fontSize: "12px",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {copiedLink ? "Copied!" : "Copy Link"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddStaffOpen(false)
                        setCreatedStaffActivation(null)
                        setAddStaffSuccess(null)
                        setNewStaffForm({
                          name: "",
                          email: "",
                          phone: "",
                          specialization: "General Maintenance",
                          password: "",
                        })
                      }}
                      style={{
                        padding: "9px 24px",
                        background: "#4f46e5",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: 600,
                        fontSize: "14px",
                        cursor: "pointer",
                      }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateStaff} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={newStaffForm.name}
                      onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Email Address (Login Username) *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. ramesh.maintenance@hostel.com"
                      value={newStaffForm.email}
                      onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                      }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. +91 9876543210"
                        value={newStaffForm.phone}
                        onChange={(e) => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "14px",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                        Specialization *
                      </label>
                      <select
                        value={newStaffForm.specialization}
                        onChange={(e) => setNewStaffForm({ ...newStaffForm, specialization: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "14px",
                          background: "white",
                        }}
                      >
                        {SPECIALIZATION_OPTIONS.map((spec) => (
                          <option key={spec} value={spec}>
                            {spec}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Initial Password (Optional)
                    </label>
                    <div style={{ position: "relative" }}>
                      <KeyRound
                        size={16}
                        style={{ position: "absolute", left: "12px", top: "11px", color: "#94a3b8" }}
                      />
                      <input
                        type="password"
                        minLength={newStaffForm.password ? 6 : undefined}
                        placeholder="Leave blank to generate an invitation link"
                        value={newStaffForm.password}
                        onChange={(e) => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "9px 12px 9px 36px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "14px",
                        }}
                      />
                    </div>
                    <span style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", display: "block" }}>
                      💡 If left blank, a secure 7-day activation link will be generated for the technician to set their own password.
                    </span>
                  </div>

                  <div
                    style={{
                      background: "#f8fafc",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#64748b",
                      marginTop: "4px",
                    }}
                  >
                    🔒 <strong>Staff Security:</strong> The technician will be registered exclusively for{" "}
                    <strong>{currentUser.hostel || "your hostel"}</strong> with role <code>staff</code>.
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                    <button
                      type="button"
                      disabled={addStaffLoading}
                      onClick={() => setIsAddStaffOpen(false)}
                      style={{
                        padding: "9px 16px",
                        background: "white",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        fontWeight: 600,
                        fontSize: "14px",
                        color: "#475569",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={addStaffLoading}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "9px 20px",
                        background: "#4f46e5",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: 600,
                        fontSize: "14px",
                        color: "white",
                        cursor: addStaffLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {addStaffLoading ? "Processing..." : newStaffForm.password ? "Create Staff Account" : "Generate Staff Invitation"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* MODAL: EDIT STAFF DETAILS */}
        {editingStaff && (
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
              zIndex: 1000,
              padding: "20px",
            }}
            onClick={() => !editStaffLoading && setEditingStaff(null)}
          >
            <div
              style={{
                background: "white",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "460px",
                padding: "24px",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: "#e0e7ff",
                      color: "#4f46e5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Edit3 size={18} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
                    Edit Technician Details
                  </h3>
                </div>

                <button
                  onClick={() => setEditingStaff(null)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#64748b",
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {editStaffError && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "#fee2e2",
                    color: "#991b1b",
                    borderRadius: "8px",
                    marginBottom: "16px",
                    fontSize: "13px",
                  }}
                >
                  {editStaffError}
                </div>
              )}

              <form onSubmit={handleSaveEditStaff} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                    Specialization
                  </label>
                  <select
                    value={editForm.specialization}
                    onChange={(e) => setEditForm({ ...editForm, specialization: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      background: "white",
                    }}
                  >
                    {SPECIALIZATION_OPTIONS.map((spec) => (
                      <option key={spec} value={spec}>
                        {spec}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                  <button
                    type="button"
                    disabled={editStaffLoading}
                    onClick={() => setEditingStaff(null)}
                    style={{
                      padding: "9px 16px",
                      background: "white",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "14px",
                      color: "#475569",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={editStaffLoading}
                    style={{
                      padding: "9px 20px",
                      background: "#4f46e5",
                      border: "none",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "14px",
                      color: "white",
                      cursor: editStaffLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {editStaffLoading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}