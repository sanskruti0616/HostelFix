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

export interface Organization {
  id: string
  name: string
  slug: string
  invitationCode: string
  contactEmail: string
  phone?: string
  address?: string
  city?: string
  state?: string
  status: "active" | "suspended" | "pending_setup"
  plan?: string
  hostels?: { id: string; name: string; code?: string }[]
  createdAt?: string
}

export interface Hostel {
  id: string
  name: string
  code?: string
  address?: string
  status?: string
  organizationId?: string
  contactInformation?: any
  totalRooms?: number
}

export interface User {
  id: string
  name: string
  email: string
  username?: string
  role: UserRole
  organizationId?: string
  organizationName?: string
  hostelId?: string
  hostel?: string
  hostelName?: string
  authorizedHostels?: string[]
  room?: string
  roomNumber?: string
  phone?: string
  profileImage?: string
  specialization?: string
  accountStatus?: "active" | "pending" | "suspended" | "pending_affiliation" | "pending_approval" | "pending_activation"
  invitationCodeUsed?: string
}

export interface StaffMember {
  id: string
  name: string
  email: string
  phone?: string
  specialization: string
  accountStatus: "active" | "suspended" | "pending_activation"
  hostelId?: string
  hostelName?: string
  organizationId?: string
  organizationName?: string
  assignedCount: number
  completedCount: number
  activationToken?: string
  activationTokenExpires?: string
  createdAt?: string
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
  organizationId?: string
  organizationName?: string
  studentId: string
  studentName: string
  studentEmail?: string
  hostelId?: string
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
  recurringReview?: RecurringReview
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

export interface RecurringReview {
  isRecurring: boolean
  decision: "pending" | "confirmed" | "unrelated"
  reviewedBy?: string
  reviewedByName?: string
  reviewedAt?: string
  relatedComplaintIds?: string[]
  rootCauseNote?: string
}

export interface RecurringMatch {
  complaintId: string
  complaintNumber: string
  title: string
  category: string
  roomNumber: string
  status: string
  assignedStaff?: string
  createdAt: string
  resolvedAt?: string
  similarityReason: string
  decision: "pending" | "confirmed" | "unrelated"
}

export interface RecurringHotspot {
  roomNumber: string
  category: string
  complaintCount: number
  complaintNumbers: string[]
  latestCreatedAt: string
  suggestion: string
}

export type PreventivePriority = "low" | "medium" | "high" | "urgent"
export type PreventiveFrequency = "one-time" | "weekly" | "monthly" | "quarterly"
export type PreventiveStatus = "scheduled" | "in-progress" | "completed" | "overdue" | "cancelled"
export type PreventiveDueState = "upcoming" | "due_soon" | "overdue" | "completed" | "cancelled"

export interface PreventiveImage {
  url: string
  publicId?: string
  uploadedAt?: string
}

export interface PreventiveTask {
  id: string
  mongoId?: string
  taskNumber: string
  title: string
  description: string
  category: ComplaintCategory | string
  location: string
  roomNumber?: string
  building?: string
  dueAt: string
  priority: PreventivePriority
  frequency: PreventiveFrequency
  status: PreventiveStatus
  dueState: PreventiveDueState
  hostelId?: string
  hostelName: string
  organizationId?: string
  assignedTo?: {
    staffId?: string | null
    staffName?: string
    assignedAt?: string | null
  } | null
  createdBy: string
  createdByName?: string
  completedAt?: string | null
  completedBy?: string | null
  completionNotes?: string
  completionImages?: PreventiveImage[]
  createdAt: string
  updatedAt: string
}

export interface WardenAnalyticsSummary {
  totalComplaints: number
  newlySubmitted: number
  pending: number
  inProgress: number
  resolved: number
  rejected: number
  overdue: number
  avgResolutionHours: number
  resolutionRate: number
  slaComplianceRate: number
  resolvedWithinSla: number
}

export interface CategoryBreakdown {
  category: string
  count: number
  percentage: number
  resolvedCount: number
}

export interface TrendDataPoint {
  date: string
  submitted: number
  resolved: number
}

export interface LocationHotspot {
  roomNumber: string
  count: number
  resolvedCount: number
  pendingCount: number
  categories: string[]
}

export interface StaffWorkloadItem {
  staffId: string
  staffName: string
  email: string
  specialization: string
  assignedCount: number
  inProgressCount: number
  resolvedInPeriodCount: number
  pendingCount: number
}

export interface WardenAnalyticsData {
  summary: WardenAnalyticsSummary
  categoryDistribution: CategoryBreakdown[]
  trends: TrendDataPoint[]
  locationHotspots: LocationHotspot[]
  staffWorkload: StaffWorkloadItem[]
  filterApplied: {
    hostel: string
    days: string | number
    category: string
    status: string
  }
}

export interface AdminAnalyticsData {
  hostelOverview: {
    totalHostels: number
    activeHostels: number
    pendingHostels: number
  }
  userOverview?: {
    totalUsers: number
    students: number
    wardens: number
    staff: number
    admins: number
  }
  complaintOverview: {
    totalComplaints: number
    openComplaints: number
    resolvedComplaints: number
    pendingVerification?: number
    inProgress?: number
    resolutionRate: number
    avgResolutionHours: number
  }
  statusDistribution?: { status: string; count: number; percentage: number }[]
  categoryDistribution: { category: string; count: number; percentage: number }[]
  hostelPerformance: {
    hostelId: string
    hostelName: string
    totalComplaints: number
    openComplaints: number
    resolvedComplaints: number
    resolutionRate: number
    avgResolutionHours: number
  }[]
  ratingsOverview?: {
    totalRated: number
    avgRating: number
    breakdown: { [stars: number]: number }
  }
  platformTrend: { date: string; submitted: number }[]
  recurringHotspots?: RecurringHotspot[]
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