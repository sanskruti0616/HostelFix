import { useState, useEffect } from "react"
import {
  Wrench,
  Building2,
  KeyRound,
  Home,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  ChevronRight,
  Clock,
  RefreshCw,
} from "lucide-react"
import type { User, Organization } from "../types"
import { api } from "../services/api"

interface AffiliationOnboardingProps {
  currentUser: User
  onAffiliationComplete: (updatedUser: User) => void
  onLogout: () => void
}

export default function AffiliationOnboarding({
  currentUser,
  onAffiliationComplete,
  onLogout,
}: AffiliationOnboardingProps) {
  // Affiliation mode: 'invitation' | 'directory'
  const [affiliationMode, setAffiliationMode] = useState<"invitation" | "directory">("invitation")
  const [invitationCode, setInvitationCode] = useState("")
  const [roomNumber, setRoomNumber] = useState(currentUser.room || currentUser.roomNumber || "")
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Verified org state for Invitation Mode
  const [verifiedOrg, setVerifiedOrg] = useState<{
    organization: Organization
    hostels: { id: string; name: string; code?: string }[]
  } | null>(null)
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null)
  const [selectedHostelId, setSelectedHostelId] = useState("")

  // Directory state for Directory Mode
  const [publicOrgs, setPublicOrgs] = useState<Organization[]>([])
  const [directoryOrgId, setDirectoryOrgId] = useState("")
  const [directoryHostelId, setDirectoryHostelId] = useState("")
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false)

  // Fetch directory if directory mode is selected
  useEffect(() => {
    let isMounted = true
    if (affiliationMode === "directory" && publicOrgs.length === 0) {
      setIsLoadingDirectory(true)
      api.tenants
        .getPublicList()
        .then((res) => {
          if (!isMounted) return
          const orgs = res.organizations || []
          setPublicOrgs(orgs)
          // Do NOT auto-select so user must actively pick, enabling validation check
        })
        .catch((err) => {
          if (!isMounted) return
          console.warn("Failed to load organizations:", err.message)
        })
        .finally(() => {
          if (isMounted) setIsLoadingDirectory(false)
        })
    }
    return () => {
      isMounted = false
    }
  }, [affiliationMode, publicOrgs.length])

  // Handle switching between tabs
  const handleSwitchMode = (mode: "invitation" | "directory") => {
    if (mode === affiliationMode) return
    setAffiliationMode(mode)

    // Clear mode-specific validation errors
    if (mode === "directory") {
      // Clear invitation-code errors immediately when switching to Directory
      if (
        errorMessage &&
        (errorMessage.toLowerCase().includes("invitation") ||
          errorMessage.toLowerCase().includes("code"))
      ) {
        setErrorMessage(null)
      }
    } else {
      // Clear directory-specific errors when switching to Invitation
      if (
        errorMessage &&
        (errorMessage.toLowerCase().includes("hostel") ||
          errorMessage.toLowerCase().includes("organization") ||
          errorMessage.toLowerCase().includes("building") ||
          errorMessage.toLowerCase().includes("block"))
      ) {
        setErrorMessage(null)
      }
    }
    setSuccessMessage(null)
  }

  // Handle Invitation Code Verification
  const handleVerifyCode = async () => {
    setSuccessMessage(null)
    const cleanCode = invitationCode.trim().toUpperCase()

    if (!cleanCode) {
      setErrorMessage("Invitation code is required")
      return
    }

    try {
      setIsVerifying(true)
      setErrorMessage(null)
      const res = await api.tenants.verifyInvitationCode(cleanCode)

      if (res.valid === false) {
        setVerifiedOrg(null)
        setVerifiedCode(null)
        setErrorMessage(res.message || "Invalid or inactive invitation code.")
        return
      }

      setVerifiedOrg({ organization: res.organization, hostels: res.hostels || [] })
      setVerifiedCode(cleanCode)
      if (res.hostels && res.hostels.length > 0) {
        setSelectedHostelId(res.hostels[0].id)
      }
      setSuccessMessage(`✓ Verified: ${res.organization.name}`)
    } catch (err: any) {
      setVerifiedOrg(null)
      setVerifiedCode(null)
      setErrorMessage(err.message || "Invalid or inactive invitation code.")
    } finally {
      setIsVerifying(false)
    }
  }

  // Handle Submit Affiliation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (affiliationMode === "invitation") {
      // 1. Validate invitation code exists
      const cleanCode = invitationCode.trim().toUpperCase()
      if (!cleanCode) {
        setErrorMessage("Invitation code is required")
        return
      }

      // 2. Require successful code verification
      if (!verifiedOrg || verifiedCode !== cleanCode) {
        setErrorMessage("Please verify your invitation code before completing affiliation.")
        return
      }

      // 3. Validate room number
      if (!roomNumber.trim()) {
        setErrorMessage("Please enter your room number.")
        return
      }

      let chosenHostelId = selectedHostelId
      let chosenHostelName = ""
      if (verifiedOrg && verifiedOrg.hostels) {
        const match = verifiedOrg.hostels.find((h) => h.id === selectedHostelId)
        if (match) chosenHostelName = match.name
      }

      try {
        setIsSubmitting(true)
        const res = await api.auth.affiliate({
          invitationCode: cleanCode,
          organizationId: verifiedOrg.organization.id,
          hostelId: chosenHostelId || undefined,
          hostelName: chosenHostelName || undefined,
          room: roomNumber.trim(),
          mode: "invitation",
        })

        if (res.user.accountStatus === "pending_approval") {
          setSuccessMessage("Affiliation request submitted! Awaiting warden approval.")
        } else {
          setSuccessMessage("Affiliation successful! Loading your dashboard...")
        }
        setTimeout(() => {
          onAffiliationComplete(res.user)
        }, 800)
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to link account to hostel.")
      } finally {
        setIsSubmitting(false)
      }
    } else {
      // DIRECTORY MODE
      // 1. Validate selected hostel
      if (!directoryOrgId) {
        setErrorMessage("Please select your registered hostel.")
        return
      }

      const selectedOrg = publicOrgs.find((o) => o.id === directoryOrgId)
      const hostels = selectedOrg?.hostels || []

      // 2. Validate building/block if org has multiple hostels
      if (hostels.length > 1 && !directoryHostelId) {
        setErrorMessage("Please select your building / block.")
        return
      }

      // 3. Validate room number
      if (!roomNumber.trim()) {
        setErrorMessage("Please enter your room number.")
        return
      }

      const chosenHostelId = directoryHostelId || (hostels[0] ? hostels[0].id : undefined)
      let chosenHostelName = ""
      if (selectedOrg && chosenHostelId) {
        const match = selectedOrg.hostels?.find((h) => h.id === chosenHostelId)
        if (match) chosenHostelName = match.name
      }

      try {
        setIsSubmitting(true)
        const res = await api.auth.affiliate({
          organizationId: directoryOrgId,
          hostelId: chosenHostelId,
          hostelName: chosenHostelName || undefined,
          room: roomNumber.trim(),
          mode: "directory",
        })

        if (res.user.accountStatus === "pending_approval") {
          setSuccessMessage("Affiliation request submitted! Awaiting warden approval.")
        } else {
          setSuccessMessage("Affiliation successful! Loading your dashboard...")
        }
        setTimeout(() => {
          onAffiliationComplete(res.user)
        }, 800)
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to link account to hostel.")
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  // Handle checking status if pending approval
  const handleCheckApprovalStatus = async () => {
    try {
      setIsCheckingStatus(true)
      setErrorMessage(null)
      const res = await api.auth.getMe()
      if (res.user.accountStatus === "active") {
        setSuccessMessage("Your affiliation has been approved! Redirecting...")
        setTimeout(() => {
          onAffiliationComplete(res.user)
        }, 800)
      } else {
        setSuccessMessage("Your affiliation request is still awaiting warden approval.")
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Could not check approval status.")
    } finally {
      setIsCheckingStatus(false)
    }
  }

  const isPendingApproval = currentUser.accountStatus === "pending_approval"

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at 10% 0%, rgba(79, 70, 229, 0.08), transparent 40%), #f8fafc",
        padding: "40px 16px",
      }}
    >
      <div style={{ maxWidth: "560px", margin: "0 auto" }}>
        {/* Top Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
              }}
            >
              <Wrench size={18} />
            </div>
            <span style={{ fontSize: "18px", fontWeight: 800, color: "#1e1b4b" }}>
              Hostel<span style={{ color: "#4f46e5" }}>Fix</span>
            </span>
          </div>

          <button
            onClick={onLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              padding: "6px 12px",
              borderRadius: "8px",
              color: "#64748b",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Card */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "20px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
            padding: "36px",
          }}
        >
          {isPendingApproval ? (
            /* Pending Approval View */
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "18px",
                  background: "#fef3c7",
                  color: "#d97706",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "16px",
                }}
              >
                <Clock size={28} />
              </div>

              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", marginBottom: "8px" }}>
                Affiliation Pending Approval
              </h2>
              <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "20px", lineHeight: "1.6" }}>
                Your request to affiliate with{" "}
                <strong>{currentUser.organizationName || currentUser.hostelName || "your hostel"}</strong>{" "}
                has been submitted. Access to maintenance requests will be granted once your hostel warden
                approves your enrollment.
              </p>

              {currentUser.roomNumber && (
                <div
                  style={{
                    background: "#f8fafc",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    padding: "12px 16px",
                    display: "inline-block",
                    marginBottom: "24px",
                    fontSize: "13px",
                    color: "#334155",
                  }}
                >
                  Registered Room: <strong>{currentUser.roomNumber}</strong>
                </div>
              )}

              {/* Status alerts */}
              {errorMessage && (
                <div
                  style={{
                    marginBottom: "20px",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#991b1b",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    textAlign: "left",
                  }}
                >
                  <AlertCircle size={17} style={{ flexShrink: 0 }} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div
                  style={{
                    marginBottom: "20px",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    color: "#166534",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    textAlign: "left",
                  }}
                >
                  <CheckCircle2 size={17} style={{ flexShrink: 0 }} />
                  <span>{successMessage}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleCheckApprovalStatus}
                disabled={isCheckingStatus}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "none",
                  background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                  color: "white",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  opacity: isCheckingStatus ? 0.7 : 1,
                }}
              >
                <RefreshCw size={16} className={isCheckingStatus ? "spin" : ""} />
                <span>{isCheckingStatus ? "Checking status..." : "Refresh Status"}</span>
              </button>
            </div>
          ) : (
            /* Affiliation Setup Form */
            <>
              <div style={{ textAlign: "center", marginBottom: "24px" }}>
                <div
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "16px",
                    background: "#eef2ff",
                    color: "#4f46e5",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "12px",
                  }}
                >
                  <Building2 size={26} />
                </div>
                <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", marginBottom: "6px" }}>
                  Connect to Your Hostel
                </h2>
                <p style={{ fontSize: "14px", color: "#64748b" }}>
                  Welcome, <strong>{currentUser.name}</strong>! Please affiliate with your hostel campus to
                  raise and track maintenance requests.
                </p>
              </div>

              {/* Feedback */}
              {errorMessage && (
                <div
                  style={{
                    marginBottom: "20px",
                    padding: "12px 14px",
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
                  <AlertCircle size={17} style={{ flexShrink: 0 }} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div
                  style={{
                    marginBottom: "20px",
                    padding: "12px 14px",
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
                  <CheckCircle2 size={17} style={{ flexShrink: 0 }} />
                  <span>{successMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {/* Mode Selector */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    background: "#f1f5f9",
                    padding: "4px",
                    borderRadius: "10px",
                    marginBottom: "20px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleSwitchMode("invitation")}
                    style={{
                      padding: "8px",
                      borderRadius: "8px",
                      border: "none",
                      background: affiliationMode === "invitation" ? "#ffffff" : "transparent",
                      color: affiliationMode === "invitation" ? "#4f46e5" : "#64748b",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      boxShadow: affiliationMode === "invitation" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
                    }}
                  >
                    <KeyRound size={15} />
                    <span>Invitation Code</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSwitchMode("directory")}
                    style={{
                      padding: "8px",
                      borderRadius: "8px",
                      border: "none",
                      background: affiliationMode === "directory" ? "#ffffff" : "transparent",
                      color: affiliationMode === "directory" ? "#4f46e5" : "#64748b",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      boxShadow: affiliationMode === "directory" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
                    }}
                  >
                    <Building2 size={15} />
                    <span>Hostel Directory</span>
                  </button>
                </div>

                {affiliationMode === "invitation" ? (
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Hostel Invitation Code *
                    </label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        placeholder="e.g. HF-PREMIER2026 or DEMO2026"
                        value={invitationCode}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase()
                          setInvitationCode(val)
                          if (
                            errorMessage &&
                            (errorMessage.toLowerCase().includes("invitation") ||
                              errorMessage.toLowerCase().includes("code"))
                          ) {
                            setErrorMessage(null)
                          }
                          if (verifiedCode && val !== verifiedCode) {
                            setVerifiedOrg(null)
                            setVerifiedCode(null)
                          }
                        }}
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
                        disabled={isVerifying || !invitationCode.trim()}
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
                          opacity: isVerifying || !invitationCode.trim() ? 0.6 : 1,
                        }}
                      >
                        {isVerifying ? <Loader2 size={15} className="spin" /> : "Verify"}
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
                              Select Property / Building:
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
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                      Select Registered Hostel / Campus *
                    </label>
                    {isLoadingDirectory ? (
                      <div
                        style={{
                          padding: "12px",
                          borderRadius: "8px",
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          color: "#64748b",
                          fontSize: "13px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "12px",
                        }}
                      >
                        <Loader2 size={16} className="spin" />
                        <span>Loading registered hostels...</span>
                      </div>
                    ) : (
                      <select
                        value={directoryOrgId}
                        onChange={(e) => {
                          const val = e.target.value
                          setDirectoryOrgId(val)
                          if (
                            errorMessage &&
                            (errorMessage.toLowerCase().includes("hostel") ||
                              errorMessage.toLowerCase().includes("organization"))
                          ) {
                            setErrorMessage(null)
                          }
                          const found = publicOrgs.find((o) => o.id === val)
                          if (found && found.hostels && found.hostels.length > 0) {
                            setDirectoryHostelId(found.hostels[0].id)
                          } else {
                            setDirectoryHostelId("")
                          }
                        }}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "14px",
                          marginBottom: "12px",
                          outline: "none",
                        }}
                      >
                        <option value="">-- Select Registered Hostel / Campus --</option>
                        {publicOrgs.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name} {org.city ? `(${org.city})` : ""}
                          </option>
                        ))}
                      </select>
                    )}

                    {directoryOrgId && (
                      <div>
                        {(() => {
                          const selectedOrg = publicOrgs.find((o) => o.id === directoryOrgId)
                          const hostels = selectedOrg?.hostels || []
                          if (hostels.length > 1) {
                            return (
                              <div>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                                  Select Building / Block:
                                </label>
                                <select
                                  value={directoryHostelId}
                                  onChange={(e) => {
                                    setDirectoryHostelId(e.target.value)
                                    if (
                                      errorMessage &&
                                      (errorMessage.toLowerCase().includes("building") ||
                                        errorMessage.toLowerCase().includes("block"))
                                    ) {
                                      setErrorMessage(null)
                                    }
                                  }}
                                  style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    borderRadius: "8px",
                                    border: "1px solid #cbd5e1",
                                    fontSize: "14px",
                                    outline: "none",
                                  }}
                                >
                                  <option value="">-- Select Building / Block --</option>
                                  {hostels.map((h) => (
                                    <option key={h.id} value={h.id}>
                                      {h.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )
                          }
                          return null
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Room Number */}
                <div style={{ marginBottom: "24px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                    Your Room Number *
                  </label>
                  <div style={{ position: "relative" }}>
                    <Home size={17} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "12px" }} />
                    <input
                      type="text"
                      placeholder="e.g. B-204"
                      value={roomNumber}
                      onChange={(e) => {
                        setRoomNumber(e.target.value)
                        if (errorMessage && errorMessage.toLowerCase().includes("room")) {
                          setErrorMessage(null)
                        }
                      }}
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

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    width: "100%",
                    padding: "12px",
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
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Affiliation & Enter Portal</span>
                      <ChevronRight size={18} />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
