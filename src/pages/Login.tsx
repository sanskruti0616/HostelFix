import { useState } from "react"
import { Home, LogIn, ShieldCheck, Wrench, UserRound } from "lucide-react"
import type { UserRole } from "../types"
import { users } from "../data/users"

interface LoginProps {
  onLogin: (role: UserRole, staffName?: string) => void
}

const staffMembers = users.filter((user) => user.role === "staff")

const roleDetails = {
  student: {
    label: "Student",
    description: "Raise and track hostel complaints",
    icon: UserRound,
  },
  warden: {
    label: "Warden",
    description: "Manage complaints and assign staff",
    icon: ShieldCheck,
  },
  staff: {
    label: "Maintenance Staff",
    description: "Handle assigned maintenance requests",
    icon: Wrench,
  },
  admin: {
    label: "Administrator",
    description: "Manage the complete HostelFix system",
    icon: ShieldCheck,
  },
}

export default function Login({ onLogin }: LoginProps) {
  const [role, setRole] = useState<UserRole>("student")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [selectedStaff, setSelectedStaff] = useState(
    staffMembers[0]?.name ?? ""
  )

  const selectedRole = roleDetails[role]
  const SelectedIcon = selectedRole.icon

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    onLogin(role, role === "staff" ? selectedStaff : undefined)
  }

  return (
    <div className="login-page">

      {/* Left branding section */}
      <div className="login-brand">

        <div className="brand-logo">
          <Home size={30} />
        </div>

        <h1>HostelFix</h1>

        <p>
          Smart Hostel Complaint & Maintenance
          Management System
        </p>

        <div className="brand-features">
          <div>
            <span>✓</span>
            Easy complaint registration
          </div>

          <div>
            <span>✓</span>
            Real-time complaint tracking
          </div>

          <div>
            <span>✓</span>
            Faster maintenance resolution
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

          <p className="login-subtitle">
            Sign in to manage your hostel services
          </p>

          <form onSubmit={handleSubmit}>

            {/* Email */}
            <div className="form-group">

              <label htmlFor="email">
                Email Address
              </label>

              <input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

            </div>

            {/* Password */}
            <div className="form-group">

              <label htmlFor="password">
                Password
              </label>

              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

            </div>

            {/* Role */}
            <div className="form-group">

              <label>
                Login As
              </label>

              <div className="role-grid">

                {(Object.keys(roleDetails) as UserRole[]).map(
                  (roleOption) => {

                    const RoleIcon =
                      roleDetails[roleOption].icon

                    return (
                      <button
                        type="button"
                        key={roleOption}
                        className={`role-option ${
                          role === roleOption
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          setRole(roleOption)
                        }
                      >

                        <RoleIcon size={20} />

                        <span>
                          {roleDetails[roleOption].label}
                        </span>

                      </button>
                    )
                  }
                )}

              </div>

            </div>

            {/* Staff member selection */}
            {role === "staff" && (
              <div className="form-group">

                <label htmlFor="staff-member">
                  Login As Team Member
                </label>

                <select
                  id="staff-member"
                  className="staff-select"
                  value={selectedStaff}
                  onChange={(e) =>
                    setSelectedStaff(e.target.value)
                  }
                >

                  {staffMembers.map((member) => (
                    <option
                      key={member.id}
                      value={member.name}
                    >
                      {member.name}
                    </option>
                  ))}

                </select>

              </div>
            )}

            {/* Selected role information */}
            <div className="selected-role">

              <div className="selected-role-icon">
                <SelectedIcon size={18} />
              </div>

              <div>
                <strong>
                  {role === "staff" && selectedStaff
                    ? selectedStaff
                    : selectedRole.label}
                </strong>

                <span>
                  {selectedRole.description}
                </span>
              </div>

            </div>

            {/* Login button */}
            <button
              type="submit"
              className="login-button"
            >
              <LogIn size={18} />
              Sign In
            </button>

          </form>

          <p className="demo-note">
            Demo mode: any email and password will work.
          </p>

        </div>

      </div>

    </div>
  )
}