const express = require("express")
const cors = require("cors")
require("dotenv").config()

const db = require("./db")

const app = express()

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(
  cors({
    origin: true,
    credentials: true,
  })
)

app.use(
  express.json()
)

// ======================================================
// BASIC ROUTES
// ======================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message:
      "HostelFix backend is running",
  })
})

// ======================================================
// HEALTH CHECK
// ======================================================

app.get(
  "/api/health",
  async (req, res) => {
    try {
      await db.query(
        "SELECT 1"
      )

      res.json({
        success: true,
        message:
          "HostelFix backend and MySQL are working",
        database: true,
      })
    } catch (error) {
      console.error(
        "Health check error:",
        error
      )

      res.status(500).json({
        success: false,
        message:
          "HostelFix backend is running but MySQL connection failed",
        database: false,
      })
    }
  }
)

// ======================================================
// GET ALL COMPLAINTS
// ======================================================

app.get(
  "/api/complaints",
  async (req, res) => {
    try {
      const [rows] =
        await db.query(
          `
          SELECT
            c.id,
            c.student_id,
            s.name AS student_name,
            c.hostel,
            c.room,
            c.title,
            c.description,
            c.category,
            c.priority,
            c.status,
            c.assigned_staff_id,
            staff.name AS assigned_staff,
            c.created_at,
            c.updated_at,
            c.completed_at
          FROM complaints c
          INNER JOIN users s
            ON c.student_id = s.id
          LEFT JOIN users staff
            ON c.assigned_staff_id = staff.id
          ORDER BY c.created_at DESC
          `
        )

      res.json({
        success: true,
        count: rows.length,
        complaints: rows,
      })
    } catch (error) {
      console.error(
        "Get complaints error:",
        error
      )

      res.status(500).json({
        success: false,
        message:
          "Failed to load complaints",
      })
    }
  }
)

// ======================================================
// GET SINGLE COMPLAINT
// ======================================================

app.get(
  "/api/complaints/:id",
  async (req, res) => {
    try {
      const complaintId =
        Number(req.params.id)

      if (
        !Number.isInteger(
          complaintId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid complaint ID",
        })
      }

      const [rows] =
        await db.query(
          `
          SELECT
            c.id,
            c.student_id,
            s.name AS student_name,
            c.hostel,
            c.room,
            c.title,
            c.description,
            c.category,
            c.priority,
            c.status,
            c.assigned_staff_id,
            staff.name AS assigned_staff,
            c.created_at,
            c.updated_at,
            c.completed_at
          FROM complaints c
          INNER JOIN users s
            ON c.student_id = s.id
          LEFT JOIN users staff
            ON c.assigned_staff_id = staff.id
          WHERE c.id = ?
          `,
          [complaintId]
        )

      if (
        rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Complaint not found",
        })
      }

      res.json({
        success: true,
        complaint: rows[0],
      })
    } catch (error) {
      console.error(
        "Get complaint error:",
        error
      )

      res.status(500).json({
        success: false,
        message:
          "Failed to load complaint",
      })
    }
  }
)

// ======================================================
// CREATE COMPLAINT
// ======================================================

