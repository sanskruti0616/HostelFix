export type UserRole =
  | "student"
  | "warden"
  | "staff"
  | "admin"

export type ComplaintStatus =
  | "submitted"
  | "pending_verification"
  | "verified"
  | "assigned"
  | "in-progress"
  | "need-material"
  | "cannot-complete"
  | "resolved"
  | "closed"
  | "needs_information"
  | "rejected"
  | "reopened"
  | "cancelled"

export type ComplaintPriority =
  | "low"
  | "medium"
  | "high"
  | "urgent"

export type ComplaintCategory =
  | "Electrical"
  | "Plumbing"
  | "Internet"
  | "Cleaning"
  | "Furniture"
  | "Water Supply"
  | "Security"
  | "Other"

export interface User {
  id: string
  name: string
  email: string
  username?: string
  role: UserRole
  hostel?: string
  room?: string
  phone?: string
  profileImage?: string
  accountStatus?: "active" | "pending" | "suspended"
}

export interface EvidenceImage {
  url: string
  publicId?: string
  hash?: string
  mimeType?: string
  size?: number
  width?: number
  height?: number
  isBlurry?: boolean
  sharpnessScore?: number
}

export interface ResolutionImage {
  url: string
  publicId?: string
  notes?: string
  uploadedAt?: string
}

export interface DuplicateMatch {
  complaintId: string
  complaintNumber: string
  similarityScore: number
  matchType?: string
  details?: string
}

export interface VerificationDetails {
  isVerified: boolean
  verificationType?: string
  result?: string
  confidence?: number
  explanation?: string
  reviewedBy?: string
  reviewedAt?: string
  duplicateMatches?: DuplicateMatch[]
  aiAssessment?: {
    categoryConsistent?: boolean
    suggestedCategory?: string
    missingInformation?: string[]
    recommendedAction?: string
    providerUsed?: string
  }
}

export interface Complaint {
  id: string
  mongoId?: string
  studentId: string
  studentName: string
  studentEmail?: string
  hostel: string
  room: string
  title: string
  description: string
  category: ComplaintCategory
  priority: ComplaintPriority
  status: ComplaintStatus
  evidenceImages?: EvidenceImage[]
  resolutionImages?: ResolutionImage[]
  assignedStaff?: string
  assignedStaffId?: string
  verification?: VerificationDetails
  duplicateOf?: string
  resolvedAt?: string
  resolvedBy?: string
  workNotes?: string
  closedAt?: string
  rating?: number
  ratingComments?: string
  ratedAt?: string
  createdAt: string
  updatedAt: string
}

export interface NotificationItem {
  id: string
  complaintId?: string
  complaintNumber?: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

export interface ComplaintUpdate {
  id: number | string
  complaint_id: number | string
  user_id: number | string | null
  old_status: string | null
  new_status: string
  note: string | null
  created_at: string
  user_name: string | null
  user_role: string | null
}