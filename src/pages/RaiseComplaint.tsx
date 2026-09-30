import type { Complaint } from "../types"
import { useState } from "react"

import {
  ArrowLeft,
  Send,
  Upload,
} from "lucide-react"

import type {
  ComplaintCategory,
  ComplaintPriority,
} from "../types"

interface RaiseComplaintProps {
  onBack: () => void
  onComplaintSubmitted: (
    complaint: Complaint
  ) => void
}

export default function RaiseComplaint({
  onBack,
  onComplaintSubmitted,
}: RaiseComplaintProps) {
  const [category, setCategory] =
    useState<ComplaintCategory>("Electrical")

  const [priority, setPriority] =
    useState<ComplaintPriority>("medium")

  const [title, setTitle] = useState("")
  const [description, setDescription] =
    useState("")
  const [room, setRoom] =
    useState("A-204")

  const [isSubmitting, setIsSubmitting] =
    useState(false)

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault()

    if (
      !title.trim() ||
      !description.trim()
    ) {
      alert(
        "Please fill in the complaint title and description."
      )
      return
    }

    if (!room.trim()) {
      alert("Please enter your room number.")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(
        "http://localhost:5000/api/complaints",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            student_id: 1,
            title: title.trim(),
            description: description.trim(),
            category,
            priority,
            hostel: "Girls Hostel A",
            room: room.trim(),
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to submit complaint"
        )
      }

      const complaintFromBackend =
        data.complaint

      const newComplaint: Complaint = {
        id: `HF-${complaintFromBackend.id}`,
        studentId: "STU001",
        studentName:
          complaintFromBackend.student_name,
        hostel:
          complaintFromBackend.hostel,
        room:
          complaintFromBackend.room,
        title:
          complaintFromBackend.title,
        description:
          complaintFromBackend.description,
        category:
          complaintFromBackend.category,
        priority:
          complaintFromBackend.priority,
        status:
          complaintFromBackend.status,
        createdAt:
          complaintFromBackend.created_at
            .split("T")[0],
        updatedAt:
          complaintFromBackend.updated_at
            .split("T")[0],
      }

      onComplaintSubmitted(newComplaint)

      alert(
        `Complaint submitted successfully!\nComplaint ID: HF-${complaintFromBackend.id}`
      )

      setTitle("")
      setDescription("")
      setCategory("Electrical")
      setPriority("medium")
      setRoom("A-204")
    } catch (error) {
      console.error(
        "Complaint submission error:",
        error
      )

      alert(
        error instanceof Error
          ? error.message
          : "Failed to submit complaint. Please try again."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="raise-page">

      {/* Header */}

      <header className="form-header">

        <button
          className="back-button"
          onClick={onBack}
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

        <div>
          <h1>Raise a Complaint</h1>

          <p>
            Tell us what needs to be fixed in your hostel.
          </p>
        </div>

      </header>

      {/* Form */}

      <main className="raise-content">

        <form
          className="complaint-form"
          onSubmit={handleSubmit}
        >

          {/* Location */}

          <section className="form-section">

            <h2>Complaint Location</h2>

            <p className="section-description">
              Where is the issue located?
            </p>

            <div className="form-grid">

              <div className="form-field">

                <label>Hostel</label>

                <input
                  value="Girls Hostel A"
                  disabled
                />

              </div>

              <div className="form-field">

                <label>Room Number</label>

                <input
                  value={room}
                  onChange={(e) =>
                    setRoom(e.target.value)
                  }
                  placeholder="Enter room number"
                />

              </div>

            </div>

          </section>

          {/* Category */}

          <section className="form-section">

            <h2>Complaint Category</h2>

            <p className="section-description">
              Select the category that best describes your issue.
            </p>

            <div className="category-grid">

              {(
                [
                  "Electrical",
                  "Plumbing",
                  "Internet",
                  "Cleaning",
                  "Furniture",
                  "Water Supply",
                  "Security",
                  "Other",
                ] as ComplaintCategory[]
              ).map((item) => (

                <button
                  type="button"
                  key={item}
                  className={`category-option ${
                    category === item
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    setCategory(item)
                  }
                >
                  {item}
                </button>

              ))}

            </div>

          </section>

          {/* Complaint details */}

          <section className="form-section">

            <h2>Complaint Details</h2>

            <p className="section-description">
              Provide enough information so the maintenance
              team can understand the issue.
            </p>

            <div className="form-field">

              <label>
                Complaint Title
              </label>

              <input
                value={title}
                onChange={(e) =>
                  setTitle(e.target.value)
                }
                placeholder="e.g. Ceiling fan not working"
                maxLength={80}
              />

            </div>

            <div className="form-field">

              <label>
                Description
              </label>

              <textarea
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
                placeholder="Describe the problem in detail..."
                rows={6}
                maxLength={500}
              />

              <span className="character-count">
                {description.length}/500
              </span>

            </div>

          </section>

          {/* Priority */}

          <section className="form-section">

            <h2>Priority</h2>

            <p className="section-description">
              How urgently does this issue need attention?
            </p>

            <div className="priority-grid">

              {(
                [
                  {
                    value: "low",
                    label: "Low",
                    description: "Can wait a few days",
                  },
                  {
                    value: "medium",
                    label: "Medium",
                    description: "Needs attention soon",
                  },
                  {
                    value: "high",
                    label: "High",
                    description: "Needs quick attention",
                  },
                  {
                    value: "urgent",
                    label: "Urgent",
                    description: "Immediate attention required",
                  },
                ] as {
                  value: ComplaintPriority
                  label: string
                  description: string
                }[]
              ).map((item) => (

                <button
                  type="button"
                  key={item.value}
                  className={`priority-option ${
                    priority === item.value
                      ? "selected"
                      : ""
                  } ${item.value}`}
                  onClick={() =>
                    setPriority(item.value)
                  }
                >

                  <strong>
                    {item.label}
                  </strong>

                  <span>
                    {item.description}
                  </span>

                </button>

              ))}

            </div>

          </section>

          {/* Attachment */}

          <section className="form-section">

            <h2>Attach Photo</h2>

            <p className="section-description">
              A photo can help the maintenance team
              understand the issue faster.
            </p>

            <label className="upload-box">

              <Upload size={24} />

              <strong>
                Upload a photo
              </strong>

              <span>
                PNG, JPG or JPEG · Maximum 5 MB
              </span>

              <input
                type="file"
                accept="image/png,image/jpeg"
                hidden
              />

            </label>

          </section>

          {/* Submit */}

          <div className="form-actions">

            <button
              type="button"
              className="cancel-button"
              onClick={onBack}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="submit-button"
              disabled={isSubmitting}
            >
              <Send size={17} />

              {isSubmitting
                ? "Submitting..."
                : "Submit Complaint"}
            </button>

          </div>

        </form>

      </main>

    </div>
  )
}