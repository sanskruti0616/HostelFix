import { useState, useEffect, useRef } from "react"
import {
  Wrench,
  Building2,
  UserRound,
  Mail,
  Lock,
  Phone,
  Home,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  ChevronRight,
  RefreshCw,
  Building,
} from "lucide-react"
import type { User, Hostel } from "../types"
import { api } from "../services/api"

interface SignUpProps {
  initialTab?: "student" | "organization"
  onNavigateLogin: () => void
  onNavigateHome: () => void
  onSignUpSuccess: (user: User) => void
}

export default function SignUp({
  initialTab = "student",
  onNavigateLogin,
  onNavigateHome,
  onSignUpSuccess,
}: SignUpProps) {
  const [activeTab, setActiveTab] = useState<"student" | "organization">(initialTab)

  // Status feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // ==========================================
  // TAB 1: STUDENT REGISTRATION STATE
  // ==========================================
  const [studentName, setStudentName] = useState("")
  const [studentEmail, setStudentEmail] = useState("")
  const [studentPassword, setStudentPassword] = useState("")
  const [showStudentPassword, setShowStudentPassword] = useState(false)
  const [studentRoom, setStudentRoom] = useState("")
  const [studentPhone, setStudentPhone] = useState("")

  // Dynamic registered hostels list from database
  const [hostelsList, setHostelsList] = useState<Hostel[]>([])
  const [selectedHostelId, setSelectedHostelId] = useState("")
  const [isLoadingHostels, setIsLoadingHostels] = useState(false)

  // ==========================================
  // TAB 2: REGISTER HOSTEL STATE (WARDEN PROVISIONING)
  // ==========================================
  const [hostelName, setHostelName] = useState("")
  const [hostelCode, setHostelCode] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [hostelAddress, setHostelAddress] = useState("")
  const [hostelCity, setHostelCity] = useState("")
  const [hostelState, setHostelState] = useState("")
  const [wardenName, setWardenName] = useState("")
  const [wardenPassword, setWardenPassword] = useState("")
  const [showWardenPassword, setShowWardenPassword] = useState(false)

  // Google Sign-In for student
  const googleBtnRef = useRef<HTMLDivElement>(null)
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ""
  const isGoogleConfigured = Boolean(
    googleClientId && !googleClientId.includes("your-google-client-id")
  )

  // Load public registered hostels
  const fetchHostels = async () => {
    setIsLoadingHostels(true)
    try {
      const res = await api.hostels.getPublicList()
      const list = res.hostels || []
      setHostelsList(list)
    } catch (err: any) {
      console.warn("Failed to load active hostels list:", err.message)
    } finally {
      setIsLoadingHostels(false)
    }
  }

  useEffect(() => {
    fetchHostels()
  }, [])

  // Google Sign-In setup
  useEffect(() => {
    if (!isGoogleConfigured || activeTab !== "student") return

    const handleGoogleCredentialResponse = async (response: any) => {
      try {
        setErrorMessage(null)
        setSuccessMessage("Verifying Google account...")
        const result = await api.auth.googleLogin(response.credential)

        // If user already had affiliation or if hostel was selected, affiliate them
        if (selectedHostelId && result.user.accountStatus === "pending_affiliation") {
          try {
            const affRes = await api.auth.affiliate({
              hostelId: selectedHostelId,
              room: studentRoom || undefined,
            })
            onSignUpSuccess(affRes.user)
            return
          } catch (affErr: any) {
            console.warn("Affiliation warning:", affErr.message)
          }
        }

        onSignUpSuccess(result.user)
      } catch (err: any) {
        setErrorMessage(err.message || "Google sign-in failed. Please try manual sign-up.")
      }
    }

    const interval = setInterval(() => {
      const google = (window as any).google
      if (google && google.accounts && google.accounts.id && googleBtnRef.current) {
        clearInterval(interval)
        try {
          google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredentialResponse,
          })
          google.accounts.id.renderButton(googleBtnRef.current, {
            theme: "outline",
            size: "large",
            width: 340,
            text: "signup_with",
            shape: "rectangular",
          })
        } catch (e) {
          console.error("Error initializing Google Identity on SignUp:", e)
        }
      }
    }, 200)

    return () => clearInterval(interval)
  }, [isGoogleConfigured, activeTab, selectedHostelId, studentRoom, onSignUpSuccess])

  // Submit Student Registration
  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!studentName.trim()) return setErrorMessage("Full name is required.")
    if (!studentEmail.trim()) return setErrorMessage("Email address is required.")
    if (!studentPassword || studentPassword.length < 6)
      return setErrorMessage("Password must be at least 6 characters.")
    if (!selectedHostelId) {
      return setErrorMessage("Please choose your registered hostel from the dropdown.")
    }
    if (!studentRoom.trim()) return setErrorMessage("Room number is required.")

    try {
      setIsLoading(true)
      const res = await api.auth.registerStudent({
        name: studentName.trim(),
        email: studentEmail.trim().toLowerCase(),
        password: studentPassword,
        hostelId: selectedHostelId,
        room: studentRoom.trim(),
        phone: studentPhone.trim() || undefined,
      })

      const registeredHostelName = res.user.hostelName || res.user.hostel || "your hostel"
      setSuccessMessage(`Account created for ${registeredHostelName}! Redirecting to dashboard...`)
      setTimeout(() => {
        onSignUpSuccess(res.user)
      }, 700)
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create account. Please check your information.")
    } finally {
      setIsLoading(false)
    }
  }

  // Submit Hostel Registration (Automatically Provisions Warden Role)
  const handleHostelSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!hostelName.trim()) return setErrorMessage("Hostel name is required.")
    if (!contactEmail.trim()) return setErrorMessage("Official contact email is required.")
    if (!wardenName.trim()) return setErrorMessage("Warden full name is required.")
    if (!wardenPassword || wardenPassword.length < 6)
      return setErrorMessage("Warden password must be at least 6 characters.")

    try {
      setIsLoading(true)
      const res = await api.auth.registerHostel({
        hostelName: hostelName.trim(),
        code: hostelCode.trim() || undefined,
        contactEmail: contactEmail.trim().toLowerCase(),
        contactPhone: contactPhone.trim() || undefined,
        address: hostelAddress.trim() || undefined,
        city: hostelCity.trim() || undefined,
        state: hostelState.trim() || undefined,
        wardenName: wardenName.trim(),
        wardenPassword: wardenPassword,
      })

      setSuccessMessage(
        `✓ Hostel "${res.hostel.name}" registered successfully! Assigned Warden role. Redirecting to Warden Dashboard...`
      )
      // Refresh hostels so dropdown reflects new hostel immediately
      fetchHostels()
      setTimeout(() => {
        onSignUpSuccess(res.user)
      }, 900)
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to register hostel. Please check your fields.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at 10% 0%, rgba(79, 70, 229, 0.08), transparent 40%), #f8fafc",
        padding: "32px 16px 64px",
      }}
    >
      <div style={{ maxWidth: "700px", margin: "0 auto" }}>
        {/* Top Header Navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "28px",
          }}
        >
          <button
            onClick={onNavigateHome}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "none",
              border: "none",
              color: "#64748b",
              fontWeight: 600,
              fontSize: "14px",
              cursor: "pointer",
              padding: "6px 10px",
              borderRadius: "6px",
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = "#1e293b")}
            onMouseOut={(e) => (e.currentTarget.style.color = "#64748b")}
          >
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </button>

          <div style={{ fontSize: "14px", color: "#64748b" }}>
            Already have an account?{" "}
            <button
              onClick={onNavigateLogin}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "#4f46e5",
                fontWeight: 700,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Sign In
            </button>
          </div>
        </div>

        {/* Main Card */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "20px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
            overflow: "hidden",
          }}
        >
          {/* Card Top Branding Header */}
          <div
            style={{
              padding: "32px 32px 24px",
              borderBottom: "1px solid #f1f5f9",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                boxShadow: "0 6px 16px rgba(79, 70, 229, 0.3)",
                marginBottom: "12px",
              }}
            >
              <Wrench size={24} />
            </div>
            <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#1e1b4b", letterSpacing: "-0.5px" }}>
              Join Hostel<span style={{ color: "#4f46e5" }}>Fix</span>
            </h1>
            <p style={{ fontSize: "14px", color: "#64748b", marginTop: "4px" }}>
              Select your registration type below to get started
            </p>

            {/* TAB SELECTOR */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                background: "#f1f5f9",
                padding: "6px",
                borderRadius: "12px",
                marginTop: "20px",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveTab("student")
                  setErrorMessage(null)
                  setSuccessMessage(null)
                  fetchHostels()
                }}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: activeTab === "student" ? "#ffffff" : "transparent",
                  color: activeTab === "student" ? "#4f46e5" : "#64748b",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: activeTab === "student" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <UserRound size={17} />
                <span>Student / Resident</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("organization")
                  setErrorMessage(null)
                  setSuccessMessage(null)
                }}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: activeTab === "organization" ? "#ffffff" : "transparent",
                  color: activeTab === "organization" ? "#4f46e5" : "#64748b",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: activeTab === "organization" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <Building2 size={17} />
                <span>Register Hostel</span>
              </button>
            </div>
          </div>

          {/* Feedback Alerts */}
          <div style={{ padding: "0 32px" }}>
            {errorMessage && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  color: "#166534",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                <span>{successMessage}</span>
              </div>
            )}
          </div>

          {/* TAB 1: STUDENT REGISTRATION FORM */}
          {activeTab === "student" && (
            <div style={{ padding: "28px 32px 36px" }}>
              {/* Google Sign-in Option if configured */}
              {isGoogleConfigured && (
                <div style={{ marginBottom: "24px", textAlign: "center" }}>
                  <div
                    ref={googleBtnRef}
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      minHeight: "44px",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      margin: "20px 0 10px",
                      color: "#94a3b8",
                      fontSize: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
                    <span style={{ padding: "0 12px" }}>or sign up with email</span>
                    <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
                  </div>
                </div>
              )}

              <form onSubmit={handleStudentSubmit}>
                {/* Personal Info */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Full Name *
                    </label>
                    <div style={{ position: "relative" }}>
                      <UserRound size={17} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "12px" }} />
                      <input
                        type="text"
                        placeholder="e.g. Sanskruti Patil"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        required
                        style={{
                          width: "100%",
                          padding: "10px 12px 10px 38px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "14px",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Email Address *
                    </label>
                    <div style={{ position: "relative" }}>
                      <Mail size={17} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "12px" }} />
                      <input
                        type="email"
                        placeholder="name@university.edu"
                        value={studentEmail}
                        onChange={(e) => setStudentEmail(e.target.value)}
                        required
                        style={{
                          width: "100%",
                          padding: "10px 12px 10px 38px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "14px",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Password & Room */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Password *
                    </label>
                    <div style={{ position: "relative" }}>
                      <Lock size={17} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "12px" }} />
                      <input
                        type={showStudentPassword ? "text" : "password"}
                        placeholder="Min. 6 characters"
                        value={studentPassword}
                        onChange={(e) => setStudentPassword(e.target.value)}
                        required
                        style={{
                          width: "100%",
                          padding: "10px 38px 10px 38px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "14px",
                          outline: "none",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowStudentPassword(!showStudentPassword)}
                        style={{
                          position: "absolute",
                          right: "10px",
                          top: "10px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#94a3b8",
                        }}
                      >
                        {showStudentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Room Number *
                    </label>
                    <div style={{ position: "relative" }}>
                      <Home size={17} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "12px" }} />
                      <input
                        type="text"
                        placeholder="e.g. B-204"
                        value={studentRoom}
                        onChange={(e) => setStudentRoom(e.target.value)}
                        required
                        style={{
                          width: "100%",
                          padding: "10px 12px 10px 38px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "14px",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Optional Phone */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                    Phone Number (Optional)
                  </label>
                  <div style={{ position: "relative" }}>
                    <Phone size={17} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "12px" }} />
                    <input
                      type="tel"
                      placeholder="e.g. +91 9876543210"
                      value={studentPhone}
                      onChange={(e) => setStudentPhone(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px 10px 38px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                {/* DYNAMIC REGISTERED HOSTEL DROPDOWN */}
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "18px",
                    marginBottom: "24px",
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
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#1e293b",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Building2 size={16} color="#4f46e5" />
                      <span>Select Your Hostel *</span>
                    </label>

                    <button
                      type="button"
                      onClick={fetchHostels}
                      disabled={isLoadingHostels}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#4f46e5",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}
                      title="Reload registered hostels"
                    >
                      <RefreshCw size={12} className={isLoadingHostels ? "spin" : ""} />
                      <span>Refresh list</span>
                    </button>
                  </div>

                  <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "10px" }}>
                    Choose the hostel where you currently reside. Complaints will be isolated to this property.
                  </p>

                  <div style={{ position: "relative" }}>
                    <Building
                      size={17}
                      color="#94a3b8"
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "12px",
                        pointerEvents: "none",
                      }}
                    />
                    <select
                      value={selectedHostelId}
                      onChange={(e) => setSelectedHostelId(e.target.value)}
                      required
                      disabled={isLoading || isLoadingHostels || hostelsList.length === 0}
                      style={{
                        width: "100%",
                        padding: "11px 12px 11px 38px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        fontWeight: selectedHostelId ? 600 : 400,
                        color: selectedHostelId ? "#1e293b" : "#64748b",
                        outline: "none",
                        backgroundColor: hostelsList.length === 0 ? "#f1f5f9" : "#ffffff",
                        cursor: hostelsList.length === 0 ? "not-allowed" : "pointer",
                      }}
                    >
                      <option value="" disabled>
                        Choose your registered hostel
                      </option>
                      {hostelsList.map((h) => (
                        <option key={h.id} value={h.id} style={{ color: "#1e293b" }}>
                          {h.name} {h.code ? `(${h.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {isLoadingHostels && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        color: "#64748b",
                        marginTop: "8px",
                      }}
                    >
                      <Loader2 size={13} className="spin" />
                      <span>Loading registered hostels from database...</span>
                    </div>
                  )}

                  {!isLoadingHostels && hostelsList.length === 0 && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#991b1b",
                        marginTop: "10px",
                        background: "#fef2f2",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #fee2e2",
                      }}
                    >
                      No registered hostels found. Please contact your hostel warden or register a new hostel in the "Register Hostel" tab.
                    </div>
                  )}
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isLoading || !selectedHostelId || hostelsList.length === 0}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "10px",
                    border: "none",
                    background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                    color: "white",
                    fontWeight: 700,
                    fontSize: "15px",
                    cursor:
                      isLoading || !selectedHostelId || hostelsList.length === 0
                        ? "not-allowed"
                        : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 4px 14px rgba(79, 70, 229, 0.3)",
                    opacity: isLoading || !selectedHostelId || hostelsList.length === 0 ? 0.6 : 1,
                  }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Student Registration</span>
                      <ChevronRight size={18} />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: REGISTER HOSTEL FORM (WARDEN AUTOMATIC ASSIGNMENT) */}
          {activeTab === "organization" && (
            <div style={{ padding: "28px 32px 36px" }}>
              <div
                style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "10px",
                  padding: "14px 16px",
                  marginBottom: "24px",
                  fontSize: "13px",
                  color: "#1e40af",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                }}
              >
                <Building2 size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <strong style={{ display: "block", marginBottom: "2px" }}>
                    Hostel Registration & Warden Provisioning
                  </strong>
                  Register your hostel property on HostelFix. You will be automatically provisioned as the Warden with administrative access to manage complaints and staff for your hostel.
                </div>
              </div>

              <form onSubmit={handleHostelSubmit}>
                {/* Section A: Hostel Info */}
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#1e293b",
                    marginBottom: "14px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  1. Hostel Property Details
                </h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: "6px",
                      }}
                    >
                      Hostel Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Muktai Girls Hostel"
                      value={hostelName}
                      onChange={(e) => setHostelName(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: "6px",
                      }}
                    >
                      Hostel Code (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. MGH-01"
                      value={hostelCode}
                      onChange={(e) => setHostelCode(e.target.value.toUpperCase())}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: "6px",
                      }}
                    >
                      Official Contact Email *
                    </label>
                    <input
                      type="email"
                      placeholder="warden@hostel.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: "6px",
                      }}
                    >
                      Contact Phone (Optional)
                    </label>
                    <input
                      type="tel"
                      placeholder="+91 9876543210"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: "6px",
                    }}
                  >
                    Campus / Street Address (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Near North Gate, University Campus"
                    value={hostelAddress}
                    onChange={(e) => setHostelAddress(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      outline: "none",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                    marginBottom: "24px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: "6px",
                      }}
                    >
                      City (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Pune"
                      value={hostelCity}
                      onChange={(e) => setHostelCity(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: "6px",
                      }}
                    >
                      State (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Maharashtra"
                      value={hostelState}
                      onChange={(e) => setHostelState(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                {/* Section B: Warden Account */}
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#1e293b",
                    marginBottom: "14px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  2. Warden Account Credentials
                </h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                    marginBottom: "28px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: "6px",
                      }}
                    >
                      Warden Full Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. Rajesh Sharma"
                      value={wardenName}
                      onChange={(e) => setWardenName(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: "6px",
                      }}
                    >
                      Warden Password *
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showWardenPassword ? "text" : "password"}
                        placeholder="Min. 6 characters"
                        value={wardenPassword}
                        onChange={(e) => setWardenPassword(e.target.value)}
                        required
                        style={{
                          width: "100%",
                          padding: "10px 38px 10px 12px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "14px",
                          outline: "none",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowWardenPassword(!showWardenPassword)}
                        style={{
                          position: "absolute",
                          right: "10px",
                          top: "10px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#94a3b8",
                        }}
                      >
                        {showWardenPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "10px",
                    border: "none",
                    background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                    color: "white",
                    fontWeight: 700,
                    fontSize: "15px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 4px 14px rgba(79, 70, 229, 0.3)",
                    opacity: isLoading ? 0.7 : 1,
                  }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="spin" />
                      <span>Registering Hostel...</span>
                    </>
                  ) : (
                    <>
                      <Building2 size={18} />
                      <span>Register Hostel & Open Warden Dashboard</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
