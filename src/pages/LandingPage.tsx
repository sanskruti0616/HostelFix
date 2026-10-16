import {
  Wrench,
  ShieldCheck,
  Sparkles,
  Camera,
  Star,
  CheckCircle2,
  Building2,
  Users,
  Clock,
  ArrowRight,
  Cpu,
  Lock,
  ChevronRight,
} from "lucide-react"

interface LandingPageProps {
  onNavigateLogin: () => void
  onNavigateSignUp: (initialTab?: "student" | "organization") => void
  onNavigateStaffLogin?: () => void
  onNavigateStaffSignUp?: () => void
}

export default function LandingPage({
  onNavigateLogin,
  onNavigateSignUp,
  onNavigateStaffLogin,
  onNavigateStaffSignUp,
}: LandingPageProps) {
  return (
    <div className="landing-page-wrapper" style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
      {/* 1. TOP NAVBAR */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid #e2e8f0",
          padding: "16px 24px",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              cursor: "pointer",
            }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)",
              }}
            >
              <Wrench size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    fontSize: "20px",
                    fontWeight: 800,
                    letterSpacing: "-0.5px",
                    color: "#1e1b4b",
                  }}
                >
                  Hostel<span style={{ color: "#4f46e5" }}>Fix</span>
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    background: "#eef2ff",
                    color: "#4f46e5",
                    padding: "2px 8px",
                    borderRadius: "20px",
                    border: "1px solid #c7d2fe",
                  }}
                >
                  Multi-Tenant SaaS
                </span>
              </div>
            </div>
          </div>

          {/* Navigation links */}
          <nav
            style={{
              display: "none",
              gap: "32px",
              alignItems: "center",
              fontWeight: 500,
              fontSize: "14px",
              color: "#475569",
            }}
            className="landing-nav-links"
          >
            <a href="#features" style={{ textDecoration: "none", color: "inherit" }}>
              Features
            </a>
            <a href="#workflow" style={{ textDecoration: "none", color: "inherit" }}>
              How It Works
            </a>
            <a href="#hostels" style={{ textDecoration: "none", color: "inherit" }}>
              For Hostels
            </a>
            <a href="#roles" style={{ textDecoration: "none", color: "inherit" }}>
              Role Portals
            </a>
          </nav>

          {/* Header Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {onNavigateStaffLogin && (
              <button
                onClick={onNavigateStaffLogin}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid #fde68a",
                  background: "#fef3c7",
                  color: "#92400e",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "#fde68a")}
                onMouseOut={(e) => (e.currentTarget.style.background = "#fef3c7")}
              >
                <Wrench size={14} />
                <span>Staff Portal</span>
              </button>
            )}
            <button
              onClick={onNavigateLogin}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#1e293b",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.borderColor = "#94a3b8")}
              onMouseOut={(e) => (e.currentTarget.style.borderColor = "#cbd5e1")}
            >
              Sign In
            </button>
            <button
              onClick={() => onNavigateSignUp("student")}
              style={{
                padding: "8px 20px",
                borderRadius: "8px",
                border: "none",
                background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(79, 70, 229, 0.25)",
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
              onMouseOut={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          padding: "72px 24px 80px",
          background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            maxWidth: "1000px",
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          {/* Pre-badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 16px",
              borderRadius: "30px",
              background: "#eef2ff",
              border: "1px solid #c7d2fe",
              color: "#4f46e5",
              fontSize: "13px",
              fontWeight: 600,
              marginBottom: "24px",
            }}
          >
            <Sparkles size={16} />
            <span>AI-Powered Hostel Maintenance & Complaint Management</span>
          </div>

          {/* Main Headline */}
          <h1
            style={{
              fontSize: "clamp(32px, 5vw, 56px)",
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-1.5px",
              color: "#0f172a",
              marginBottom: "20px",
            }}
          >
            Smarter Hostel Living. <br />
            <span
              style={{
                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Instant Maintenance Resolution.
            </span>
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: "clamp(16px, 2vw, 19px)",
              lineHeight: 1.6,
              color: "#475569",
              maxWidth: "760px",
              margin: "0 auto 36px",
            }}
          >
            A multi-tenant cloud platform connecting students, wardens, and technicians.
            Report issues in seconds with camera evidence, verify with Gemini AI, and track
            resolution in real time across any hostel property.
          </p>

          {/* CTA Buttons */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "16px",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: "40px",
            }}
          >
            <button
              onClick={() => onNavigateSignUp("student")}
              style={{
                padding: "14px 28px",
                borderRadius: "10px",
                border: "none",
                background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 10px 25px -5px rgba(79, 70, 229, 0.4)",
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseOut={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            >
              <span>Join as Student</span>
              <ArrowRight size={18} />
            </button>

            <button
              onClick={() => onNavigateSignUp("organization")}
              style={{
                padding: "14px 28px",
                borderRadius: "10px",
                border: "2px solid #4f46e5",
                background: "#ffffff",
                color: "#4f46e5",
                fontWeight: 700,
                fontSize: "16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "#f5f3ff"
                e.currentTarget.style.transform = "translateY(-2px)"
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "#ffffff"
                e.currentTarget.style.transform = "translateY(0)"
              }}
            >
              <Building2 size={18} />
              <span>Register Your Hostel</span>
            </button>
          </div>

          {/* Quick Sign-In Link */}
          <div style={{ fontSize: "14px", color: "#64748b" }}>
            Already registered?{" "}
            <button
              onClick={onNavigateLogin}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "#4f46e5",
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Sign into your portal
            </button>
          </div>

          {/* Highlight badges bar */}
          <div
            style={{
              marginTop: "56px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              textAlign: "left",
            }}
          >
            {[
              {
                icon: Lock,
                title: "Multi-Tenant Isolation",
                desc: "Strict per-hostel data partitioning",
              },
              {
                icon: Cpu,
                title: "Gemini Vision AI",
                desc: "Categorization & duplicate detection",
              },
              {
                icon: Camera,
                title: "Dual Photo Evidence",
                desc: "Student capture & technician completion",
              },
              {
                icon: Star,
                title: "5-Star Rating System",
                desc: "Transparent maintenance accountability",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: "#ffffff",
                  padding: "16px 20px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    background: "#eef2ff",
                    color: "#4f46e5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <item.icon size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                    {item.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. KEY FEATURES SECTION */}
      <section
        id="features"
        style={{
          padding: "80px 24px",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "56px" }}>
          <h2
            style={{
              fontSize: "32px",
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: "-0.5px",
              marginBottom: "12px",
            }}
          >
            Built for Modern Residential Campuses
          </h2>
          <p style={{ fontSize: "16px", color: "#64748b", maxWidth: "600px", margin: "0 auto" }}>
            Say goodbye to paper complaint registers, lost WhatsApp messages, and delayed repairs.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "28px",
          }}
        >
          {/* Feature 1 */}
          <div
            style={{
              background: "#ffffff",
              padding: "32px",
              borderRadius: "16px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 16px rgba(15, 23, 42, 0.04)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "#eef2ff",
                color: "#4f46e5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px",
              }}
            >
              <Cpu size={26} />
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "10px", color: "#1e293b" }}>
              Gemini Vision AI Verification
            </h3>
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.6 }}>
              Every complaint photo is analyzed by Gemini Vision AI to verify category consistency
              (e.g., electrical, plumbing), check image sharpness, and detect potential duplicate
              reports before dispatch.
            </p>
          </div>

          {/* Feature 2 */}
          <div
            style={{
              background: "#ffffff",
              padding: "32px",
              borderRadius: "16px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 16px rgba(15, 23, 42, 0.04)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "#f0fdf4",
                color: "#16a34a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px",
              }}
            >
              <Camera size={26} />
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "10px", color: "#1e293b" }}>
              Dual Photographic Evidence
            </h3>
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.6 }}>
              Students capture the issue using their mobile/desktop camera viewfinder. Upon repair,
              technicians must upload verified completion photos stored safely on Cloudinary.
            </p>
          </div>

          {/* Feature 3 */}
          <div
            style={{
              background: "#ffffff",
              padding: "32px",
              borderRadius: "16px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 16px rgba(15, 23, 42, 0.04)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "#fdf4ff",
                color: "#c026d3",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px",
              }}
            >
              <Building2 size={26} />
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "10px", color: "#1e293b" }}>
              Multi-Tenant & Multi-Property
            </h3>
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.6 }}>
              Manage multiple hostels or university blocks under a single organization. With strict
              database scoping, students and staff only see issues belonging to their assigned hostel.
            </p>
          </div>

          {/* Feature 4 */}
          <div
            style={{
              background: "#ffffff",
              padding: "32px",
              borderRadius: "16px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 16px rgba(15, 23, 42, 0.04)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "#fffbeb",
                color: "#d97706",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px",
              }}
            >
              <Clock size={26} />
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "10px", color: "#1e293b" }}>
              Real-Time Lifecycle Tracking
            </h3>
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.6 }}>
              Live Socket.IO push updates notify students and wardens as tickets move from
              Submitted → Verified → Assigned → In-Progress → Resolved → Closed.
            </p>
          </div>

          {/* Feature 5 */}
          <div
            style={{
              background: "#ffffff",
              padding: "32px",
              borderRadius: "16px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 16px rgba(15, 23, 42, 0.04)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "#fef2f2",
                color: "#dc2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px",
              }}
            >
              <ShieldCheck size={26} />
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "10px", color: "#1e293b" }}>
              Role-Based Access Control
            </h3>
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.6 }}>
              Granular permissions for Students, Wardens, Maintenance Staff, and Platform Admins.
              Every API endpoint enforces tenant and role authorization at the backend level.
            </p>
          </div>

          {/* Feature 6 */}
          <div
            style={{
              background: "#ffffff",
              padding: "32px",
              borderRadius: "16px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 16px rgba(15, 23, 42, 0.04)",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "#fef3c7",
                color: "#b45309",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px",
              }}
            >
              <Star size={26} />
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "10px", color: "#1e293b" }}>
              Student Ratings & Audit Logs
            </h3>
            <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.6 }}>
              Students can rate resolved repairs from 1 to 5 stars and submit feedback notes. Full
              audit history records who assigned, worked, and resolved each complaint.
            </p>
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS / WORKFLOW SECTION */}
      <section
        id="workflow"
        style={{
          padding: "80px 24px",
          background: "#ffffff",
          borderTop: "1px solid #e2e8f0",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "56px" }}>
            <h2 style={{ fontSize: "32px", fontWeight: 800, color: "#0f172a", marginBottom: "12px" }}>
              How HostelFix Works
            </h2>
            <p style={{ fontSize: "16px", color: "#64748b" }}>
              A seamless, 5-stage workflow from complaint submission to verified closure.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "24px",
              position: "relative",
            }}
          >
            {[
              {
                step: "01",
                title: "Student Reports Issue",
                desc: "Select category, snap a photo with camera viewfinder, and describe the issue.",
              },
              {
                step: "02",
                title: "AI & Warden Review",
                desc: "Gemini AI validates category consistency. Warden reviews and assigns priority.",
              },
              {
                step: "03",
                title: "Technician Dispatched",
                desc: "Assigned staff receives notification, inspects the room, and updates progress.",
              },
              {
                step: "04",
                title: "Photo Proof & Fix",
                desc: "Technician submits mandatory completion photo proof and marks resolved.",
              },
              {
                step: "05",
                title: "Rating & Closure",
                desc: "Student inspects the repair, provides a 5-star rating, and ticket closes.",
              },
            ].map((st, i) => (
              <div
                key={i}
                style={{
                  background: "#f8fafc",
                  padding: "24px",
                  borderRadius: "14px",
                  border: "1px solid #e2e8f0",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: 900,
                    color: "#c7d2fe",
                    lineHeight: 1,
                    marginBottom: "12px",
                  }}
                >
                  {st.step}
                </div>
                <h4 style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>
                  {st.title}
                </h4>
                <p style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.5 }}>
                  {st.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. FOR HOSTEL ORGANIZATIONS CALLOUT */}
      <section
        id="hostels"
        style={{
          padding: "80px 24px",
          maxWidth: "1100px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
            borderRadius: "24px",
            padding: "56px 40px",
            color: "#ffffff",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "40px",
            alignItems: "center",
            boxShadow: "0 20px 40px rgba(30, 27, 75, 0.2)",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-block",
                padding: "4px 12px",
                borderRadius: "20px",
                background: "rgba(255, 255, 255, 0.15)",
                fontSize: "12px",
                fontWeight: 600,
                marginBottom: "16px",
              }}
            >
              Hostel Administrators & Facility Directors
            </div>
            <h2
              style={{
                fontSize: "32px",
                fontWeight: 800,
                lineHeight: 1.2,
                marginBottom: "16px",
              }}
            >
              Ready to modernize your hostel facility management?
            </h2>
            <p
              style={{
                fontSize: "15px",
                color: "#cbd5e1",
                lineHeight: 1.6,
                marginBottom: "28px",
              }}
            >
              Onboard your hostel campus in less than 2 minutes. Generate secure invitation codes
              for students, empower wardens with oversight dashboards, and track technician response times.
            </p>

            <button
              onClick={() => onNavigateSignUp("organization")}
              style={{
                padding: "14px 28px",
                borderRadius: "10px",
                border: "none",
                background: "#ffffff",
                color: "#1e1b4b",
                fontWeight: 700,
                fontSize: "15px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.2)",
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseOut={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            >
              <span>Register Your Hostel Organization</span>
              <ChevronRight size={18} />
            </button>
          </div>

          <div
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              borderRadius: "16px",
              padding: "28px",
              border: "1px solid rgba(255, 255, 255, 0.15)",
            }}
          >
            <h4 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px", color: "#f8fafc" }}>
              What your hostel gets:
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {[
                "Dedicated organization slug and tenant workspace",
                "Instant unique student invitation code (e.g. HF-PREMIER2026)",
                "Full warden oversight & staff dispatch controls",
                "Automated Cloudinary media storage & Gemini AI checks",
                "Exportable CSV reports for university administration",
                "Strict multi-tenant security & zero cross-hostel data leakage",
              ].map((point, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <CheckCircle2 size={18} color="#4ade80" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span style={{ fontSize: "14px", color: "#e2e8f0" }}>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6. ROLE PORTALS PREVIEW SECTION */}
      <section
        id="roles"
        style={{
          padding: "80px 24px",
          background: "#ffffff",
          borderTop: "1px solid #e2e8f0",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "50px" }}>
            <h2 style={{ fontSize: "32px", fontWeight: 800, color: "#0f172a", marginBottom: "12px" }}>
              Portals Tailored for Every Role
            </h2>
            <p style={{ fontSize: "16px", color: "#64748b" }}>
              Each member gets an interface specifically tailored to their daily responsibilities.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "24px",
            }}
          >
            {[
              {
                role: "Students",
                color: "#4f46e5",
                bg: "#eef2ff",
                icon: Users,
                desc: "Raise complaints in under 60 seconds. Track status live, receive SMS/push alerts, and rate technician repairs.",
                action: "Student Sign Up",
                onClick: () => onNavigateSignUp("student"),
              },
              {
                role: "Wardens",
                color: "#0891b2",
                bg: "#ecfeff",
                icon: ShieldCheck,
                desc: "Review incoming student requests, check AI duplicate alerts, assign maintenance staff, and monitor hostel SLAs.",
                action: "Warden Access",
                onClick: onNavigateLogin,
              },
              {
                role: "Maintenance Staff",
                color: "#d97706",
                bg: "#fffbeb",
                icon: Wrench,
                desc: "View assigned work orders, update status to In-Progress, request materials, and upload completion photo proof.",
                action: "Staff Login",
                onClick: onNavigateStaffLogin || onNavigateLogin,
                secondaryAction: onNavigateStaffSignUp ? "Activate Account" : undefined,
                onSecondaryClick: onNavigateStaffSignUp,
              },
              {
                role: "Campus Admins",
                color: "#7c3aed",
                bg: "#f5f3ff",
                icon: Building2,
                desc: "Manage properties, invite staff, monitor hostel-wide maintenance metrics, and export compliance CSV reports.",
                action: "Admin Portal",
                onClick: onNavigateLogin,
              },
            ].map((r, i) => (
              <div
                key={i}
                style={{
                  background: "#f8fafc",
                  borderRadius: "16px",
                  padding: "28px",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      background: r.bg,
                      color: r.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "16px",
                    }}
                  >
                    <r.icon size={22} />
                  </div>
                  <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>
                    {r.role}
                  </h3>
                  <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.5, marginBottom: "20px" }}>
                    {r.desc}
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <button
                    onClick={r.onClick}
                    style={{
                      padding: "10px 16px",
                      borderRadius: "8px",
                      border: `1px solid ${r.color}`,
                      background: "#ffffff",
                      color: r.color,
                      fontWeight: 600,
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      transition: "all 0.2s",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = r.bg)}
                    onMouseOut={(e) => (e.currentTarget.style.background = "#ffffff")}
                  >
                    <span>{r.action}</span>
                    <ArrowRight size={14} />
                  </button>

                  {"secondaryAction" in r && r.secondaryAction && (
                    <button
                      onClick={r.onSecondaryClick}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#b45309",
                        fontWeight: 600,
                        fontSize: "12px",
                        cursor: "pointer",
                        padding: "4px 0",
                        textDecoration: "underline",
                      }}
                    >
                      {r.secondaryAction} →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer
        style={{
          background: "#0f172a",
          color: "#94a3b8",
          padding: "60px 24px 30px",
          borderTop: "1px solid #1e293b",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "40px",
            marginBottom: "48px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "#4f46e5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                }}
              >
                <Wrench size={20} />
              </div>
              <span style={{ fontSize: "20px", fontWeight: 800, color: "#ffffff" }}>
                Hostel<span style={{ color: "#818cf8" }}>Fix</span>
              </span>
            </div>
            <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#94a3b8" }}>
              Multi-tenant residential hostel complaint and maintenance SaaS platform with AI
              verification and real-time tracking.
            </p>
          </div>

          <div>
            <h4 style={{ color: "#ffffff", fontSize: "14px", fontWeight: 700, marginBottom: "14px" }}>
              Platform Navigation
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "13px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <li>
                <button
                  onClick={onNavigateLogin}
                  style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 0 }}
                >
                  Log In to Account
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigateSignUp("student")}
                  style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 0 }}
                >
                  Student Registration
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigateSignUp("organization")}
                  style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 0 }}
                >
                  Hostel Organization Onboarding
                </button>
              </li>
              {onNavigateStaffLogin && (
                <li>
                  <button
                    onClick={onNavigateStaffLogin}
                    style={{ background: "none", border: "none", color: "#fbbf24", cursor: "pointer", padding: 0 }}
                  >
                    Maintenance Staff Portal
                  </button>
                </li>
              )}
              {onNavigateStaffSignUp && (
                <li>
                  <button
                    onClick={onNavigateStaffSignUp}
                    style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 0 }}
                  >
                    Staff Account Activation
                  </button>
                </li>
              )}
            </ul>
          </div>

          <div>
            <h4 style={{ color: "#ffffff", fontSize: "14px", fontWeight: 700, marginBottom: "14px" }}>
              Integrations & Security
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
              <span>✓ MongoDB Atlas Database</span>
              <span>✓ Cloudinary CDN Evidence Storage</span>
              <span>✓ Google Gemini Vision AI</span>
              <span>✓ Google Identity OAuth 2.0</span>
              <span>✓ Strict Multi-Tenant Data Scoping</span>
            </div>
          </div>
        </div>

        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            borderTop: "1px solid #1e293b",
            paddingTop: "24px",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            fontSize: "13px",
          }}
        >
          <div>
            © {new Date().getFullYear()} HostelFix Inc. All rights reserved.
          </div>
          <div style={{ display: "flex", gap: "20px" }}>
            <span style={{ color: "#64748b" }}>Privacy Policy</span>
            <span style={{ color: "#64748b" }}>Terms of Service</span>
            <span style={{ color: "#64748b" }}>Security Overview</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
