import { useState, useEffect, useRef } from "react"
import {
  Wrench,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Mail,
  Lock,
  CheckCircle2,
  ArrowRight,
  Home,
  KeyRound,
  ShieldAlert,
} from "lucide-react"
import type { User } from "../types"
import { api } from "../services/api"

interface StaffLoginProps {
  onLoginSuccess: (user: User) => void
  onNavigateHome?: () => void
  onNavigateStaffSignUp?: () => void
  onNavigateMainLogin?: () => void
}

export default function StaffLogin({
  onLoginSuccess,
  onNavigateHome,
  onNavigateStaffSignUp,
  onNavigateMainLogin,
}: StaffLoginProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const googleBtnRef = useRef<HTMLDivElement>(null)
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ""
  const isGoogleConfigured = Boolean(
    googleClientId && !googleClientId.includes("your-google-client-id")
  )

  // Initialize Google Sign-In for Staff
  useEffect(() => {
    if (!isGoogleConfigured) return

    const handleGoogleCredentialResponse = async (response: any) => {
      try {
        setErrorMessage(null)
        setSuccessMessage("Verifying technician credentials with Google...")
        setIsLoading(true)
        const result = await api.auth.staff.googleAuth(response.credential)
        setSuccessMessage(`Welcome back, ${result.user.name}! Redirecting to Staff Dashboard...`)
        setTimeout(() => {
          onLoginSuccess(result.user)
        }, 600)
      } catch (err: any) {
        setErrorMessage(err.message || "Google authentication failed. Please ensure your warden has invited your Google email.")
        setSuccessMessage(null)
      } finally {
        setIsLoading(false)
      }
    }

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
          width: 340,
          text: "continue_with",
          shape: "pill",
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

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    const cleanEmail = email.trim()
    if (!cleanEmail) {
      setErrorMessage("Please enter your staff email address or username.")
      return
    }
    if (!password) {
      setErrorMessage("Please enter your password.")
      return
    }

    setIsLoading(true)
    try {
      const res = await api.auth.manualLogin(cleanEmail, password)
      setSuccessMessage(`Welcome back, ${res.user.name}! Redirecting to Staff Dashboard...`)
      setTimeout(() => {
        onLoginSuccess(res.user)
      }, 500)
    } catch (err: any) {
      const msg = err.message || "Failed to authenticate"
      if (msg.includes("pending activation") || msg.includes("PENDING_ACTIVATION")) {
        setErrorMessage("Your staff account is pending activation. Please use your activation code to activate your account.")
      } else {
        setErrorMessage(msg)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Left Side: Brand Panel */}
        <aside className="login-brand" style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)" }}>
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
              <span className="brand-tagline">Maintenance & Operations Portal</span>
            </div>
          </div>

          <div className="brand-body">
            <h2 style={{ color: "#ffffff", fontSize: "28px", fontWeight: 800, lineHeight: 1.25, marginBottom: "16px" }}>
              Technician Field Operations
            </h2>
            <p style={{ color: "#cbd5e1", fontSize: "14px", lineHeight: 1.6, marginBottom: "32px" }}>
              Authorized maintenance portal for facility technicians. View assigned tickets, update room repair statuses, request materials, and upload completion proof.
            </p>

            <div className="brand-features">
              <div className="feature-item">
                <div className="feature-icon" style={{ background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24" }}>
                  <Wrench size={18} />
                </div>
                <div>
                  <strong style={{ color: "#ffffff" }}>Instant Job Dispatch</strong>
                  <p style={{ color: "#94a3b8" }}>Get real-time task notifications when the hostel warden assigns a ticket to you.</p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon" style={{ background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24" }}>
                  <KeyRound size={18} />
                </div>
                <div>
                  <strong style={{ color: "#ffffff" }}>Room Access & Details</strong>
                  <p style={{ color: "#94a3b8" }}>Inspect room numbers, student reported issues, and AI category diagnostics.</p>
                </div>
              </div>

              <div className="feature-item">
                <div className="feature-icon" style={{ background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24" }}>
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <strong style={{ color: "#ffffff" }}>Photo Proof Completion</strong>
                  <p style={{ color: "#94a3b8" }}>Upload mandatory photographic evidence to mark repairs verified and resolved.</p>
                </div>
              </div>
            </div>
          </div>

          <footer className="brand-footer">
            <p style={{ color: "#94a3b8" }}>HostelFix Multi-Tenant Campus Maintenance</p>
          </footer>
        </aside>

        {/* Right Side: Staff Login Card */}
        <main className="login-card">
          <div className="login-nav-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
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
            ) : <span />}

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
                Student / Warden Login →
              </button>
            )}
          </div>

          <div className="mobile-logo">
            <div className="brand-logo" style={{ margin: "0 auto 12px", background: "#f59e0b" }}>
              <Wrench size={28} color="#fff" />
            </div>
            <h1>HostelFix Staff</h1>
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
              <span>MAINTENANCE STAFF PORTAL</span>
            </div>
            <h2>Staff Sign In</h2>
            <p>
              Sign in with your technician account to manage repairs.
            </p>
          </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="auth-alert error" role="alert" style={{ marginBottom: "16px" }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>
                <span>{errorMessage}</span>
                {errorMessage.includes("pending activation") && onNavigateStaffSignUp && (
                  <div style={{ marginTop: "6px" }}>
                    <button
                      type="button"
                      onClick={onNavigateStaffSignUp}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#b91c1c",
                        fontWeight: 700,
                        textDecoration: "underline",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      Click here to activate your technician account →
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

          {/* Google Sign-In for Staff */}
          {isGoogleConfigured && (
            <div className="google-auth-wrapper">
              <div ref={googleBtnRef} style={{ minHeight: "44px" }} />
              <div className="auth-divider">
                <span>OR SIGN IN WITH EMAIL</span>
              </div>
            </div>
          )}

          {/* Manual Login Form */}
          <form onSubmit={handleStaffLogin} className="manual-login-form" noValidate>
            <div className="form-group">
              <label htmlFor="staff-email">Staff Email Address or Username</label>
              <div className="input-with-icon">
                <Mail size={18} className="input-icon" />
                <input
                  id="staff-email"
                  type="text"
                  placeholder="e.g. technician@hostel.com or username"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setErrorMessage(null)
                  }}
                  autoComplete="username"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="staff-password">Password</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input
                  id="staff-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your account password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setErrorMessage(null)
                  }}
                  autoComplete="current-password"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-button manual-submit"
              disabled={isLoading}
              style={{
                background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
                boxShadow: "0 4px 14px rgba(217, 119, 6, 0.25)",
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Verifying staff credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In as Technician</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          {/* Account Activation Callout */}
          <div
            style={{
              marginTop: "24px",
              padding: "16px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <KeyRound size={20} color="#d97706" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong style={{ display: "block", fontSize: "13px", color: "#1e293b", marginBottom: "4px" }}>
                  Have an invitation code from your Warden?
                </strong>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748b", lineHeight: 1.5 }}>
                  New maintenance staff accounts are provisioned exclusively by hostel administration.
                </p>
                {onNavigateStaffSignUp && (
                  <button
                    type="button"
                    onClick={onNavigateStaffSignUp}
                    style={{
                      marginTop: "10px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      background: "none",
                      border: "none",
                      color: "#b45309",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <span>Activate Technician Account</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Security Note */}
          <div
            style={{
              marginTop: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              color: "#94a3b8",
              justifyContent: "center",
            }}
          >
            <ShieldAlert size={14} />
            <span>Strict hostel-isolated technician portal</span>
          </div>
        </main>
      </div>
    </div>
  )
}
