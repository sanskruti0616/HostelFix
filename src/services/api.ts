import type {
  Complaint,
  ComplaintStatus,
  ComplaintCategory,
  ComplaintPriority,
  NotificationItem,
  User,
  Organization,
  Hostel,
  ComplaintUpdate,
  StaffMember,
  WardenAnalyticsData,
  AdminAnalyticsData,
  RecurringMatch,
  RecurringHotspot,
  PreventiveTask,
  PreventiveStatus,
} from "../types"

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"

export const TOKEN_KEY = "hostelfix_auth_token"
export const USER_KEY = "hostelfix_auth_user"

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredAuth(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getStoredUser(): User | null {
  const data = localStorage.getItem(USER_KEY)
  if (!data) return null
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

/**
 * Standard HTTP fetch wrapper with authorization header injection
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken()
  const headers = new Headers(options.headers || {})

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  // Set default JSON Content-Type unless sending FormData
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  let data: any
  try {
    data = await response.json()
  } catch {
    data = { success: false, message: "Invalid server response" }
  }

  if (response.status === 401) {
    // Session expired or invalid
    clearStoredAuth()
    window.dispatchEvent(new CustomEvent("hostelfix:unauthorized"))
    throw new Error(data.message || "Session expired. Please sign in again.")
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Request failed with status ${response.status}`)
  }

  return data as T
}

export const api = {
  // ===================================================
  // AUTH
  // ===================================================
  auth: {
    async googleLogin(idToken: string) {
      const data = await request<{
        success: boolean
        token: string
        user: User
      }>("/api/auth/google", {
        method: "POST",
        body: JSON.stringify({ idToken }),
      })
      setStoredAuth(data.token, data.user)
      return data
    },

    async manualLogin(identifier: string, password: string) {
      const data = await request<{
        success: boolean
        token: string
        user: User
      }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      })
      setStoredAuth(data.token, data.user)
      return data
    },

    async demoLogin(role: string) {
      const data = await request<{
        success: boolean
        token: string
        user: User
      }>("/api/auth/demo-login", {
        method: "POST",
        body: JSON.stringify({ role }),
      })
      setStoredAuth(data.token, data.user)
      return data
    },

    async devLogin(email: string) {
      const data = await request<{
        success: boolean
        token: string
        user: User
      }>("/api/auth/login-dev", {
        method: "POST",
        body: JSON.stringify({ email }),
      })
      setStoredAuth(data.token, data.user)
      return data
    },

    async getMe() {
      return request<{ success: boolean; user: User }>("/api/users/me")
    },

    async updateProfile(updates: Partial<User>) {
      return request<{ success: boolean; user: User }>("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify(updates),
      })
    },

    async getStaffList(params?: { includeAll?: boolean }) {
      const query = params?.includeAll ? "?includeAll=true" : ""
      return request<{
        success: boolean
        staff: {
          id: string
          name: string
          email: string
          phone?: string
          specialization?: string
          accountStatus?: string
        }[]
      }>(`/api/users/staff${query}`)
    },

    async getAllUsers(params: { role?: string; search?: string; page?: number } = {}) {
      const searchParams = new URLSearchParams()
      if (params.role) searchParams.set("role", params.role)
      if (params.search) searchParams.set("search", params.search)
      if (params.page) searchParams.set("page", String(params.page))
      return request<{
        success: boolean
        total: number
        users: User[]
      }>(`/api/users?${searchParams.toString()}`)
    },

    async updateUserRole(userId: string, role: string) {
      return request<{ success: boolean; user: User }>(`/api/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      })
    },

    async registerOrganization(payload: {
      name: string
      slug: string
      contactEmail: string
      phone?: string
      address?: string
      city?: string
      state?: string
      adminName: string
      adminPassword: string
    }) {
      const data = await request<{
        success: boolean
        message: string
        organization: Organization
        user: User
        token: string
      }>("/api/auth/register-organization", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      setStoredAuth(data.token, data.user)
      return data
    },

    async registerHostel(payload: {
      hostelName: string
      code?: string
      address?: string
      city?: string
      state?: string
      contactEmail: string
      contactPhone?: string
      wardenName: string
      wardenPassword: string
    }) {
      const data = await request<{
        success: boolean
        message: string
        token: string
        hostel: Hostel
        organization: Organization
        user: User
      }>("/api/auth/register-hostel", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      setStoredAuth(data.token, data.user)
      return data
    },

    async registerStudent(payload: {
      name: string
      email: string
      password: string
      invitationCode?: string
      organizationId?: string
      hostelId?: string
      hostelName?: string
      room?: string
      phone?: string
    }) {
      const data = await request<{
        success: boolean
        message: string
        user: User
        token: string
      }>("/api/auth/register-student", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      setStoredAuth(data.token, data.user)
      return data
    },

    async affiliate(payload: {
      invitationCode?: string
      organizationId?: string
      hostelId?: string
      hostelName?: string
      room?: string
      mode?: "invitation" | "directory"
    }) {
      const data = await request<{
        success: boolean
        message: string
        user: User
        token?: string
      }>("/api/auth/affiliate", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      if (data.token) {
        setStoredAuth(data.token, data.user)
      } else {
        const currentToken = getStoredToken()
        if (currentToken) setStoredAuth(currentToken, data.user)
      }
      return data
    },

    staff: {
      async verifyToken(token: string) {
        return request<{
          success: boolean
          valid: boolean
          message?: string
          staff: {
            id: string
            name: string
            email: string
            phone?: string
            specialization?: string
            hostelName?: string
            organizationName?: string
            accountStatus?: string
          }
        }>(`/api/auth/staff/verify-token?token=${encodeURIComponent(token)}`)
      },

      async activate(token: string, password: string) {
        const data = await request<{
          success: boolean
          message: string
          token: string
          user: User
        }>("/api/auth/staff/activate", {
          method: "POST",
          body: JSON.stringify({ token, password }),
        })
        setStoredAuth(data.token, data.user)
        return data
      },

      async googleAuth(idToken: string, token?: string) {
        const data = await request<{
          success: boolean
          message?: string
          token: string
          user: User
        }>("/api/auth/staff/google", {
          method: "POST",
          body: JSON.stringify({ idToken, token }),
        })
        setStoredAuth(data.token, data.user)
        return data
      },
    },

    logout() {
      clearStoredAuth()
    },
  },

  // ===================================================
  // TENANTS / ORGANIZATIONS
  // ===================================================
  tenants: {
    async getPublicList() {
      return request<{
        success: boolean
        organizations: Organization[]
      }>("/api/auth/tenants/public")
    },

    async verifyInvitationCode(code: string) {
      return request<{
        success: boolean
        valid?: boolean
        message?: string
        organization: Organization
        hostels: { id: string; name: string; code?: string }[]
      }>(`/api/auth/tenants/verify-code/${encodeURIComponent(code)}`)
    },
  },

  // ===================================================
  // HOSTELS
  // ===================================================
  hostels: {
    async getPublicList() {
      return request<{
        success: boolean
        count: number
        hostels: Hostel[]
      }>("/api/hostels/public")
    },

    async getAll() {
      return request<{
        success: boolean
        count: number
        hostels: Hostel[]
      }>("/api/hostels")
    },
  },

  // ===================================================
  // COMPLAINTS
  // ===================================================
  complaints: {
    async list(filters: {
      status?: string
      category?: string
      priority?: string
      search?: string
      page?: number
    } = {}) {
      const params = new URLSearchParams()
      if (filters.status && filters.status !== "all") params.set("status", filters.status)
      if (filters.category && filters.category !== "all") params.set("category", filters.category)
      if (filters.priority && filters.priority !== "all") params.set("priority", filters.priority)
      if (filters.search) params.set("search", filters.search)
      if (filters.page) params.set("page", String(filters.page))

      return request<{
        success: boolean
        count: number
        total: number
        complaints: Complaint[]
      }>(`/api/complaints?${params.toString()}`)
    },

    async getById(id: string) {
      return request<{
        success: boolean
        complaint: Complaint
        verificationDetails?: any
        feedback?: { rating: number; comments?: string; createdAt: string } | null
      }>(`/api/complaints/${id}`)
    },

    async create(complaintData: {
      title: string
      description: string
      category: ComplaintCategory
      priority: ComplaintPriority
      hostelId?: string
      hostel?: string
      room?: string
      evidenceImages?: any[]
    }) {
      return request<{
        success: boolean
        message: string
        complaint: Complaint
        verification: any
      }>("/api/complaints", {
        method: "POST",
        body: JSON.stringify(complaintData),
      })
    },

    async assignStaff(complaintId: string, staffNameOrId: string, instructions = "") {
      const isId = /^[0-9a-fA-F]{24}$/.test(staffNameOrId)
      return request<{
        success: boolean
        message: string
        complaint: Complaint
      }>(`/api/complaints/${encodeURIComponent(complaintId)}/assign`, {
        method: "PATCH",
        body: JSON.stringify({
          staff_id: isId ? staffNameOrId : undefined,
          staffName: staffNameOrId,
          instructions,
        }),
      })
    },

    async updateStatus(
      complaintId: string,
      status: ComplaintStatus,
      note?: string,
      extra?: { resolutionImages?: any[]; photoUrl?: string; workNotes?: string }
    ) {
      return request<{
        success: boolean
        message: string
        complaint: Complaint
      }>(`/api/complaints/${encodeURIComponent(complaintId)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, note, ...extra }),
      })
    },

    async resolve(
      complaintId: string,
      payload: { note?: string; workNotes?: string; resolutionImages?: any[]; photoUrl?: string }
    ) {
      return request<{
        success: boolean
        message: string
        complaint: Complaint
      }>(`/api/complaints/${encodeURIComponent(complaintId)}/resolve`, {
        method: "POST",
        body: JSON.stringify(payload),
      })
    },

    async verify(complaintId: string, action: "approve" | "reject" | "request_info", reason: string) {
      return request<{
        success: boolean
        message: string
        complaint: Complaint
      }>(`/api/complaints/${encodeURIComponent(complaintId)}/verify`, {
        method: "POST",
        body: JSON.stringify({ action, reason }),
      })
    },

    async getUpdates(complaintId: string) {
      return request<{
        success: boolean
        updates: ComplaintUpdate[]
      }>(`/api/complaints/${encodeURIComponent(complaintId)}/updates`)
    },

    async submitFeedback(
      complaintId: string,
      rating: number,
      comments = "",
      dimensions?: { workQuality?: number; timeliness?: number; professionalism?: number }
    ) {
      return request<{
        success: boolean
        message: string
        feedback: any
        complaint?: Complaint
      }>(`/api/complaints/${encodeURIComponent(complaintId)}/feedback`, {
        method: "POST",
        body: JSON.stringify({ rating, comments, ...dimensions }),
      })
    },

    getExportCsvUrl(): string {
      const token = getStoredToken()
      return `${API_BASE_URL}/api/complaints/export/csv?token=${token || ""}`
    },
  },

  // ===================================================
  // UPLOADS
  // ===================================================
  uploads: {
    async uploadEvidence(files: File[]) {
      const formData = new FormData()
      files.forEach((file) => formData.append("images", file))

      return request<{
        success: boolean
        images: any[]
        duplicateWarnings: any[]
        message: string
      }>("/api/uploads", {
        method: "POST",
        body: formData,
      })
    },

    async uploadResolution(complaintId: string, files: File[], notes = "") {
      const formData = new FormData()
      files.forEach((file) => formData.append("images", file))
      formData.append("notes", notes)

      return request<{
        success: boolean
        message: string
        resolutionImages: any[]
      }>(`/api/complaints/${encodeURIComponent(complaintId)}/resolution-evidence`, {
        method: "POST",
        body: formData,
      })
    },
  },

  // ===================================================
  // NOTIFICATIONS
  // ===================================================
  notifications: {
    async list() {
      return request<{
        success: boolean
        unreadCount: number
        notifications: NotificationItem[]
      }>("/api/notifications")
    },

    async markRead(id: string) {
      return request<{ success: boolean }>(`/api/notifications/${id}/read`, {
        method: "PATCH",
      })
    },

    async markAllRead() {
      return request<{ success: boolean }>("/api/notifications/read-all", {
        method: "PATCH",
      })
    },
  },

  // ===================================================
  // DASHBOARDS
  // ===================================================
  dashboards: {
    async getStudent() {
      return request<{
        success: boolean
        stats: {
          total: number
          pending: number
          inProgress: number
          resolved: number
          rejected: number
        }
        recentComplaints: any[]
      }>("/api/dashboard/student")
    },

    async getWarden() {
      return request<{
        success: boolean
        stats: {
          total: number
          awaitingVerification: number
          awaitingAssignment: number
          inProgress: number
          resolved: number
          rejected: number
        }
        categoryDistribution: { category: string; count: number }[]
        priorityDistribution: { priority: string; count: number }[]
      }>("/api/dashboard/warden")
    },

    async getMaintenance() {
      return request<{
        success: boolean
        stats: {
          totalAssigned: number
          pending: number
          inProgress: number
          completed: number
        }
      }>("/api/dashboard/maintenance")
    },

    async getAdmin() {
      return request<{
        success: boolean
        stats: {
          totalUsers: number
          totalHostels: number
          totalRooms: number
          totalComplaints: number
          activeComplaints: number
          resolvedComplaints: number
          urgentComplaints: number
        }
        usersByRole: Record<string, number>
        staffWorkload: { staffName: string; totalTasks: number; resolvedTasks: number }[]
        verificationOutcomes: Record<string, number>
      }>("/api/dashboard/admin")
    },
  },

  // ===================================================
  // MAINTENANCE ANALYTICS
  // ===================================================
  analytics: {
    async getWarden(filters: {
      days?: string | number
      startDate?: string
      endDate?: string
      category?: string
      status?: string
      priority?: string
      room?: string
      staffId?: string
      hostelId?: string
    } = {}) {
      const params = new URLSearchParams()
      if (filters.days) params.set("days", String(filters.days))
      if (filters.startDate) params.set("startDate", filters.startDate)
      if (filters.endDate) params.set("endDate", filters.endDate)
      if (filters.category && filters.category !== "all") params.set("category", filters.category)
      if (filters.status && filters.status !== "all") params.set("status", filters.status)
      if (filters.priority && filters.priority !== "all") params.set("priority", filters.priority)
      if (filters.room) params.set("room", filters.room)
      if (filters.staffId) params.set("staffId", filters.staffId)
      if (filters.hostelId) params.set("hostelId", filters.hostelId)
      return request<WardenAnalyticsData & { success: boolean }>(`/api/analytics/warden?${params.toString()}`)
    },

    async getAdmin() {
      return request<AdminAnalyticsData & { success: boolean }>("/api/analytics/admin")
    },
  },

  // ===================================================
  // RECURRING ISSUE DETECTION
  // ===================================================
  recurrence: {
    async getMatches(complaintId: string, days = 30) {
      return request<{
        success: boolean
        complaintId: string
        complaintNumber: string
        category: string
        roomNumber: string
        hostelName: string
        timeWindowDays: number
        count: number
        matches: RecurringMatch[]
        rootCauseSuggestion: string
        recurringReview?: any
      }>(`/api/complaints/${encodeURIComponent(complaintId)}/recurring-matches?days=${days}`)
    },

    async submitReview(
      complaintId: string,
      payload: {
        decision: "confirmed" | "unrelated"
        rootCauseNote?: string
        relatedComplaintIds?: string[]
      }
    ) {
      return request<{
        success: boolean
        message: string
        complaint: Complaint
      }>(`/api/complaints/${encodeURIComponent(complaintId)}/recurring-review`, {
        method: "POST",
        body: JSON.stringify(payload),
      })
    },

    async getHotspots(days = 30, hostelId?: string) {
      const query = hostelId ? `?days=${days}&hostelId=${encodeURIComponent(hostelId)}` : `?days=${days}`
      return request<{
        success: boolean
        count: number
        timeWindowDays: number
        hotspots: RecurringHotspot[]
      }>(`/api/complaints-analytics/recurring-hotspots${query}`)
    },
  },

  // ===================================================
  // PREVENTIVE MAINTENANCE PLANNER
  // ===================================================
  preventive: {
    async list(filters: {
      status?: string
      category?: string
      priority?: string
      dueState?: string
      search?: string
      page?: number
      limit?: number
    } = {}) {
      const params = new URLSearchParams()
      if (filters.status && filters.status !== "all") params.set("status", filters.status)
      if (filters.category && filters.category !== "all") params.set("category", filters.category)
      if (filters.priority && filters.priority !== "all") params.set("priority", filters.priority)
      if (filters.dueState && filters.dueState !== "all") params.set("dueState", filters.dueState)
      if (filters.search) params.set("search", filters.search)
      if (filters.page) params.set("page", String(filters.page))
      if (filters.limit) params.set("limit", String(filters.limit))
      return request<{
        success: boolean
        count: number
        total: number
        page: number
        tasks: PreventiveTask[]
      }>(`/api/preventive-tasks?${params.toString()}`)
    },

    async getById(id: string) {
      return request<{
        success: boolean
        task: PreventiveTask
      }>(`/api/preventive-tasks/${encodeURIComponent(id)}`)
    },

    async create(payload: {
      title: string
      description: string
      category: string
      location: string
      roomNumber?: string
      building?: string
      dueAt: string
      priority?: string
      frequency?: string
      assignedStaffId?: string
      hostelId?: string
    }) {
      return request<{
        success: boolean
        message: string
        task: PreventiveTask
      }>("/api/preventive-tasks", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    },

    async updateStatus(
      id: string,
      payload: {
        status: PreventiveStatus
        completionNotes?: string
        completionImages?: any[]
      }
    ) {
      return request<{
        success: boolean
        message: string
        task: PreventiveTask
      }>(`/api/preventive-tasks/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      })
    },
  },

  // ===================================================
  // STAFF MANAGEMENT
  // ===================================================
  staff: {
    async list(params: { includeAll?: boolean; status?: string; search?: string } = {}) {
      const searchParams = new URLSearchParams()
      if (params.includeAll) searchParams.set("includeAll", "true")
      if (params.status) searchParams.set("status", params.status)
      if (params.search) searchParams.set("search", params.search)
      const query = searchParams.toString() ? `?${searchParams.toString()}` : ""
      return request<{
        success: boolean
        count: number
        staff: StaffMember[]
      }>(`/api/users/staff${query}`)
    },

    async create(payload: {
      name: string
      email: string
      password?: string
      phone?: string
      specialization?: string
      hostelId?: string
    }) {
      return request<{
        success: boolean
        message: string
        staff: StaffMember
        activationToken?: string
        activationTokenExpires?: string
      }>("/api/users/staff", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    },

    async updateStatus(staffId: string, status: "active" | "suspended") {
      return request<{
        success: boolean
        message: string
        staff: StaffMember
      }>(`/api/users/staff/${staffId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
    },

    async update(staffId: string, payload: { name?: string; phone?: string; specialization?: string }) {
      return request<{
        success: boolean
        message: string
        staff: StaffMember
      }>(`/api/users/staff/${staffId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      })
    },
  },

  // ===================================================
  // SYSTEM HEALTH
  // ===================================================
  async checkHealth() {
    return request<{
      success: boolean
      status: string
      database: { connected: boolean }
      cloudStorage: { provider: string; configured: boolean }
      aiProvider: { configured: boolean; mode: string }
    }>("/api/health")
  },
}
