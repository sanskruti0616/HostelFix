import type {
  Complaint,
  ComplaintStatus,
  ComplaintCategory,
  ComplaintPriority,
  NotificationItem,
  User,
  ComplaintUpdate,
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

    async getStaffList() {
      return request<{
        success: boolean
        staff: { id: string; name: string; email: string; phone?: string }[]
      }>("/api/users/staff")
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

    logout() {
      clearStoredAuth()
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
      const idParam = complaintId.replace("HF-", "")
      return request<{
        success: boolean
        message: string
        complaint: Complaint
      }>(`/api/complaints/${idParam}/assign`, {
        method: "PATCH",
        body: JSON.stringify({
          staffName: staffNameOrId,
          instructions,
        }),
      })
    },

    async updateStatus(complaintId: string, status: ComplaintStatus, note?: string) {
      const idParam = complaintId.replace("HF-", "")
      return request<{
        success: boolean
        message: string
        complaint: Complaint
      }>(`/api/complaints/${idParam}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, note }),
      })
    },

    async verify(complaintId: string, action: "approve" | "reject" | "request_info", reason: string) {
      const idParam = complaintId.replace("HF-", "")
      return request<{
        success: boolean
        message: string
        complaint: Complaint
      }>(`/api/complaints/${idParam}/verify`, {
        method: "POST",
        body: JSON.stringify({ action, reason }),
      })
    },

    async getUpdates(complaintId: string) {
      const idParam = complaintId.replace("HF-", "")
      return request<{
        success: boolean
        updates: ComplaintUpdate[]
      }>(`/api/complaints/${idParam}/updates`)
    },

    async submitFeedback(complaintId: string, rating: number, comments: string) {
      const idParam = complaintId.replace("HF-", "")
      return request<{
        success: boolean
        message: string
      }>(`/api/complaints/${idParam}/feedback`, {
        method: "POST",
        body: JSON.stringify({ rating, comments }),
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
      const idParam = complaintId.replace("HF-", "")
      const formData = new FormData()
      files.forEach((file) => formData.append("images", file))
      formData.append("notes", notes)

      return request<{
        success: boolean
        message: string
        resolutionImages: any[]
      }>(`/api/complaints/${idParam}/resolution-evidence`, {
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
