import { useEffect, useState, useCallback } from "react"
import LandingPage from "./pages/LandingPage"
import Login from "./pages/Login"
import SignUp from "./pages/SignUp"
import AffiliationOnboarding from "./pages/AffiliationOnboarding"
import StudentDashboard from "./pages/StudentDashboard"
import WardenDashboard from "./pages/WardenDashboard"
import StaffDashboard from "./pages/StaffDashboard"
import AdminDashboard from "./pages/AdminDashboard"
import RaiseComplaint from "./pages/RaiseComplaint"
import ComplaintHistory from "./pages/ComplaintHistory"
import ComplaintDetails from "./pages/ComplaintDetails"

import StaffLogin from "./pages/StaffLogin"
import StaffSignUp from "./pages/StaffSignUp"

import type { Complaint, ComplaintStatus, User } from "./types"
import { api, getStoredToken, getStoredUser, clearStoredAuth } from "./services/api"
import { getSocket, updateSocketAuth, disconnectSocket } from "./services/socket"
import { CheckCircle, AlertCircle, Info, X } from "lucide-react"

type StudentPage = "dashboard" | "raise-complaint" | "history" | "details"
type UnauthView = "landing" | "login" | "signup" | "staff-login" | "staff-signup"

const getInitialUnauthView = (): UnauthView => {
  if (typeof window === "undefined") return "landing"
  const path = window.location.pathname.toLowerCase()
  if (path === "/staff/login") return "staff-login"
  if (path === "/staff/signup" || path === "/staff/activate") return "staff-signup"
  if (path === "/login") return "login"
  if (path === "/signup") return "signup"
  return "landing"
}

interface ToastNotification {
  id: string
  title: string
  message: string
  type: "info" | "success" | "warning"
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(getStoredUser())
  const [unauthView, setUnauthView] = useState<UnauthView>(getInitialUnauthView)
  const [signUpInitialTab, setSignUpInitialTab] = useState<"student" | "organization">("student")
  const [studentPage, setStudentPage] = useState<StudentPage>("dashboard")
  const [complaintList, setComplaintList] = useState<Complaint[]>([])
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [toasts, setToasts] = useState<ToastNotification[]>([])

