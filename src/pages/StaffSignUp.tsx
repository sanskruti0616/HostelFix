import { useState, useEffect, useRef, useCallback } from "react"
import {
  Wrench,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Lock,
  CheckCircle2,
  ArrowRight,
  Home,
  ShieldCheck,
  Building2,
  Briefcase,
  Mail,
  User,
  KeyRound,
} from "lucide-react"
import type { User as UserType } from "../types"
import { api } from "../services/api"

interface StaffSignUpProps {
  onSignUpSuccess: (user: UserType) => void
  onNavigateHome?: () => void
  onNavigateStaffLogin?: () => void
  onNavigateMainLogin?: () => void
}

interface VerifiedStaffInfo {
  id: string
  name: string
  email: string
  phone?: string
  specialization?: string
  hostelName?: string
  organizationName?: string
  accountStatus?: string
}

export default function StaffSignUp({
  onSignUpSuccess,
  onNavigateHome,
  onNavigateStaffLogin,
  onNavigateMainLogin,
}: StaffSignUpProps) {
  // Read token from URL query parameter ?token=... if present
  const queryToken = new URLSearchParams(window.location.search).get("token") || ""

  const [tokenInput, setTokenInput] = useState(queryToken)
  const [isVerifyingToken, setIsVerifyingToken] = useState(false)
  const [tokenVerified, setTokenVerified] = useState(false)
  const [verifiedStaff, setVerifiedStaff] = useState<VerifiedStaffInfo | null>(null)

  // Password setting state
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Status messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const googleBtnRef = useRef<HTMLDivElement>(null)
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ""
  const isGoogleConfigured = Boolean(
    googleClientId && !googleClientId.includes("your-google-client-id")
  )

  // Token Verification Handler
  const handleVerifyToken = useCallback(async (tokenToVerify?: string) => {
    const rawToken = tokenToVerify || tokenInput
    const cleanToken = rawToken.trim()

    if (!cleanToken) {
      setErrorMessage("Please enter your staff activation code.")
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setIsVerifyingToken(true)

    try {
      const res = await api.auth.staff.verifyToken(cleanToken)
      if (res.success && res.staff) {
        setVerifiedStaff(res.staff)
        setTokenVerified(true)
        setSuccessMessage(`Activation code verified for ${res.staff.name} (${res.staff.hostelName || "Hostel"}).`)
      } else {
        setTokenVerified(false)
        setVerifiedStaff(null)
        setErrorMessage(res.message || "Invalid or expired activation code.")
      }
    } catch (err: any) {
      setTokenVerified(false)
      setVerifiedStaff(null)
      setErrorMessage(
        err.message ||
          "Failed to verify activation code. Please check that the code matches the invitation from your warden."
      )
    } finally {
      setIsVerifyingToken(false)
    }
  }, [tokenInput])

  // Auto-verify if token is provided in URL
  useEffect(() => {
    if (queryToken && queryToken.trim().length >= 4) {
      handleVerifyToken(queryToken.trim())
    }
  }, [queryToken, handleVerifyToken])

  // Password Setup & Account Activation Handler
  const handleActivateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!tokenVerified || !verifiedStaff) {
      setErrorMessage("Please verify your activation code first.")
      return
    }

    if (!password || password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.")
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please re-enter.")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await api.auth.staff.activate(tokenInput.trim(), password)
      setSuccessMessage(`Account activated! Welcome to HostelFix, ${res.user.name}.`)
      setTimeout(() => {
        onSignUpSuccess(res.user)
      }, 600)
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to activate staff account.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Left Side: Brand Panel */}
        <aside
          className="login-brand"
          style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)" }}
        >
          <div className="brand-header">
            <div
              className="brand-logo"
              style={{
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                boxShadow: "0 4px 12px rgba(245, 158, 11, 0.35)",
              }}
            >
              <Wrench size={28} color="#ffffff" />
            </div>
            <div>
              <span className="brand-name">HostelFix</span>
              <span className="brand-tagline">Staff Account Activation</span>
            </div>
          </div>

          <div className="brand-body">
            <h2
              style={{
                color: "#ffffff",
                fontSize: "28px",
                fontWeight: 800,
                lineHeight: 1.25,
                marginBottom: "16px",
              }}
            >
              Join Your Campus Maintenance Team
            </h2>
            <p
              style={{
                color: "#cbd5e1",
                fontSize: "14px",
                lineHeight: 1.6,
                marginBottom: "32px",
              }}
            >
              Activate your pre-authorized technician credentials to access work orders, room repair histories, and complete maintenance dispatches.
            </p>

            <div className="brand-features">
              <div className="feature-item">
                <div
                  className="feature-icon"
                  style={{ background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24" }}
                >
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <strong style={{ color: "#ffffff" }}>Warden Authorization</strong>
                  <p style={{ color: "#94a3b8" }}>
                    Staff accounts are strictly provisioned by hostel wardens for authorized personnel.
                  </p>
                </div>
              </div>

              <div className="feature-item">
                <div
                  className="feature-icon"
                  style={{ background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24" }}
                >
                  <Building2 size={18} />
                </div>
                <div>
                  <strong style={{ color: "#ffffff" }}>Hostel Multi-Tenancy</strong>
                  <p style={{ color: "#94a3b8" }}>
                    Securely connected to your specific hostel building and student complaints.
                  </p>
                </div>
              </div>

              <div className="feature-item">
                <div
                  className="feature-icon"
                  style={{ background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24" }}
                >
                  <KeyRound size={18} />
                </div>
                <div>
                  <strong style={{ color: "#ffffff" }}>One-Time Activation</strong>
                  <p style={{ color: "#94a3b8" }}>
                    Set your permanent password once to immediately activate your account.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <footer className="brand-footer">
            <p style={{ color: "#94a3b8" }}>HostelFix Multi-Tenant Campus Maintenance</p>
          </footer>
        </aside>

        {/* Right Side: Activation Form Card */}
        <main className="login-card">
          <div
            className="login-nav-row"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            {onNavigateHome ? (
              <button
                type="button"
                onClick={onNavigateHome}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "none",
                  border: "none",
                  color: "#64748b",
                  fontSize: "13px",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <Home size={16} />
                <span>Home</span>
              </button>
            ) : (
              <span />
            )}

            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              {onNavigateStaffLogin && (
                <button
                  type="button"
                  onClick={onNavigateStaffLogin}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#d97706",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Staff Login
                </button>
              )}
              {onNavigateMainLogin && (
                <button
                  type="button"
                  onClick={onNavigateMainLogin}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#4f46e5",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Main Login →
                </button>
              )}
            </div>
          </div>

          <div className="login-card-header">
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "20px",
                background: "#fef3c7",
                color: "#92400e",
                fontSize: "12px",
                fontWeight: 700,
                marginBottom: "10px",
              }}
            >
              <Wrench size={13} />
              <span>STAFF ACCOUNT ACTIVATION</span>
            </div>
            <h2>Activate Technician Account</h2>
            <p>
              Enter the activation code provided by your hostel warden to set up your password.
            </p>
          </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="auth-alert error" role="alert" style={{ marginBottom: "16px" }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>
                <span>{errorMessage}</span>
                {onNavigateStaffLogin && errorMessage.includes("already-used") && (
                  <div style={{ marginTop: "4px" }}>
                    <button
                      type="button"
                      onClick={onNavigateStaffLogin}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#b91c1c",
                        fontWeight: 700,
                        textDecoration: "underline",
                        cursor: "pointer",
                      }}
                    >
                      Sign in to your account here →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {successMessage && (
            <div className="auth-alert success" role="status" style={{ marginBottom: "16px" }}>
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <span>{successMessage}</span>
            </div>
          )}

          {/* STEP 1: Activation Token Input & Verification */}
          <div
            style={{
              padding: "16px",
              borderRadius: "12px",
              border: tokenVerified ? "1.5px solid #86efac" : "1px solid #e2e8f0",
              background: tokenVerified ? "#f0fdf4" : "#f8fafc",
              marginBottom: "20px",
              transition: "all 0.2s ease",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <label
                htmlFor="activation-token"
                style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}
              >
                1. Activation Code *
              </label>
              {tokenVerified && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    color: "#16a34a",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  <CheckCircle2 size={14} />
                  Code Verified
                </span>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <KeyRound
                  size={16}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "12px",
                    color: "#94a3b8",
                  }}
                />
                <input
                  id="activation-token"
                  type="text"
                  placeholder="e.g. STAFF-A1B2"
                  value={tokenInput}
                  onChange={(e) => {
                    setTokenInput(e.target.value.toUpperCase())
                    setTokenVerified(false)
                    setVerifiedStaff(null)
                    setErrorMessage(null)
                  }}
                  disabled={isVerifyingToken || isSubmitting}
                  style={{
                    width: "100%",
                    padding: "9px 12px 9px 36px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    fontWeight: 600,
                    letterSpacing: "1px",
                    background: "white",
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => handleVerifyToken()}
                disabled={isVerifyingToken || !tokenInput.trim() || isSubmitting}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: tokenVerified ? "#16a34a" : "#d97706",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: isVerifyingToken || !tokenInput.trim() ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                }}
              >
                {isVerifyingToken ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : tokenVerified ? (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Verified</span>
                  </>
                ) : (
                  <span>Verify Code</span>
                )}
              </button>
            </div>

            {/* Display Verified Staff Profile */}
            {tokenVerified && verifiedStaff && (
              <div
                style={{
                  marginTop: "14px",
                  padding: "12px",
                  background: "white",
                  border: "1px solid #bbf7d0",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div>
                    <span style={{ color: "#64748b", fontSize: "11px", display: "block" }}>
                      Technician Name:
                    </span>
                    <strong style={{ color: "#0f172a", display: "flex", alignItems: "center", gap: "4px" }}>
                      <User size={13} color="#4f46e5" />
                      {verifiedStaff.name}
                    </strong>
                  </div>

                  <div>
                    <span style={{ color: "#64748b", fontSize: "11px", display: "block" }}>
                      Authorized Email:
                    </span>
                    <span style={{ color: "#0f172a", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                      <Mail size={13} color="#4f46e5" />
                      {verifiedStaff.email}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: "#64748b", fontSize: "11px", display: "block" }}>
                      Hostel Assignment:
                    </span>
                    <span style={{ color: "#0f172a", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                      <Building2 size={13} color="#4f46e5" />
                      {verifiedStaff.hostelName || "Campus Hostel"}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: "#64748b", fontSize: "11px", display: "block" }}>
                      Specialization:
                    </span>
                    <span style={{ color: "#0f172a", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                      <Briefcase size={13} color="#4f46e5" />
                      {verifiedStaff.specialization || "General Maintenance"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: Set Password & Activate (Unlocked when token is verified) */}
          {tokenVerified && verifiedStaff ? (
            <div>
              {/* Optional Google Activation */}
              {isGoogleConfigured && (
                <div className="google-auth-wrapper" style={{ marginBottom: "16px" }}>
                  <div ref={googleBtnRef} style={{ minHeight: "44px" }} />
                  <div className="auth-divider">
                    <span>OR CREATE A PASSWORD</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleActivateAccount} className="manual-login-form">
                <div className="form-group">
                  <label htmlFor="staff-password">Set Your Password *</label>
                  <div className="input-with-icon">
                    <Lock size={18} className="input-icon" />
                    <input
                      id="staff-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Minimum 6 characters"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        setErrorMessage(null)
                      }}
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword((prev) => !prev)}
                      title={showPassword ? "Hide password" : "Show password"}
                      disabled={isSubmitting}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="staff-confirm-password">Confirm Password *</label>
                  <div className="input-with-icon">
                    <Lock size={18} className="input-icon" />
                    <input
                      id="staff-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value)
                        setErrorMessage(null)
                      }}
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      title={showConfirmPassword ? "Hide password" : "Show password"}
                      disabled={isSubmitting}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="login-button manual-submit"
                  disabled={isSubmitting}
                  style={{
                    background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                    boxShadow: "0 4px 14px rgba(22, 163, 74, 0.25)",
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Activating your technician account...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Activation & Enter Portal</span>
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div
              style={{
                padding: "20px",
                background: "#f8fafc",
                borderRadius: "12px",
                border: "1px dashed #cbd5e1",
                textAlign: "center",
                color: "#64748b",
                fontSize: "13px",
              }}
            >
              <KeyRound size={28} color="#94a3b8" style={{ margin: "0 auto 8px" }} />
              <p style={{ margin: 0, fontWeight: 500 }}>
                Please enter and verify your activation code above to set your password and access your work orders.
              </p>
            </div>
          )}

          {/* Help & Authorization Notice */}
          <div
            style={{
              marginTop: "24px",
              padding: "14px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "10px",
              fontSize: "12px",
              color: "#1e40af",
              lineHeight: 1.5,
            }}
          >
            ℹ️ <strong>Need an activation code?</strong> Maintenance Staff accounts cannot be created by public self-registration. If you are a campus technician or contractor, please request an invitation link or activation code from your <strong>Hostel Warden</strong>.
          </div>

          <div
            style={{
              marginTop: "20px",
              textAlign: "center",
              fontSize: "13px",
              color: "#64748b",
            }}
          >
            Already activated your account?{" "}
            {onNavigateStaffLogin && (
              <button
                type="button"
                onClick={onNavigateStaffLogin}
                style={{
                  background: "none",
                  border: "none",
                  color: "#d97706",
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: 0,
                  textDecoration: "underline",
                }}
              >
                Sign in to Staff Portal
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