app.post(
  "/api/complaints",
  async (req, res) => {
    try {
      const {
        student_id,
        title,
        description,
        category,
        priority,
        hostel,
        room,
      } = req.body

      if (
        !student_id ||
        !title ||
        !description ||
        !category ||
        !hostel ||
        !room
      ) {
        return res.status(400).json({
          success: false,
          message:
            "student_id, title, description, category, hostel and room are required",
        })
      }

      const allowedCategories = [
        "Electrical",
        "Plumbing",
        "Internet",
        "Cleaning",
        "Furniture",
        "Water Supply",
        "Security",
        "Other",
      ]

      const allowedPriorities = [
        "low",
        "medium",
        "high",
        "urgent",
      ]

      if (
        !allowedCategories.includes(
          category
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid complaint category",
        })
      }

      const finalPriority =
        priority || "medium"

      if (
        !allowedPriorities.includes(
          finalPriority
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid complaint priority",
        })
      }

      // Verify student
      const [studentRows] =
        await db.query(
          `
          SELECT id, name, role
          FROM users
          WHERE id = ?
          `,
          [student_id]
        )

      if (
        studentRows.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Student not found",
        })
      }

      if (
        studentRows[0].role !==
        "student"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Selected user is not a student",
        })
      }

      const [result] =
        await db.query(
          `
          INSERT INTO complaints
          (
            student_id,
            title,
            description,
            category,
            priority,
            status,
            hostel,
            room
          )
          VALUES (?, ?, ?, ?, ?, 'submitted', ?, ?)
          `,
          [
            student_id,
            title.trim(),
            description.trim(),
            category,
            finalPriority,
            hostel.trim(),
            room.trim(),
          ]
        )

      const complaintId =
        result.insertId

      // Return complete complaint
      const [complaintRows] =
        await db.query(
          `
          SELECT
            c.id,
            c.student_id,
            s.name AS student_name,
            c.hostel,
            c.room,
            c.title,
            c.description,
            c.category,
            c.priority,
            c.status,
            c.assigned_staff_id,
            staff.name AS assigned_staff,
            c.created_at,
            c.updated_at,
            c.completed_at
          FROM complaints c
          INNER JOIN users s
            ON c.student_id = s.id
          LEFT JOIN users staff
            ON c.assigned_staff_id = staff.id
          WHERE c.id = ?
          `,
          [complaintId]
        )

      res.status(201).json({
        success: true,
        message:
          "Complaint created successfully",
        complaint:
          complaintRows[0],
      })
    } catch (error) {
      console.error(
        "Create complaint error:",
        error
      )

      res.status(500).json({
        success: false,
        message:
          "Failed to create complaint",
      })
    }
  }
)

// ======================================================
// ASSIGN STAFF
// ======================================================

app.patch(
  "/api/complaints/:id/assign",
  async (req, res) => {
    const connection =
      await db.getConnection()

    try {
      const complaintId =
        Number(req.params.id)

      const {
        staff_id,
        actor_id,
      } = req.body

      if (
        !Number.isInteger(
          complaintId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid complaint ID",
        })
      }

      if (
        !Number.isInteger(
          Number(staff_id)
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Valid staff_id is required",
        })
      }

      if (
        !Number.isInteger(
          Number(actor_id)
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Valid actor_id is required",
        })
      }

      await connection.beginTransaction()

      // ================================================
      // VERIFY ACTOR
      // ================================================

      const [actorRows] =
        await connection.query(
          `
          SELECT
            id,
            name,
            role,
            is_active
          FROM users
          WHERE id = ?
          `,
          [actor_id]
        )

      if (
        actorRows.length === 0
      ) {
        await connection.rollback()

        return res.status(400).json({
          success: false,
          message:
            "Action user not found",
        })
      }

      if (
        !actorRows[0].is_active
      ) {
        await connection.rollback()

        return res.status(400).json({
          success: false,
          message:
            "Action user is inactive",
        })
      }

      // ================================================
      // VERIFY STAFF
      // ================================================

      const [staffRows] =
        await connection.query(
          `
          SELECT
            id,
            name,
            role,
            is_active
          FROM users
          WHERE id = ?
          `,
          [staff_id]
        )

      if (
        staffRows.length === 0
      ) {
        await connection.rollback()

        return res.status(404).json({
          success: false,
          message:
            "Staff member not found",
        })
      }

      if (
        staffRows[0].role !==
        "staff"
      ) {
        await connection.rollback()

        return res.status(400).json({
          success: false,
          message:
            "Selected user is not maintenance staff",
        })
      }

      if (
        !staffRows[0].is_active
      ) {
        await connection.rollback()

        return res.status(400).json({
          success: false,
          message:
            "Selected staff member is inactive",
        })
      }

      // ================================================
      // GET COMPLAINT
      // ================================================

      const [complaintRows] =
        await connection.query(
          `
          SELECT
            id,
            status,
            assigned_staff_id
          FROM complaints
          WHERE id = ?
          FOR UPDATE
          `,
          [complaintId]
        )

      if (
        complaintRows.length === 0
      ) {
        await connection.rollback()

        return res.status(404).json({
          success: false,
          message:
            "Complaint not found",
        })
      }

      const oldStatus =
        complaintRows[0].status

      let newStatus =
        oldStatus

      if (
        oldStatus ===
        "submitted"
      ) {
        newStatus =
          "assigned"
      }

      // ================================================
      // UPDATE COMPLAINT
      // ================================================

      await connection.query(
        `
        UPDATE complaints
        SET
          assigned_staff_id = ?,
          status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [
          staff_id,
          newStatus,
          complaintId,
        ]
      )

      // ================================================
      // ADD AUDIT RECORD
      // ================================================

      await connection.query(
        `
        INSERT INTO complaint_updates
        (
          complaint_id,
          user_id,
          old_status,
          new_status,
          note
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          complaintId,
          actor_id,
          oldStatus,
          newStatus,
          `Complaint assigned to ${staffRows[0].name}`,
        ]
      )

      await connection.commit()

      // ================================================
      // FETCH UPDATED COMPLAINT
      // ================================================

      const [updatedRows] =
        await db.query(
          `
          SELECT
            c.id,
            c.student_id,
            s.name AS student_name,
            c.hostel,
            c.room,
            c.title,
            c.description,
            c.category,
            c.priority,
            c.status,
            c.assigned_staff_id,
            staff.name AS assigned_staff,
            c.created_at,
            c.updated_at,
            c.completed_at
          FROM complaints c
          INNER JOIN users s
            ON c.student_id = s.id
          LEFT JOIN users staff
            ON c.assigned_staff_id = staff.id
          WHERE c.id = ?
          `,
          [complaintId]
        )

      res.json({
        success: true,
        message:
          "Complaint assigned successfully",
        complaint:
          updatedRows[0],
      })
    } catch (error) {
      try {
        await connection.rollback()
      } catch {
        // Ignore rollback error
      }

      console.error(
        "Assign staff error:",
        error
      )

      res.status(500).json({
        success: false,
        message:
          "Failed to assign staff",
      })
    } finally {
      connection.release()
    }
  }
)