  const addToast = useCallback((title: string, message: string, type: "info" | "success" | "warning" = "info") => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, title, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  // 1. Session verification on initial mount
  useEffect(() => {
    const token = getStoredToken()
    if (!token) {
      setIsLoadingSession(false)
      return
    }

    api.auth.getMe()
      .then((res) => {
        setCurrentUser(res.user)
        updateSocketAuth()
      })
      .catch((err) => {
        console.warn("Session restore failed:", err.message)
        clearStoredAuth()
        setCurrentUser(null)
      })
      .finally(() => {
        setIsLoadingSession(false)
      })
  }, [])

  // 2. Fetch complaints from real backend API for logged-in user
  const fetchComplaints = useCallback(async () => {
    if (!currentUser) return
    try {
      const data = await api.complaints.list()
      setComplaintList(data.complaints || [])

      // If a complaint is currently selected, refresh its details
      if (selectedComplaint) {
        const refreshed = data.complaints.find((c) => c.id === selectedComplaint.id)
        if (refreshed) {
          setSelectedComplaint(refreshed)
        }
      }
    } catch (error: any) {
      console.error("Failed to load complaints from backend:", error.message)
    }
  }, [currentUser, selectedComplaint])

  useEffect(() => {
    if (currentUser) {
      fetchComplaints()
    }
  }, [currentUser])

  // 3. Socket.IO Real-time Events Listener
  useEffect(() => {
    if (!currentUser) return

    const socket = getSocket()

    const handleComplaintCreated = (newComplaint: Complaint) => {
      setComplaintList((prev) => [newComplaint, ...prev.filter((c) => c.id !== newComplaint.id)])
      addToast(
        "New Complaint Filed",
        `#${newComplaint.id}: ${newComplaint.title} (${newComplaint.category})`,
        "info"
      )
    }

    const handleComplaintUpdated = (updatedComplaint: Complaint) => {
      setComplaintList((prev) =>
        prev.map((c) => (c.id === updatedComplaint.id ? updatedComplaint : c))
      )
      if (selectedComplaint && selectedComplaint.id === updatedComplaint.id) {
        setSelectedComplaint(updatedComplaint)
      }
      addToast(
        "Status Update",
        `#${updatedComplaint.id} is now ${updatedComplaint.status.replace("-", " ")}`,
        "success"
      )
    }

    const handleNewNotification = (notification: any) => {
      addToast(notification.title, notification.message, "info")
    }

    socket.on("complaint:created", handleComplaintCreated)
    socket.on("complaint:updated", handleComplaintUpdated)
    socket.on("notification:new", handleNewNotification)

    return () => {
      socket.off("complaint:created", handleComplaintCreated)
      socket.off("complaint:updated", handleComplaintUpdated)
      socket.off("notification:new", handleNewNotification)
    }
  }, [currentUser, selectedComplaint, addToast])

  // Browser history navigation synchronization
  const navigateToUnauthView = useCallback((view: UnauthView, urlPath?: string) => {
    setUnauthView(view)
    const targetPath =
      urlPath ||
      (view === "staff-login"
        ? "/staff/login"
        : view === "staff-signup"
        ? "/staff/signup"
        : view === "login"
        ? "/login"
        : view === "signup"
        ? "/signup"
        : "/")
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ view }, "", targetPath)
    }
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      setUnauthView(getInitialUnauthView())
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  // 4. Handle Login Success
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user)
    setSelectedComplaint(null)
    setStudentPage("dashboard")
    updateSocketAuth()
    if (window.location.pathname !== "/") {
      window.history.pushState({}, "", "/")
    }
  }

  // 5. Handle Logout
  const handleLogout = () => {
    api.auth.logout()
    disconnectSocket()
    setCurrentUser(null)
    setComplaintList([])
    setSelectedComplaint(null)
    setStudentPage("dashboard")
    navigateToUnauthView("landing", "/")
  }

  // 6. Handle Complaint Submission
  const handleComplaintSubmit = (newComplaint: Complaint) => {
    setComplaintList((prev) => [newComplaint, ...prev])
    setStudentPage("dashboard")
    addToast("Complaint Registered", `#${newComplaint.id} submitted successfully!`, "success")
  }

  // 7. View Complaint Details
  const handleViewComplaint = (complaint: Complaint) => {
    setSelectedComplaint(complaint)
    setStudentPage("details")
  }

  // 8. Warden Assigns Staff
  const handleAssignStaff = async (complaintId: string, staffName: string) => {
    try {
      const result = await api.complaints.assignStaff(complaintId, staffName)
      const updated = result.complaint
      setComplaintList((prev) => prev.map((c) => (c.id === complaintId ? updated : c)))
      setSelectedComplaint(updated)
      addToast("Technician Assigned", `${staffName} assigned to #${complaintId}`, "success")
    } catch (error: any) {
      alert(error.message || "Failed to assign staff")
    }
  }

  // 9. Change Complaint Status
  const handleStatusChange = async (
    complaintId: string,
    status: ComplaintStatus,
    note?: string
  ) => {
    try {
      const result = await api.complaints.updateStatus(complaintId, status, note)
      const updated = result.complaint
      setComplaintList((prev) => prev.map((c) => (c.id === complaintId ? updated : c)))
      setSelectedComplaint(updated)
      addToast("Status Updated", `Complaint #${complaintId} changed to ${status}`, "success")
    } catch (error: any) {
      alert(error.message || "Failed to update complaint status")
    }
  }

  // Initial session loading screen
  if (isLoadingSession) {
    return (
      <div className="coming-soon">
        <div className="coming-soon-card">
          <div className="coming-soon-icon">🏠</div>
          <h1>HostelFix</h1>
          <p>Verifying secure session...</p>
        </div>
      </div>
    )
  }

  // Unauthenticated routing: Landing Page, Login, Sign Up, Staff Login, or Staff Sign Up
  if (!currentUser) {
    if (unauthView === "staff-login") {
      return (
        <StaffLogin
          onLoginSuccess={handleLoginSuccess}
          onNavigateHome={() => navigateToUnauthView("landing", "/")}
          onNavigateStaffSignUp={() => navigateToUnauthView("staff-signup", "/staff/signup")}
          onNavigateMainLogin={() => navigateToUnauthView("login", "/login")}
        />
      )
    }

    if (unauthView === "staff-signup") {
      return (
        <StaffSignUp
          onSignUpSuccess={handleLoginSuccess}
          onNavigateHome={() => navigateToUnauthView("landing", "/")}
          onNavigateStaffLogin={() => navigateToUnauthView("staff-login", "/staff/login")}
          onNavigateMainLogin={() => navigateToUnauthView("login", "/login")}
        />
      )
    }

    if (unauthView === "login") {
      return (
        <Login
          onLoginSuccess={handleLoginSuccess}
          onNavigateHome={() => navigateToUnauthView("landing", "/")}
          onNavigateSignUp={() => {
            setSignUpInitialTab("student")
            navigateToUnauthView("signup", "/signup")
          }}
          onNavigateStaffLogin={() => navigateToUnauthView("staff-login", "/staff/login")}
          onNavigateStaffSignUp={() => navigateToUnauthView("staff-signup", "/staff/signup")}
        />
      )
    }

    if (unauthView === "signup") {
      return (
        <SignUp
          initialTab={signUpInitialTab}
          onNavigateHome={() => navigateToUnauthView("landing", "/")}
          onNavigateLogin={() => navigateToUnauthView("login", "/login")}
          onSignUpSuccess={handleLoginSuccess}
        />
      )
    }

    // Default unauthenticated view: Public SaaS Landing Page
    return (
      <LandingPage
        onNavigateLogin={() => navigateToUnauthView("login", "/login")}
        onNavigateSignUp={(tab) => {
          setSignUpInitialTab(tab || "student")
          navigateToUnauthView("signup", "/signup")
        }}
        onNavigateStaffLogin={() => navigateToUnauthView("staff-login", "/staff/login")}
        onNavigateStaffSignUp={() => navigateToUnauthView("staff-signup", "/staff/signup")}
      />
    )
  }

  // Pending Hostel Affiliation or Pending Approval
  if (
    currentUser.accountStatus === "pending_affiliation" ||
    currentUser.accountStatus === "pending_approval" ||
    (currentUser.role === "student" && !currentUser.organizationId)
  ) {
    return (
      <AffiliationOnboarding
        currentUser={currentUser}
        onAffiliationComplete={(updated) => {
          setCurrentUser(updated)
          addToast(
            "Affiliation Complete",
            `Connected to ${updated.organizationName || "your hostel"}!`,
            "success"
          )
        }}
        onLogout={handleLogout}
      />
    )
  }

  // Role: STUDENT
  const renderStudentView = () => {
    if (studentPage === "details" && selectedComplaint) {
      return (
        <ComplaintDetails
          complaint={selectedComplaint}
          currentUser={currentUser}
          onBack={() => setStudentPage("history")}
          onRefreshComplaint={fetchComplaints}
        />
      )
    }

    if (studentPage === "history") {
      return (
        <ComplaintHistory
          complaints={complaintList}
          onBack={() => setStudentPage("dashboard")}
          onViewComplaint={handleViewComplaint}
        />
      )
    }

    if (studentPage === "raise-complaint") {
      return (
        <RaiseComplaint
          currentUser={currentUser}
          onBack={() => setStudentPage("dashboard")}
          onComplaintSubmitted={handleComplaintSubmit}
        />
      )
    }

    return (
      <StudentDashboard
        currentUser={currentUser}
        complaints={complaintList}
        onLogout={handleLogout}
        onRaiseComplaint={() => setStudentPage("raise-complaint")}
        onViewHistory={() => setStudentPage("history")}
        onViewComplaint={handleViewComplaint}
        onRefresh={fetchComplaints}
      />
    )
  }

  // Role: WARDEN
  const renderWardenView = () => {
    if (studentPage === "details" && selectedComplaint) {
      return (
        <ComplaintDetails
          complaint={selectedComplaint}
          currentUser={currentUser}
          isWarden
          onBack={() => setStudentPage("dashboard")}
          onAssignStaff={(staffName) => handleAssignStaff(selectedComplaint.id, staffName)}
          onStatusChange={(status, note) => handleStatusChange(selectedComplaint.id, status, note)}
          onRefreshComplaint={fetchComplaints}
        />
      )
    }

    return (
      <WardenDashboard
        currentUser={currentUser}
        complaints={complaintList}
        onLogout={handleLogout}
        onViewComplaint={handleViewComplaint}
        onRefresh={fetchComplaints}
      />
    )
  }

  // Role: STAFF
  const renderStaffView = () => {
    if (studentPage === "details" && selectedComplaint) {
      return (
        <ComplaintDetails
          complaint={selectedComplaint}
          currentUser={currentUser}
          onBack={() => setStudentPage("dashboard")}
          onStatusChange={(status, note) => handleStatusChange(selectedComplaint.id, status, note)}
          onRefreshComplaint={fetchComplaints}
        />
      )
    }

    return (
      <StaffDashboard
        currentUser={currentUser}
        complaints={complaintList}
        onLogout={handleLogout}
        onViewComplaint={handleViewComplaint}
        onStatusChange={handleStatusChange}
        onRefresh={fetchComplaints}
      />
    )
  }

  // Role: ADMIN
  const renderAdminView = () => {
    if (studentPage === "details" && selectedComplaint) {
      return (
        <ComplaintDetails
          complaint={selectedComplaint}
          currentUser={currentUser}
          isWarden
          onBack={() => setStudentPage("dashboard")}
          onAssignStaff={(staffName) => handleAssignStaff(selectedComplaint.id, staffName)}
          onStatusChange={(status, note) => handleStatusChange(selectedComplaint.id, status, note)}
          onRefreshComplaint={fetchComplaints}
        />
      )
    }

    return (
      <AdminDashboard
        currentUser={currentUser}
        complaints={complaintList}
        onLogout={handleLogout}
        onViewComplaint={handleViewComplaint}
        onRefresh={fetchComplaints}
      />
    )
  }

  return (
    <>
      {/* Toast Notification Container */}
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          zIndex: 9999,
          maxWidth: "360px",
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              padding: "12px 16px",
              background: "#1e293b",
              color: "white",
              borderRadius: "10px",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2)",
              fontSize: "13px",
            }}
          >
            {toast.type === "success" && <CheckCircle size={18} color="#22c55e" style={{ flexShrink: 0 }} />}
            {toast.type === "warning" && <AlertCircle size={18} color="#f59e0b" style={{ flexShrink: 0 }} />}
            {toast.type === "info" && <Info size={18} color="#38bdf8" style={{ flexShrink: 0 }} />}
            <div style={{ flex: 1 }}>
              <strong style={{ display: "block", marginBottom: "2px" }}>{toast.title}</strong>
              <span style={{ color: "#cbd5e1" }}>{toast.message}</span>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "2px" }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {currentUser.role === "student" && renderStudentView()}
      {currentUser.role === "warden" && renderWardenView()}
      {currentUser.role === "staff" && renderStaffView()}
      {currentUser.role === "admin" && renderAdminView()}
    </>
  )
}