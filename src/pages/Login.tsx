import { useState, useEffect, useRef } from "react"
import {
  Home,
  ShieldCheck,
  Wrench,
  UserRound,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Mail,
  Lock,
  CheckCircle2,
  Sparkles,
  Camera,
  Star,
  Clock,
  ArrowRight,
} from "lucide-react"
import type { User, UserRole } from "../types"
import { api } from "../services/api"

interface LoginProps {
  onLoginSuccess: (user: User) => void
  onNavigateHome?: () => void
  onNavigateSignUp?: () => void
}

interface DemoRoleCard {
  role: UserRole
  title: string
  description: string
  icon: typeof UserRound
  demoBadge: string
}

const DEMO_ROLES: DemoRoleCard[] = [
  {
    role: "student",
    title: "Student",
    description: "Raise complaints and track maintenance progress.",
    icon: UserRound,
    demoBadge: "Student Portal",
  },
  {
    role: "warden",
    title: "Warden",
    description: "Review complaints, verify issues, and assign staff.",
    icon: ShieldCheck,
    demoBadge: "Warden Office",
  },
  {
    role: "staff",
    title: "Maintenance Staff",
    description: "Manage assigned work and submit resolution evidence.",
    icon: Wrench,
    demoBadge: "Technician Field",
  },
  {
    role: "admin",
    title: "Administrator",
    description: "Manage authorized administrative operations.",
    icon: ShieldCheck,
    demoBadge: "System Admin",
  },
]

