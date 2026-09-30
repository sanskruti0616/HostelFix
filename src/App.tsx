
import { useEffect, useState } from "react"

import Login from "./pages/Login"
import StudentDashboard from "./pages/StudentDashboard"
import WardenDashboard from "./pages/WardenDashboard"
import StaffDashboard from "./pages/StaffDashboard"
import AdminDashboard from "./pages/AdminDashboard"
import RaiseComplaint from "./pages/RaiseComplaint"
import ComplaintHistory from "./pages/ComplaintHistory"
import ComplaintDetails from "./pages/ComplaintDetails"

import type {
  Complaint,
  ComplaintStatus,
  UserRole,
} from "./types"

type StudentPage =
  | "dashboard"
  | "raise-complaint"
  | "history"
  | "details"

const API_URL = "http://localhost:5000"

interface BackendComplaint {
  id: number
  student_id: number
  student_name: string
  hostel: string
  room: string
  title: string
  description: string
  category: string
  priority: string
  status: string
  assigned_staff_id: number | null
  assigned_staff: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

function formatDate(dateString: string) {
  if (!dateString) {
    return new Date().toISOString().split("T")[0]
  }

  return dateString.split("T")[0]
}

function convertBackendComplaint(
  complaint: BackendComplaint
): Complaint {
  return {
    id: `HF-${complaint.id}`,
    studentId: `STU${String(complaint.student_id).padStart(3, "0")}`,
    studentName: complaint.student_name || "Unknown Student",
    hostel: complaint.hostel || "",
    room: complaint.room || "",
    title: complaint.title || "",
    description: complaint.description || "",
    category: complaint.category as Complaint["category"],
    priority: complaint.priority as Complaint["priority"],
    status: complaint.status as ComplaintStatus,
    assignedStaff: complaint.assigned_staff || undefined,
    createdAt: formatDate(complaint.created_at),
    updatedAt: formatDate(complaint.updated_at),
  }
}

function App() {
  const [role, setRole] = useState<UserRole | null>(null)
  const [studentPage, setStudentPage] =
    useState<StudentPage>("dashboard")
  const [complaintList, setComplaintList] =
    useState<Complaint[]>([])
  const [selectedComplaint, setSelectedComplaint] =
    useState<Complaint | null>(null)
  const [currentStaffName, setCurrentStaffName] =
    useState("")
  const [isLoadingComplaints, setIsLoadingComplaints] =
    useState(true)

  // LOAD COMPLAINTS FROM MYSQL
  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        setIsLoadingComplaints(true)

        const response = await fetch(
          `${API_URL}/api/complaints`
        )

        if (!response.ok) {
          throw new Error("Failed to fetch complaints")
        }

        const data = await response.json()

        if (!data.success) {
          throw new Error(
            data.message || "Failed to load complaints"
          )
        }

        const backendComplaints: BackendComplaint[] =
          Array.isArray(data.complaints)
            ? data.complaints
            : []

        const convertedComplaints =
          backendComplaints.map(convertBackendComplaint)

        setComplaintList(convertedComplaints)
      } catch (error) {
        console.error("Failed to load complaints:", error)

        alert(
          "Could not load complaints from the server. Please make sure the HostelFix backend is running."
        )
      } finally {
        setIsLoadingComplaints(false)
      }
    }

    fetchComplaints()
  }, [])

  // LOGIN
  const handleLogin = (
    selectedRole: UserRole,
    staffName?: string
  ) => {
    setRole(selectedRole)
    setSelectedComplaint(null)
    setStudentPage("dashboard")

    if (selectedRole === "staff") {
      setCurrentStaffName(staffName ?? "")
    }
  }

  // LOGOUT
  const handleLogout = () => {
    setRole(null)
    setStudentPage("dashboard")
    setSelectedComplaint(null)
    setCurrentStaffName("")
  }

  // STUDENT SUBMITS COMPLAINT
  const handleComplaintSubmit = (
    newComplaint: Complaint
  ) => {
    setComplaintList((current) => [
      newComplaint,
      ...current,
    ])

    setStudentPage("dashboard")
  }

  // VIEW COMPLAINT
  const handleViewComplaint = (
    complaint: Complaint
  ) => {
    setSelectedComplaint(complaint)
    setStudentPage("details")
  }

  // STAFF IDS IN MYSQL
  const staffIds: Record<string, number> = {
    "Vaishnavi Bhoiwade": 3,
    "Bhargavi Borkhade": 4,
    "Bhavesh Bhut": 5,
    "Ruturaj Bhome": 6,
  }

  // WARDEN ASSIGNS STAFF
  const handleAssignStaff = async (
    complaintId: string,
    staffName: string
  ) => {
    try {
      if (!staffName) {
        alert("Please select a staff member.")
        return
      }

      const databaseComplaintId = Number(
        complaintId.replace("HF-", "")
      )

      const staffId = staffIds[staffName]

      if (
        !Number.isInteger(databaseComplaintId) ||
        databaseComplaintId <= 0
      ) {
        throw new Error("Invalid complaint ID.")
      }

      if (!staffId) {
        throw new Error("Invalid staff member selected.")
      }

      const response = await fetch(
        `${API_URL}/api/complaints/${databaseComplaintId}/assign`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            staff_id: staffId,
            actor_id: 2,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to assign staff."
        )
      }

      const updatedComplaint =
        convertBackendComplaint(
          data.complaint as BackendComplaint
        )

      setComplaintList((current) =>
        current.map((complaint) =>
          complaint.id === complaintId
            ? updatedComplaint
            : complaint
        )
      )

      setSelectedComplaint(updatedComplaint)

      alert(`${staffName} has been assigned successfully.`)
    } catch (error) {
      console.error("Assignment error:", error)

      alert(
        error instanceof Error
          ? error.message
          : "Failed to assign staff."
      )
    }
  }

  // CHANGE COMPLAINT STATUS
  const handleStatusChange = async (
    complaintId: string,
    status: ComplaintStatus,
    note?: string
  ) => {
    try {
      const databaseComplaintId = Number(
        complaintId.replace("HF-", "")
      )

      if (
        !Number.isInteger(databaseComplaintId) ||
        databaseComplaintId <= 0
      ) {
        throw new Error("Invalid complaint ID.")
      }

      const actorId =
        role === "staff"
          ? staffIds[currentStaffName]
          : 2

      if (!actorId) {
        throw new Error(
          "Could not identify the current user."
        )
      }

      const response = await fetch(
        `${API_URL}/api/complaints/${databaseComplaintId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
            actor_id: actorId,
            note:
              note ||
              `Complaint status changed to ${status}.`,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to update complaint status."
        )
      }

      const updatedComplaint =
        convertBackendComplaint(
          data.complaint as BackendComplaint
        )

      setComplaintList((current) =>
        current.map((complaint) =>
          complaint.id === complaintId
            ? updatedComplaint
            : complaint
        )
      )

      setSelectedComplaint(updatedComplaint)
    } catch (error) {
      console.error("Status update error:", error)

      alert(
        error instanceof Error
          ? error.message
          : "Failed to update complaint status."
      )
    }
  }

  // LOADING
  if (isLoadingComplaints) {
    return (
      <div className="coming-soon">
        <div className="coming-soon-card">
          <div className="coming-soon-icon">🏠</div>
          <h1>HostelFix</h1>
          <p>Loading complaints...</p>
        </div>
      </div>
    )
  }

  // STUDENT
  if (role === "student") {
    if (
      studentPage === "details" &&
      selectedComplaint
    ) {
      return (
        <ComplaintDetails
          complaint={selectedComplaint}
          onBack={() => setStudentPage("history")}
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
          onBack={() => setStudentPage("dashboard")}
          onComplaintSubmitted={handleComplaintSubmit}
        />
      )
    }

    return (
      <StudentDashboard
        complaints={complaintList}
        onLogout={handleLogout}
        onRaiseComplaint={() =>
          setStudentPage("raise-complaint")
        }
        onViewHistory={() =>
          setStudentPage("history")
        }
        onViewComplaint={handleViewComplaint}
      />
    )
  }

  // WARDEN
  if (role === "warden") {
    if (
      studentPage === "details" &&
      selectedComplaint
    ) {
      return (
        <ComplaintDetails
          complaint={selectedComplaint}
          isWarden
          onBack={() => setStudentPage("dashboard")}
          onAssignStaff={(staffName) =>
            handleAssignStaff(
              selectedComplaint.id,
              staffName
            )
          }
          onStatusChange={(status) =>
            handleStatusChange(
              selectedComplaint.id,
              status
            )
          }
        />
      )
    }

    return (
      <WardenDashboard
        complaints={complaintList}
        onLogout={handleLogout}
        onViewComplaint={handleViewComplaint}
      />
    )
  }

  // STAFF
  if (role === "staff") {
    if (
      studentPage === "details" &&
      selectedComplaint
    ) {
      return (
        <ComplaintDetails
          complaint={selectedComplaint}
          onBack={() => setStudentPage("dashboard")}
          onStatusChange={(status) =>
            handleStatusChange(
              selectedComplaint.id,
              status
            )
          }
        />
      )
    }

    return (
      <StaffDashboard
        complaints={complaintList}
        staffName={currentStaffName}
        onLogout={handleLogout}
        onViewComplaint={handleViewComplaint}
        onStatusChange={handleStatusChange}
      />
    )
  }

  // ADMIN
  if (role === "admin") {
    return (
      <AdminDashboard
        complaints={complaintList}
        onLogout={handleLogout}
        onViewComplaint={handleViewComplaint}
      />
    )
  }

  // LOGIN
  return <Login onLogin={handleLogin} />
}

export default App