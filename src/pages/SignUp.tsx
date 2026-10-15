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
  Sparkles,
  KeyRound,
  ChevronRight,
} from "lucide-react"
import type { User, Organization } from "../types"
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
  // TAB 1: STUDENT STATE
  // ==========================================
  const [studentName, setStudentName] = useState("")
  const [studentEmail, setStudentEmail] = useState("")
  const [studentPassword, setStudentPassword] = useState("")
  const [showStudentPassword, setShowStudentPassword] = useState(false)
  const [studentRoom, setStudentRoom] = useState("")
  const [studentPhone, setStudentPhone] = useState("")

  // Student Affiliation Mode: "code" | "directory"
  const [affiliationMode, setAffiliationMode] = useState<"code" | "directory">("code")
  const [invitationCode, setInvitationCode] = useState("")
  const [isVerifyingCode, setIsVerifyingCode] = useState(false)
  const [verifiedOrg, setVerifiedOrg] = useState<{
    organization: Organization
    hostels: { id: string; name: string; code?: string }[]
  } | null>(null)
  const [selectedHostelId, setSelectedHostelId] = useState("")

  // Public tenants directory
  const [publicOrgs, setPublicOrgs] = useState<Organization[]>([])
  const [directoryOrgId, setDirectoryOrgId] = useState("")
  const [directoryHostelId, setDirectoryHostelId] = useState("")

  // ==========================================
  // TAB 2: ORGANIZATION ONBOARDING STATE
  // ==========================================
  const [orgName, setOrgName] = useState("")
  const [orgSlug, setOrgSlug] = useState("")
  const [orgBuildingName, setOrgBuildingName] = useState("")
  const [orgEmail, setOrgEmail] = useState("")
  const [orgPhone, setOrgPhone] = useState("")
  const [orgAddress, setOrgAddress] = useState("")
  const [orgCity, setOrgCity] = useState("")
  const [orgState, setOrgState] = useState("")
  const [adminName, setAdminName] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [showAdminPassword, setShowAdminPassword] = useState(false)

  // Google Sign-In for student
  const googleBtnRef = useRef<HTMLDivElement>(null)
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ""
  const isGoogleConfigured = Boolean(
    googleClientId && !googleClientId.includes("your-google-client-id")
  )

  // Load public organizations when directory mode is active
  useEffect(() => {
    if (affiliationMode === "directory" && publicOrgs.length === 0) {
      api.tenants
        .getPublicList()
        .then((res) => {
          setPublicOrgs(res.organizations || [])
          if (res.organizations && res.organizations.length > 0) {
            setDirectoryOrgId(res.organizations[0].id)
            if (res.organizations[0].hostels && res.organizations[0].hostels.length > 0) {
              setDirectoryHostelId(res.organizations[0].hostels[0].id)
            }
          }
        })
        .catch((err) => {
          console.warn("Failed to load organizations directory:", err.message)
        })
    }
  }, [affiliationMode, publicOrgs.length])

  // Auto-generate org slug from org name
  const handleOrgNameChange = (name: string) => {
    setOrgName(name)
    const generatedSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
    setOrgSlug(generatedSlug)
  }

  // Verify Invitation Code
  const handleVerifyCode = async () => {
    if (!invitationCode.trim()) {
      setErrorMessage("Please enter an invitation code to verify.")
      return
    }

    try {
      setIsVerifyingCode(true)
      setErrorMessage(null)
      const res = await api.tenants.verifyInvitationCode(invitationCode.trim().toUpperCase())
      setVerifiedOrg({ organization: res.organization, hostels: res.hostels })
      if (res.hostels && res.hostels.length > 0) {
        setSelectedHostelId(res.hostels[0].id)
      }
      setSuccessMessage(`✓ Code verified for ${res.organization.name}`)
    } catch (err: any) {
      setVerifiedOrg(null)
      setErrorMessage(err.message || "Invalid or inactive invitation code.")
    } finally {
      setIsVerifyingCode(false)
    }
  }

  // Google Sign-In setup
  useEffect(() => {
    if (!isGoogleConfigured || activeTab !== "student") return

    const handleGoogleCredentialResponse = async (response: any) => {
      try {
        setErrorMessage(null)
        setSuccessMessage("Verifying Google account...")
        const result = await api.auth.googleLogin(response.credential)

        // If user already had affiliation or if invitation code was supplied, affiliate them
        if (invitationCode.trim() && result.user.accountStatus === "pending_affiliation") {
          try {
            const affRes = await api.auth.affiliate({
              invitationCode: invitationCode.trim().toUpperCase(),
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
  }, [isGoogleConfigured, activeTab, invitationCode, studentRoom, onSignUpSuccess])

  // Submit Student Registration
  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!studentName.trim()) return setErrorMessage("Full name is required.")
    if (!studentEmail.trim()) return setErrorMessage("Email address is required.")
    if (!studentPassword || studentPassword.length < 6)
      return setErrorMessage("Password must be at least 6 characters.")
    if (!studentRoom.trim()) return setErrorMessage("Room number is required.")

    let chosenCode = invitationCode.trim().toUpperCase()
    let chosenOrgId: string | undefined = undefined
    let chosenHostelId: string | undefined = undefined
    let chosenHostelName: string | undefined = undefined

    if (affiliationMode === "code") {
      if (!chosenCode) {
        return setErrorMessage("Please enter your hostel invitation code.")
      }
      if (verifiedOrg && selectedHostelId) {
        chosenHostelId = selectedHostelId
        const matchHostel = verifiedOrg.hostels.find((h) => h.id === selectedHostelId)
        if (matchHostel) chosenHostelName = matchHostel.name
      }
    } else {
      if (!directoryOrgId) {
        return setErrorMessage("Please select your hostel organization.")
      }
      chosenOrgId = directoryOrgId
      chosenHostelId = directoryHostelId
      const org = publicOrgs.find((o) => o.id === directoryOrgId)
      if (org && directoryHostelId) {
        const h = org.hostels?.find((item) => item.id === directoryHostelId)
        if (h) chosenHostelName = h.name
      }
    }

    try {
      setIsLoading(true)
      const res = await api.auth.registerStudent({
        name: studentName.trim(),
        email: studentEmail.trim().toLowerCase(),
        password: studentPassword,
        invitationCode: chosenCode || undefined,
        organizationId: chosenOrgId,
        hostelId: chosenHostelId,
        hostelName: chosenHostelName,
        room: studentRoom.trim(),
        phone: studentPhone.trim() || undefined,
      })

      setSuccessMessage("Account created successfully! Redirecting to your dashboard...")
      setTimeout(() => {
        onSignUpSuccess(res.user)
      }, 700)
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create account. Please check your information.")
    } finally {
      setIsLoading(false)
    }
  }

  // Submit Organization Registration
  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!orgName.trim()) return setErrorMessage("Hostel Organization name is required.")
    if (!orgSlug.trim()) return setErrorMessage("Organization slug/subdomain is required.")
    if (!orgEmail.trim()) return setErrorMessage("Organization contact email is required.")
    if (!adminName.trim()) return setErrorMessage("Administrator full name is required.")
    if (!adminPassword || adminPassword.length < 6)
      return setErrorMessage("Administrator password must be at least 6 characters.")

    try {
      setIsLoading(true)
      const res = await api.auth.registerOrganization({
        name: orgName.trim(),
        slug: orgSlug.trim().toLowerCase(),
        contactEmail: orgEmail.trim().toLowerCase(),
        phone: orgPhone.trim() || undefined,
        address: orgAddress.trim() || undefined,
        city: orgCity.trim() || undefined,
        state: orgState.trim() || undefined,
        adminName: adminName.trim(),
        adminPassword: adminPassword,
      })

      setSuccessMessage(`✓ Organization registered! Invitation code: ${res.organization.invitationCode}`)
      setTimeout(() => {
        onSignUpSuccess(res.user)
      }, 1000)
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to register organization. Please check your fields.")
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

          {/* TAB 1: STUDENT FORM */}
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
                <div style={{ marginBottom: "20px" }}>
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

                {/* Affiliation Box */}
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "16px",
                    marginBottom: "24px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <label style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
                      <KeyRound size={15} color="#4f46e5" />
                      <span>Hostel Affiliation *</span>
                    </label>

                    <div style={{ display: "flex", gap: "12px", fontSize: "12px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="affMode"
                          checked={affiliationMode === "code"}
                          onChange={() => setAffiliationMode("code")}
                        />
                        <span>Invitation Code</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="affMode"
                          checked={affiliationMode === "directory"}
                          onChange={() => setAffiliationMode("directory")}
                        />
                        <span>Select from Directory</span>
                      </label>
                    </div>
                  </div>

                  {affiliationMode === "code" ? (
                    <div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input
                          type="text"
                          placeholder="e.g. HF-PREMIER2026 or DEMO2026"
                          value={invitationCode}
                          onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                          style={{
                            flex: 1,
                            padding: "10px 12px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            fontSize: "14px",
                            fontWeight: 600,
                            letterSpacing: "0.5px",
                            textTransform: "uppercase",
                            outline: "none",
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleVerifyCode}
                          disabled={isVerifyingCode || !invitationCode.trim()}
                          style={{
                            padding: "10px 16px",
                            borderRadius: "8px",
                            border: "none",
                            background: "#4f46e5",
                            color: "white",
                            fontWeight: 600,
                            fontSize: "13px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            opacity: isVerifyingCode || !invitationCode.trim() ? 0.6 : 1,
                          }}
                        >
                          {isVerifyingCode ? <Loader2 size={15} className="spin" /> : "Verify"}
                        </button>
                      </div>

                      {verifiedOrg && (
                        <div
                          style={{
                            marginTop: "12px",
                            padding: "10px 14px",
                            borderRadius: "8px",
                            background: "#f0fdf4",
                            border: "1px solid #bbf7d0",
                            fontSize: "13px",
                            color: "#166534",
                          }}
                        >
                          <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                            <CheckCircle2 size={16} />
                            <span>{verifiedOrg.organization.name}</span>
                          </div>
                          {verifiedOrg.hostels && verifiedOrg.hostels.length > 1 && (
                            <div style={{ marginTop: "8px" }}>
                              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                                Select Property / Block:
                              </label>
                              <select
                                value={selectedHostelId}
                                onChange={(e) => setSelectedHostelId(e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "6px 8px",
                                  borderRadius: "6px",
                                  border: "1px solid #cbd5e1",
                                  fontSize: "12px",
                                }}
                              >
                                {verifiedOrg.hostels.map((h) => (
                                  <option key={h.id} value={h.id}>
                                    {h.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                        Hostel Organization:
                      </label>
                      <select
                        value={directoryOrgId}
                        onChange={(e) => {
                          setDirectoryOrgId(e.target.value)
                          const found = publicOrgs.find((o) => o.id === e.target.value)
                          if (found && found.hostels && found.hostels.length > 0) {
                            setDirectoryHostelId(found.hostels[0].id)
                          }
                        }}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "14px",
                          marginBottom: "10px",
                          outline: "none",
                        }}
                      >
                        {publicOrgs.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))}
                      </select>

                      {directoryOrgId && (
                        <div>
                          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                            Hostel Block / Property:
                          </label>
                          <select
                            value={directoryHostelId}
                            onChange={(e) => setDirectoryHostelId(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "10px 12px",
                              borderRadius: "8px",
                              border: "1px solid #cbd5e1",
                              fontSize: "14px",
                              outline: "none",
                            }}
                          >
                            {(publicOrgs.find((o) => o.id === directoryOrgId)?.hostels || []).map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
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

          {/* TAB 2: ORGANIZATION ONBOARDING FORM */}
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
                <Sparkles size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <strong style={{ display: "block", marginBottom: "2px" }}>
                    Hostel Multi-Tenant Onboarding
                  </strong>
                  Provision a dedicated tenant workspace. You will instantly receive a custom student
                  invitation code and full administrative control.
                </div>
              </div>

              <form onSubmit={handleOrgSubmit}>
                {/* Section A: Org Info */}
                <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b", marginBottom: "14px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  1. Organization Details
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Hostel Organization Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Greenfield University Hostels"
                      value={orgName}
                      onChange={(e) => handleOrgNameChange(e.target.value)}
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
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Tenant Slug / Subdomain *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. greenfield-hostels"
                      value={orgSlug}
                      onChange={(e) => setOrgSlug(e.target.value)}
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
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Primary Building / Property Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Main Hostel Block"
                      value={orgBuildingName}
                      onChange={(e) => setOrgBuildingName(e.target.value)}
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
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Official Contact Email *
                    </label>
                    <input
                      type="email"
                      placeholder="admin@greenfieldhostels.com"
                      value={orgEmail}
                      onChange={(e) => setOrgEmail(e.target.value)}
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
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                    Campus / Street Address
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 100 University Boulevard, North Campus"
                    value={orgAddress}
                    onChange={(e) => setOrgAddress(e.target.value)}
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

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "24px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                      Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="+91 9876543210"
                      value={orgPhone}
                      onChange={(e) => setOrgPhone(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                      City
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Pune"
                      value={orgCity}
                      onChange={(e) => setOrgCity(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                      State
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Maharashtra"
                      value={orgState}
                      onChange={(e) => setOrgState(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                      }}
                    />
                  </div>
                </div>

                {/* Section B: Admin User Info */}
                <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b", marginBottom: "14px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  2. Master Administrator Account
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "28px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Admin Full Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Chief Warden / Administrator"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
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
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Admin Password *
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showAdminPassword ? "text" : "password"}
                        placeholder="Min. 6 characters"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
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
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
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
                        {showAdminPassword ? <EyeOff size={16} /> : <Eye size={16} />}
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
                      <span>Provisioning Organization...</span>
                    </>
                  ) : (
                    <>
                      <Building2 size={18} />
                      <span>Register Organization & Launch Portal</span>
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