export default function Login({
  onLoginSuccess,
  onNavigateHome,
  onNavigateSignUp,
}: LoginProps) {
  // Manual credentials form state
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isManualLoading, setIsManualLoading] = useState(false)

  // Demo account selection state
  const [selectedDemoRole, setSelectedDemoRole] = useState<UserRole>("student")
  const [isDemoLoading, setIsDemoLoading] = useState(false)

  // Status feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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
        setErrorMessage(null)
        setSuccessMessage("Verifying Google account...")
        const result = await api.auth.googleLogin(response.credential)
        setSuccessMessage("Authentication successful! Welcome to HostelFix.")
        onLoginSuccess(result.user)
      } catch (err: any) {
        setErrorMessage(err.message || "Google authentication failed. Please try again.")
        setSuccessMessage(null)
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

  // Handle manual username/email + password sign-in
  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!identifier.trim()) {
      setErrorMessage("Please enter your email address or username.")
      return
    }
    if (!password) {
      setErrorMessage("Please enter your password.")
      return
    }

    setIsManualLoading(true)
    try {
      const result = await api.auth.manualLogin(identifier.trim(), password)
      setSuccessMessage("Sign in successful!")
      onLoginSuccess(result.user)
    } catch (err: any) {
      setErrorMessage(
        err.message || "Invalid credentials. Please verify your email/username and password."
      )
    } finally {
      setIsManualLoading(false)
    }
  }

  // Handle demo role sign-in
  const handleDemoSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsDemoLoading(true)

    try {
      const result = await api.auth.demoLogin(selectedDemoRole)
      setSuccessMessage(`Signed in as demo ${selectedDemoRole}!`)
      onLoginSuccess(result.user)
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          `Demo account for ${selectedDemoRole} could not be authenticated. Ensure backend database is seeded.`
      )
    } finally {
      setIsDemoLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        {/* ========================================================= */}
        {/* LEFT SECTION: BRANDING & FEATURE HIGHLIGHTS               */}
        {/* ========================================================= */}
        <section className="login-brand" aria-label="HostelFix Overview">
          <div className="brand-logo" aria-hidden="true">
            <Home size={34} />
          </div>

          <h1>HostelFix</h1>
          <p className="brand-tagline">
            Smart Hostel Complaint &amp; Maintenance Management System
          </p>

          <div className="brand-features" role="list">
            <div className="brand-feature-item" role="listitem">
              <span className="brand-feature-icon" aria-hidden="true">
                <Clock size={16} />
              </span>
              <div>
                <strong>Real-time complaint tracking</strong>
                <p>Instant live notifications and state timeline from submission to closure.</p>
              </div>
            </div>

            <div className="brand-feature-item" role="listitem">
              <span className="brand-feature-icon" aria-hidden="true">
                <Sparkles size={16} />
              </span>
              <div>
                <strong>AI-assisted complaint verification</strong>
                <p>Gemini Vision AI checks image evidence consistency and flags duplicates.</p>
              </div>
            </div>

            <div className="brand-feature-item" role="listitem">
              <span className="brand-feature-icon" aria-hidden="true">
                <Camera size={16} />
              </span>
              <div>
                <strong>Image-based issue reporting</strong>
                <p>Direct camera capture and file uploads stored securely on Cloudinary.</p>
              </div>
            </div>

            <div className="brand-feature-item" role="listitem">
              <span className="brand-feature-icon" aria-hidden="true">
                <Wrench size={16} />
              </span>
              <div>
                <strong>Maintenance assignment &amp; resolution tracking</strong>
                <p>Scoped role workflows for Wardens and specialized Maintenance Technicians.</p>
              </div>
            </div>

            <div className="brand-feature-item" role="listitem">
              <span className="brand-feature-icon" aria-hidden="true">
                <Star size={16} />
              </span>
              <div>
                <strong>Student feedback &amp; staff ratings</strong>
                <p>Verified 5-star service rating and performance tracking upon resolution.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* RIGHT SECTION: AUTHENTICATION FORM                        */}
        {/* ========================================================= */}
        <main className="login-card" aria-label="Sign In">
          {/* Top navigation actions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
              fontSize: "13px",
            }}
          >
            {onNavigateHome ? (
              <button
                type="button"
                onClick={onNavigateHome}
                style={{
                  background: "none",
                  border: "none",
                  color: "#64748b",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: 0,
                }}
              >
                <span>← Home</span>
              </button>
            ) : (
              <span />
            )}

            {onNavigateSignUp && (
              <button
                type="button"
                onClick={onNavigateSignUp}
                style={{
                  background: "none",
                  border: "none",
                  color: "#4f46e5",
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Create Account →
              </button>
            )}
          </div>

          <div className="mobile-logo">
            <div className="brand-logo" style={{ margin: "0 auto 12px" }}>
              <Home size={28} />
            </div>
            <h1>HostelFix</h1>
          </div>

          <div className="login-card-header">
            <h2>Welcome to HostelFix</h2>
            <p>
              Sign in to manage and track hostel services.{" "}
              {onNavigateSignUp && (
                <span style={{ display: "block", marginTop: "4px" }}>
                  New here?{" "}
                  <button
                    type="button"
                    onClick={onNavigateSignUp}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#4f46e5",
                      fontWeight: 700,
                      cursor: "pointer",
                      padding: 0,
                      textDecoration: "underline",
                    }}
                  >
                    Register your account
                  </button>
                </span>
              )}
            </p>
          </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="auth-alert error" role="alert">
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="auth-alert success" role="status">
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. Continue with Google */}
          {isGoogleConfigured && (
            <div className="google-auth-wrapper">
              <div ref={googleBtnRef} style={{ minHeight: "44px" }} />
              <div className="auth-divider">
                <span>OR</span>
              </div>
            </div>
          )}

          {/* 2. Manual Email / Username and Password Login */}
          <form onSubmit={handleManualLogin} className="manual-login-form" noValidate>
            <div className="form-group">
              <label htmlFor="identifier">Email Address or Username</label>
              <div className="input-with-icon">
                <Mail size={18} className="input-icon" />
                <input
                  id="identifier"
                  type="text"
                  placeholder="name@hostelfix.com or username"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value)
                    setErrorMessage(null)
                  }}
                  autoComplete="username"
                  disabled={isManualLoading || isDemoLoading}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your account password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setErrorMessage(null)
                  }}
                  autoComplete="current-password"
                  disabled={isManualLoading || isDemoLoading}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={isManualLoading || isDemoLoading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-button manual-submit"
              disabled={isManualLoading || isDemoLoading}
            >
              {isManualLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="auth-divider">
            <span>OR SIGN IN WITH DEMO ACCOUNT</span>
          </div>

          {/* 3. Demo Role Selection Section */}
          <form onSubmit={handleDemoSignIn} className="demo-login-form">
            <div className="demo-roles-grid" role="radiogroup" aria-label="Select demo role">
              {DEMO_ROLES.map((demo) => {
                const IconComponent = demo.icon
                const isSelected = selectedDemoRole === demo.role
                return (
                  <div
                    key={demo.role}
                    className={`demo-role-card ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedDemoRole(demo.role)
                      setErrorMessage(null)
                    }}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setSelectedDemoRole(demo.role)
                        setErrorMessage(null)
                      }
                    }}
                  >
                    <div className="demo-role-header">
                      <div className="demo-role-icon">
                        <IconComponent size={18} />
                      </div>
                      <span className="demo-role-badge">{demo.demoBadge}</span>
                    </div>
                    <strong className="demo-role-name">{demo.title}</strong>
                    <p className="demo-role-desc">{demo.description}</p>
                  </div>
                )
              })}
            </div>

            <button
              type="submit"
              className="demo-submit-btn"
              disabled={isManualLoading || isDemoLoading}
            >
              {isDemoLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Authenticating demo {selectedDemoRole}...</span>
                </>
              ) : (
                <>
                  <span>Sign In with Demo Account ({selectedDemoRole.toUpperCase()})</span>
                </>
              )}
            </button>
          </form>

          {/* Setup / info note */}
          <p className="demo-info-note">
            Predefined demo credentials: username <code>student</code>, <code>warden</code>, <code>staff</code>, or <code>admin</code> with password <code>HostelFix@2026</code>. Database records are persisted in MongoDB Atlas.
          </p>
        </main>
      </div>
    </div>
  )
}