import { useState, useEffect, useRef } from "react"
import { Home, LogIn, ShieldCheck, Wrench, UserRound, AlertCircle, Loader2 } from "lucide-react"
import type { User, UserRole } from "../types"
import { api } from "../services/api"

interface LoginProps {
  onLoginSuccess: (user: User) => void
}

const roleDetails = {
  student: {
    label: "Student",
    description: "Raise and track hostel complaints",
    email: "sanskruti@hostelfix.com",
    icon: UserRound,
  },
  warden: {
    label: "Warden",
    description: "Manage complaints and assign staff",
    email: "warden@hostelfix.com",
    icon: ShieldCheck,
  },
  staff: {
    label: "Maintenance Staff",
    description: "Handle assigned maintenance requests",
    email: "vaishnavi@hostelfix.com",
    icon: Wrench,
  },
  admin: {
    label: "Administrator",
    description: "Manage the complete HostelFix system",
    email: "admin@hostelfix.com",
    icon: ShieldCheck,
  },
}

const staffSeedList = [
  { name: "Vaishnavi Bhoiwade", email: "vaishnavi@hostelfix.com" },
  { name: "Bhargavi Borkhade", email: "bhargavi@hostelfix.com" },
  { name: "Bhavesh Bhut", email: "bhavesh@hostelfix.com" },
  { name: "Ruturaj Bhome", email: "ruturaj@hostelfix.com" },
]

export default function Login({ onLoginSuccess }: LoginProps) {
  const [role, setRole] = useState<UserRole>("student")
  const [selectedStaffEmail, setSelectedStaffEmail] = useState(staffSeedList[0].email)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const googleBtnRef = useRef<HTMLDivElement>(null)

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ""
  const isGoogleConfigured = Boolean(
    googleClientId && !googleClientId.includes("your-google-client-id")
  )

  // Initialize Google Identity Services if client ID is configured
  useEffect(() => {
    if (!isGoogleConfigured) return

    const handleGoogleCredentialResponse = async (response: any) => {
      try {
        setIsLoading(true)
        setErrorMessage(null)
        const result = await api.auth.googleLogin(response.credential)
        onLoginSuccess(result.user)
      } catch (err: any) {
        setErrorMessage(err.message || "Google authentication failed. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }

    // Load Google script
    const script = document.createElement("script")
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    script.defer = true
    script.onload = () => {
      if ((window as any).google && googleBtnRef.current) {
        ;(window as any).google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredentialResponse,
        })
        ;(window as any).google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "outline",
          size: "large",
          width: 320,
          text: "continue_with",
        })
      }
    }
    document.body.appendChild(script)

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
  }, [googleClientId, isGoogleConfigured, onLoginSuccess])

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const targetEmail = role === "staff" ? selectedStaffEmail : roleDetails[role].email
      const result = await api.auth.devLogin(targetEmail)
      onLoginSuccess(result.user)
    } catch (err: any) {
      setErrorMessage(
        err.message || "Sign in failed. Make sure the backend server is running with 'npm run dev'."
      )
    } finally {
      setIsLoading(false)
    }
  }

  const selectedRole = roleDetails[role]
  const SelectedIcon = selectedRole.icon

  return (
    <div className="login-page">
      {/* Left branding section */}
      <div className="login-brand">
        <div className="brand-logo">
          <Home size={30} />
        </div>

        <h1>HostelFix</h1>

        <p>Smart Hostel Complaint & Maintenance Management System</p>

        <div className="brand-features">
          <div>
            <span>✓</span>
            Easy real-time complaint registration
          </div>
          <div>
            <span>✓</span>
            AI-assisted verification & duplicate detection
          </div>
          <div>
            <span>✓</span>
            Multi-device persistent MongoDB Atlas synchronization
          </div>
          <div>
            <span>✓</span>
            Verified technician assignment & resolution tracking
          </div>
        </div>
      </div>

      {/* Login card */}
      <div className="login-container">
        <div className="login-card">
          <div className="mobile-logo">
            <Home size={28} />
          </div>

          <h2>Welcome to HostelFix</h2>
          <p className="login-subtitle">Sign in to manage and track hostel services</p>

          {errorMessage && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 16px",
                marginBottom: "20px",
                background: "#fef2f2",
                border: "1px solid #fee2e2",
                borderRadius: "8px",
                color: "#b91c1c",
                fontSize: "14px",
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Google Sign In Button if configured */}
          {isGoogleConfigured && (
            <div style={{ marginBottom: "24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div ref={googleBtnRef} style={{ minHeight: "44px" }} />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  margin: "20px 0 10px",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
                <span style={{ padding: "0 12px" }}>or sign in with authorized role</span>
                <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
              </div>
            </div>
          )}

          <form onSubmit={handleDevLogin}>
            {/* Role selector */}
            <div className="form-group">
              <label>Select Role</label>
              <div className="role-grid">
                {(Object.keys(roleDetails) as UserRole[]).map((roleOption) => {
                  const RoleIcon = roleDetails[roleOption].icon
                  return (
                    <button
                      type="button"
                      key={roleOption}
                      className={`role-option ${role === roleOption ? "selected" : ""}`}
                      onClick={() => {
                        setRole(roleOption)
                        setErrorMessage(null)
                      }}
                      disabled={isLoading}
                    >
                      <RoleIcon size={20} />
                      <span>{roleDetails[roleOption].label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Staff member dropdown */}
            {role === "staff" && (
              <div className="form-group">
                <label htmlFor="staff-member">Select Staff Member</label>
                <select
                  id="staff-member"
                  className="staff-select"
                  value={selectedStaffEmail}
                  onChange={(e) => setSelectedStaffEmail(e.target.value)}
                  disabled={isLoading}
                >
                  {staffSeedList.map((member) => (
                    <option key={member.email} value={member.email}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Role information card */}
            <div className="selected-role">
              <div className="selected-role-icon">
                <SelectedIcon size={18} />
              </div>
              <div>
                <strong>
                  {role === "staff"
                    ? staffSeedList.find((s) => s.email === selectedStaffEmail)?.name
                    : selectedRole.label}
                </strong>
                <span>{selectedRole.description}</span>
              </div>
            </div>

            {/* Submit button */}
            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Connecting to server...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Sign In as {selectedRole.label}
                </>
              )}
            </button>
          </form>

          {!isGoogleConfigured && (
            <p className="demo-note" style={{ marginTop: "16px", color: "#64748b", fontSize: "13px" }}>
              💡 Connects to authenticated backend at <code>http://localhost:5000</code>. To enable Google Sign-In, add your <code>VITE_GOOGLE_CLIENT_ID</code> to <code>.env</code>.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}