// ======================================================
// UPDATE COMPLAINT STATUS
// ======================================================

app.patch(
  "/api/complaints/:id/status",
  async (req, res) => {
    const connection =
      await db.getConnection()

    try {
      const complaintId =
        Number(req.params.id)

      const {
        status,
        actor_id,
      } = req.body

      const allowedStatuses = [
        "submitted",
        "assigned",
        "in-progress",
        "need-material",
        "cannot-complete",
        "resolved",
        "rejected",
      ]

      if (
        !Number.isInteger(
          complaintId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid complaint ID",
        })
      }

      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid complaint status",
        })
      }

      if (
        !Number.isInteger(
          Number(actor_id)
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Valid actor_id is required",
        })
      }

      await connection.beginTransaction()

      // ================================================
      // VERIFY ACTOR
      // ================================================

      const [actorRows] =
        await connection.query(
          `
          SELECT
            id,
            name,
            role,
            is_active
          FROM users
          WHERE id = ?
          `,
          [actor_id]
        )

      if (
        actorRows.length === 0
      ) {
        await connection.rollback()

        return res.status(400).json({
          success: false,
          message:
            "Action user not found",
        })
      }

      if (
        !actorRows[0].is_active
      ) {
        await connection.rollback()

        return res.status(400).json({
          success: false,
          message:
            "Action user is inactive",
        })
      }

      // ================================================
      // GET CURRENT COMPLAINT STATUS
      // ================================================

      const [complaintRows] =
        await connection.query(
          `
          SELECT
            id,
            status
          FROM complaints
          WHERE id = ?
          FOR UPDATE
          `,
          [complaintId]
        )

      if (
        complaintRows.length === 0
      ) {
        await connection.rollback()

        return res.status(404).json({
          success: false,
          message:
            "Complaint not found",
        })
      }

      const oldStatus =
        complaintRows[0].status

      // Don't create duplicate history
      // if status hasn't changed.
      if (
        oldStatus === status
      ) {
        await connection.commit()

        const [sameRows] =
          await db.query(
            `
            SELECT
              c.id,
              c.student_id,
              s.name AS student_name,
              c.hostel,
              c.room,
              c.title,
              c.description,
              c.category,
              c.priority,
              c.status,
              c.assigned_staff_id,
              staff.name AS assigned_staff,
              c.created_at,
              c.updated_at,
              c.completed_at
            FROM complaints c
            INNER JOIN users s
              ON c.student_id = s.id
            LEFT JOIN users staff
              ON c.assigned_staff_id = staff.id
            WHERE c.id = ?
            `,
            [complaintId]
          )

        return res.json({
          success: true,
          message:
            "Complaint status is already set to this value",
          complaint:
            sameRows[0],
        })
      }

      // ================================================
      // COMPLETION TIME
      // ================================================

      let completedAt = null

      if (
        status === "resolved"
      ) {
        completedAt =
          new Date()
      }

      // ================================================
      // UPDATE COMPLAINT
      // ================================================

      await connection.query(
        `
        UPDATE complaints
        SET
          status = ?,
          updated_at = CURRENT_TIMESTAMP,
          completed_at = ?
        WHERE id = ?
        `,
        [
          status,
          completedAt,
          complaintId,
        ]
      )

      // ================================================
      // STATUS NOTE
      // ================================================

      const statusNotes = {
        submitted:
          "Complaint status changed to submitted.",
        assigned:
          "Complaint status changed to assigned.",
        "in-progress":
          "Worker started working on the complaint.",
        "need-material":
          "Worker needs material before completing the job.",
        "cannot-complete":
          "Worker reported that the job cannot be completed.",
        resolved:
          "Worker completed the maintenance job.",
        rejected:
          "Complaint was rejected.",
      }

      const note =
        statusNotes[status] ||
        `Complaint status changed to ${status}.`

      // ================================================
      // ADD AUDIT RECORD
      // ================================================

      await connection.query(
        `
        INSERT INTO complaint_updates
        (
          complaint_id,
          user_id,
          old_status,
          new_status,
          note
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          complaintId,
          actor_id,
          oldStatus,
          status,
          note,
        ]
      )

      await connection.commit()

      // ================================================
      // FETCH UPDATED COMPLAINT
      // ================================================

      const [updatedRows] =
        await db.query(
          `
          SELECT
            c.id,
            c.student_id,
            s.name AS student_name,
            c.hostel,
            c.room,
            c.title,
            c.description,
            c.category,
            c.priority,
            c.status,
            c.assigned_staff_id,
            staff.name AS assigned_staff,
            c.created_at,
            c.updated_at,
            c.completed_at
          FROM complaints c
          INNER JOIN users s
            ON c.student_id = s.id
          LEFT JOIN users staff
            ON c.assigned_staff_id = staff.id
          WHERE c.id = ?
          `,
          [complaintId]
        )

      res.json({
        success: true,
        message:
          "Complaint status updated successfully",
        complaint:
          updatedRows[0],
      })
    } catch (error) {
      try {
        await connection.rollback()
      } catch {
        // Ignore rollback error
      }

      console.error(
        "Status update error:",
        error
      )

      res.status(500).json({
        success: false,
        message:
          "Failed to update complaint status",
      })
    } finally {
      connection.release()
    }
  }
)

// ======================================================
// GET COMPLAINT HISTORY / TIMELINE
// ======================================================

app.get(
  "/api/complaints/:id/updates",
  async (req, res) => {
    try {
      const complaintId =
        Number(req.params.id)

      if (
        !Number.isInteger(
          complaintId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid complaint ID",
        })
      }

      // Check complaint exists
      const [complaintRows] =
        await db.query(
          `
          SELECT id
          FROM complaints
          WHERE id = ?
          `,
          [complaintId]
        )

      if (
        complaintRows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Complaint not found",
        })
      }

      const [updates] =
        await db.query(
          `
          SELECT
            cu.id,
            cu.complaint_id,
            cu.user_id,
            cu.old_status,
            cu.new_status,
            cu.note,
            cu.created_at,
            u.name AS user_name,
            u.role AS user_role
          FROM complaint_updates cu
          LEFT JOIN users u
            ON cu.user_id = u.id
          WHERE cu.complaint_id = ?
          ORDER BY cu.created_at ASC, cu.id ASC
          `,
          [complaintId]
        )

      res.json({
        success: true,
        count: updates.length,
        updates,
      })
    } catch (error) {
      console.error(
        "Get complaint history error:",
        error
      )

      res.status(500).json({
        success: false,
        message:
          "Failed to load complaint history",
      })
    }
  }
)

// ======================================================
// 404 HANDLER
// ======================================================

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,
      message:
        "API route not found",
    })
  }
)

// ======================================================
// ERROR HANDLER
// ======================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "Unhandled server error:",
      error
    )

    res.status(500).json({
      success: false,
      message:
        "Internal server error",
    })
  }
)

// ======================================================
// START SERVER
// ======================================================

const PORT =
  Number(
    process.env.PORT
  ) || 5000

app.listen(
  PORT,
  () => {
    console.log(
      `HostelFix backend running on port ${PORT}`
    )
  }
)