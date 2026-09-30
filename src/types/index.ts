export type UserRole =
  | "student"
  | "warden"
  | "staff"
  | "admin"

export type ComplaintStatus =
  | "submitted"
  | "assigned"
  | "in-progress"
  | "need-material"
  | "cannot-complete"
  | "resolved"
  | "rejected"

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
  role: UserRole
  hostel?: string
  room?: string
  phone?: string
}

export interface Complaint {
  id: string
  studentId: string
  studentName: string
  hostel: string
  room: string
  title: string
  description: string
  category: ComplaintCategory
  priority: ComplaintPriority
  status: ComplaintStatus
  assignedStaff?: string
  createdAt: string
  updatedAt: string
}