import { useState, useRef, useEffect } from "react"
import { ArrowLeft, Send, Upload, X, AlertTriangle, Loader2, Camera } from "lucide-react"
import type { Complaint, ComplaintCategory, ComplaintPriority, User } from "../types"
import { api } from "../services/api"

interface RaiseComplaintProps {
  currentUser: User
  onBack: () => void
  onComplaintSubmitted: (complaint: Complaint) => void
}

interface ImagePreview {
  file: File
  previewUrl: string
}

export default function RaiseComplaint({
  currentUser,
  onBack,
  onComplaintSubmitted,
}: RaiseComplaintProps) {
  const [category, setCategory] = useState<ComplaintCategory>("Electrical")
  const [priority, setPriority] = useState<ComplaintPriority>("medium")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [room, setRoom] = useState(currentUser.room || currentUser.roomNumber || "A-201")
  const assignedHostelName = currentUser.hostelName || currentUser.hostel || "Assigned Hostel"

  const [selectedImages, setSelectedImages] = useState<ImagePreview[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitProgress, setSubmitProgress] = useState<string>("")
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // Camera capture modal state
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [cameraStream])

  const startCamera = async () => {
    setFormError(null)
    if (selectedImages.length >= 5) {
      setFormError("You can upload a maximum of 5 evidence photographs.")
      return
    }

    // Try opening getUserMedia video stream
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        setCameraStream(stream)
        setIsCameraActive(true)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      } catch (err: any) {
        console.warn("Camera streaming failed, falling back to camera input:", err.message)
        // Fallback to mobile native camera file input
        cameraInputRef.current?.click()
      }
    } else {
      cameraInputRef.current?.click()
    }
  }

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop())
      setCameraStream(null)
    }
    setIsCameraActive(false)
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    setIsCapturing(true)

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480

    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], `evidence_camera_${Date.now()}.jpg`, { type: "image/jpeg" })
            const previewUrl = URL.createObjectURL(file)
            setSelectedImages((prev) => [...prev, { file, previewUrl }])
            stopCamera()
          }
          setIsCapturing(false)
        },
        "image/jpeg",
        0.88
      )
    } else {
      setIsCapturing(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError(null)
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // Limit to 5 images total
    if (selectedImages.length + files.length > 5) {
      setFormError("You can upload a maximum of 5 evidence photographs.")
      return
    }

    const newPreviews: ImagePreview[] = []
    for (const file of files) {
      // Validate type
      if (!["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(file.type)) {
        setFormError(`File "${file.name}" is not a supported format. Please upload JPEG, PNG, or WebP.`)
        continue
      }
      // Validate size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setFormError(`File "${file.name}" exceeds the 10 MB limit.`)
        continue
      }

      newPreviews.push({
        file,
        previewUrl: URL.createObjectURL(file),
      })
    }

    setSelectedImages((prev) => [...prev, ...newPreviews])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleRemoveImage = (index: number) => {
    setSelectedImages((prev) => {
      const removed = prev[index]
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl)
      }
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setDuplicateWarning(null)

    if (!title.trim() || !description.trim()) {
      setFormError("Please fill in both the complaint title and detailed description.")
      return
    }

    if (!room.trim()) {
      setFormError("Please enter your room number.")
      return
    }

    setIsSubmitting(true)
    setSubmitProgress("Validating complaint...")

    try {
      let uploadedEvidence: any[] = []

      // 1. Upload evidence images if any
      if (selectedImages.length > 0) {
        setSubmitProgress("Uploading and inspecting photographs for authenticity...")
        const filesToUpload = selectedImages.map((p) => p.file)
        const uploadResponse = await api.uploads.uploadEvidence(filesToUpload)

        uploadedEvidence = uploadResponse.images

        if (uploadResponse.duplicateWarnings && uploadResponse.duplicateWarnings.length > 0) {
          const match = uploadResponse.duplicateWarnings[0]
          setDuplicateWarning(
            `Notice: Similar photograph previously detected in complaint #${match.complaintNumber} (${match.similarityScore}% match). Your complaint will be flagged for warden duplicate review.`
          )
        }
      }

      // 2. Submit complaint with AI verification
      setSubmitProgress("Running AI complaint validity assessment...")
      const response = await api.complaints.create({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        hostelId: currentUser.hostelId,
        hostel: assignedHostelName,
        room: room.trim(),
        evidenceImages: uploadedEvidence,
      })

      setSubmitProgress("Complaint registered successfully!")
      onComplaintSubmitted(response.complaint)

      // Clean up object URLs
      selectedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl))
    } catch (error: any) {
      console.error("Complaint submission error:", error)
      setFormError(error.message || "Failed to submit complaint. Please check your connection.")
    } finally {
      setIsSubmitting(false)
      setSubmitProgress("")
    }
  }

  return (
    <div className="raise-page">
      {/* Header */}
      <header className="form-header">
        <button className="back-button" onClick={onBack} disabled={isSubmitting}>
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

        <div>
          <h1>Raise a Complaint</h1>
          <p>Submit a maintenance request with photographic evidence.</p>
        </div>
      </header>

      {/* Form */}
      <main className="raise-content">
        {formError && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "14px 18px",
              marginBottom: "24px",
              background: "#fef2f2",
              border: "1px solid #fee2e2",
              borderRadius: "10px",
              color: "#b91c1c",
              fontSize: "14px",
            }}
          >
            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
            <span>{formError}</span>
          </div>
        )}

        {duplicateWarning && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "14px 18px",
              marginBottom: "24px",
              background: "#fffbeb",
              border: "1px solid #fef3c7",
              borderRadius: "10px",
              color: "#b45309",
              fontSize: "14px",
            }}
          >
            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
            <span>{duplicateWarning}</span>
          </div>
        )}

        <form className="complaint-form" onSubmit={handleSubmit}>
          {/* Location */}
          <section className="form-section">
            <h2>Complaint Location</h2>
            <p className="section-description">Verify the building and room where the issue occurred.</p>

            <div className="form-grid">
              <div className="form-field">
                <label>Hostel</label>
                <div
                  style={{
                    padding: "10px 14px",
                    background: "#f1f5f9",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>
                    {assignedHostelName}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                    Assigned to your account
                  </div>
                </div>
              </div>

              <div className="form-field">
                <label>Room Number</label>
                <input
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="Enter room number"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </section>

          {/* Category */}
          <section className="form-section">
            <h2>Complaint Category</h2>
            <p className="section-description">Select the category that best describes the issue.</p>

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
                  className={`category-option ${category === item ? "selected" : ""}`}
                  onClick={() => setCategory(item)}
                  disabled={isSubmitting}
                >
                  {item}
                </button>
              ))}
            </div>
          </section>

          {/* Complaint Details */}
          <section className="form-section">
            <h2>Complaint Details</h2>
            <p className="section-description">
              Provide enough information so the maintenance team and AI verification can understand the issue.
            </p>

            <div className="form-field">
              <label>Complaint Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Washbasin drainage blocked"
                maxLength={80}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-field">
              <label>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue in detail (e.g. water leaking on floor, when it started, etc.)..."
                rows={5}
                maxLength={500}
                disabled={isSubmitting}
              />
              <span className="character-count">{description.length}/500</span>
            </div>
          </section>

          {/* Priority */}
          <section className="form-section">
            <h2>Priority</h2>
            <p className="section-description">How urgently does this issue need attention?</p>

            <div className="priority-grid">
              {(
                [
                  { value: "low", label: "Low", description: "Can wait a few days" },
                  { value: "medium", label: "Medium", description: "Needs attention soon" },
                  { value: "high", label: "High", description: "Needs quick attention" },
                  { value: "urgent", label: "Urgent", description: "Immediate safety / critical hazard" },
                ] as { value: ComplaintPriority; label: string; description: string }[]
              ).map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={`priority-option ${priority === item.value ? "selected" : ""} ${item.value}`}
                  onClick={() => setPriority(item.value)}
                  disabled={isSubmitting}
                >
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Image Attachments */}
          <section className="form-section">
            <h2>Attach Evidence Photographs</h2>
            <p className="section-description">
              Upload clear photographs of the problem. Our automated pipeline checks for file validity, blurriness, and duplicate records.
            </p>

            {/* Previews grid */}
            {selectedImages.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                  gap: "12px",
                  marginBottom: "16px",
                }}
              >
                {selectedImages.map((img, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: "relative",
                      borderRadius: "10px",
                      overflow: "hidden",
                      border: "2px solid #e2e8f0",
                      height: "120px",
                    }}
                  >
                    <img
                      src={img.previewUrl}
                      alt="preview"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      disabled={isSubmitting}
                      style={{
                        position: "absolute",
                        top: "6px",
                        right: "6px",
                        background: "rgba(15, 23, 42, 0.75)",
                        color: "white",
                        border: "none",
                        borderRadius: "50%",
                        width: "24px",
                        height: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                      title="Remove image"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedImages.length < 5 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "14px",
                  marginBottom: "12px",
                }}
              >
                {/* 1. TAKE PHOTO */}
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={isSubmitting}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "20px 16px",
                    border: "2px dashed #818cf8",
                    borderRadius: "14px",
                    background: "#f5f3ff",
                    color: "#4f46e5",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  <Camera size={26} />
                  <strong style={{ fontSize: "14px" }}>Take Photo</strong>
                  <span style={{ fontSize: "11px", color: "#6b7280" }}>
                    Capture live photo with device camera
                  </span>
                </button>

                {/* 2. UPLOAD IMAGE */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "20px 16px",
                    border: "2px dashed #cbd5e1",
                    borderRadius: "14px",
                    background: "#f8fafc",
                    color: "#334155",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  <Upload size={26} />
                  <strong style={{ fontSize: "14px" }}>Upload Image</strong>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    Select PNG, JPG, or WebP from device (up to 10MB)
                  </span>
                </button>

                {/* Hidden file inputs */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  hidden
                  onChange={handleFileChange}
                  disabled={isSubmitting}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={handleFileChange}
                  disabled={isSubmitting}
                />
                <canvas ref={canvasRef} style={{ display: "none" }} />
              </div>
            )}
          </section>

          {/* Submit Actions */}
          <div className="form-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={onBack}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button type="submit" className="submit-button" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  {submitProgress || "Submitting..."}
                </>
              ) : (
                <>
                  <Send size={17} />
                  Submit Complaint
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      {/* Interactive Camera Viewfinder Modal */}
      {isCameraActive && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#0f172a",
              color: "white",
              borderRadius: "20px",
              padding: "20px",
              width: "100%",
              maxWidth: "520px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Camera size={20} color="#818cf8" />
                <strong style={{ fontSize: "16px" }}>Take Complaint Evidence Photo</strong>
              </div>
              <button
                type="button"
                onClick={stopCamera}
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "none",
                  color: "white",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                position: "relative",
                borderRadius: "14px",
                overflow: "hidden",
                background: "#000",
                aspectRatio: "4/3",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={stopCamera}
                style={{
                  padding: "10px 18px",
                  borderRadius: "10px",
                  border: "1px solid #334155",
                  background: "transparent",
                  color: "#cbd5e1",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={capturePhoto}
                disabled={isCapturing}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 22px",
                  borderRadius: "10px",
                  border: "none",
                  background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                <Camera size={18} />
                {isCapturing ? "Capturing..." : "Capture Photo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}