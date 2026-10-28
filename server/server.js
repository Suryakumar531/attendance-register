
const express = require("express");
const Database = require("better-sqlite3");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// SQLite database
const db = new Database(
    path.join(__dirname, "attendance.db")
);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Get today's date in local server time (YYYY-MM-DD)
function getLocalDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// Validate date strings
function isValidDate(value) {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return false;
    }

    const date = new Date(`${value}T00:00:00Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
}

// Generate the latest five calendar dates, including today
function getLastFiveDates() {
    const today = new Date();
    const dates = [];

    for (let i = 4; i >= 0; i--) {
        const date = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() - i
        );

        dates.push(getLocalDate(date));
    }

    return dates;
}

// Create database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_date TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    attendance_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Absent'
      CHECK(status IN ('Present', 'Absent')),

    FOREIGN KEY (member_id)
      REFERENCES members(id)
      ON DELETE CASCADE,

    UNIQUE(member_id, attendance_date)
  );
`);

// Reusable database statements
const insertAbsent = db.prepare(`
  INSERT OR IGNORE INTO attendance
    (member_id, attendance_date, status)
  VALUES (?, ?, 'Absent')
`);

const getMembersForDate = db.prepare(`
  SELECT
    m.id,
    m.name,
    m.created_date,
    COALESCE(a.status, 'Absent') AS status
  FROM members AS m
  LEFT JOIN attendance AS a
    ON a.member_id = m.id
    AND a.attendance_date = ?
  ORDER BY m.id ASC
`);

// Ensure every existing member has a record for today
const ensureTodayRecords = db.transaction((date) => {
    const members = db.prepare(`
    SELECT id FROM members
  `).all();

    for (const member of members) {
        insertAbsent.run(member.id, date);
    }
});

// GET: Today's attendance register
app.get("/api/members", (req, res) => {
    const today = getLocalDate();

    ensureTodayRecords(today);

    res.json(getMembersForDate.all(today));
});

// POST: Add a member, default today's status to Absent
app.post("/api/members", (req, res) => {
    const name =
        typeof req.body.name === "string"
            ? req.body.name.trim()
            : "";

    if (!name) {
        return res.status(400).json({
            message: "Name is required",
        });
    }

    if (name.length > 100) {
        return res.status(400).json({
            message: "Name must be 100 characters or fewer",
        });
    }

    const today = getLocalDate();

    const addMember = db.transaction(() => {
        const result = db.prepare(`
      INSERT INTO members (name, created_date)
      VALUES (?, ?)
    `).run(name, today);

        const id = Number(result.lastInsertRowid);

        insertAbsent.run(id, today);

        return db.prepare(`
        SELECT
            m.id,
            m.name,
            m.created_date,
            COALESCE(a.status, 'Absent') AS status
        FROM members AS m
        LEFT JOIN attendance AS a
            ON a.member_id = m.id
            AND a.attendance_date = ?
        WHERE m.id = ?
        `).get(today, id);
    });

    // The query above takes the date as its first parameter.
    // Fetch the newly inserted member after the transaction.
    try {
        const created = addMember();

        res.status(201).json({
            id: created.id,
            name: created.name,
            created_date: created.created_date,
            status: created.status,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Could not add member",
        });
    }
});

// PATCH: Save attendance for a specific date
app.patch("/api/members/:id", (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body;

    const date = req.body.attendance_date || getLocalDate();

    if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
            message: "Invalid member ID",
        });
    }

    if (!["Present", "Absent"].includes(status)) {
        return res.status(400).json({
            message: "Status must be Present or Absent",
        });
    }

    if (!isValidDate(date)) {
        return res.status(400).json({
            message: "Invalid attendance date",
        });
    }

    const member = db.prepare(`
    SELECT id, name, created_date
    FROM members
    WHERE id = ?
  `).get(id);

    if (!member) {
        return res.status(404).json({
            message: "Member not found",
        });
    }

    if (date < member.created_date) {
        return res.status(400).json({
            message: "Attendance cannot be recorded before joining",
        });
    }

    db.prepare(`
    INSERT INTO attendance
      (member_id, attendance_date, status)
    VALUES (?, ?, ?)
    ON CONFLICT(member_id, attendance_date)
    DO UPDATE SET status = excluded.status
  `).run(id, date, status);

    res.json({
        id: member.id,
        name: member.name,
        attendance_date: date,
        status,
    });
});

// GET: Attendance history for the last five calendar days
app.get("/api/attendance/history", (req, res) => {
    const dates = getLastFiveDates();

    const members = db.prepare(`
    SELECT id, name, created_date
    FROM members
    ORDER BY id ASC
  `).all();

    const records = db.prepare(`
    SELECT member_id, attendance_date, status
    FROM attendance
    WHERE attendance_date BETWEEN ? AND ?
  `).all(dates[0], dates[4]);

    const recordMap = new Map();

    for (const record of records) {
        recordMap.set(
            `${record.member_id}:${record.attendance_date}`,
            record.status
        );
    }

    const history = members.map((member) => {
        const attendance = {};

        for (const date of dates) {
            if (date < member.created_date) {
                attendance[date] = null;
            } else {
                attendance[date] =
                    recordMap.get(`${member.id}:${date}`) || "Absent";
            }
        }

        return {
            id: member.id,
            name: member.name,
            created_date: member.created_date,
            attendance,
        };
    });

    res.json({ dates, members: history });
});

// DELETE: Delete one member and their attendance history
app.delete("/api/members/:id", (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
            message: "Invalid member ID",
        });
    }

    const result = db.prepare(`
    DELETE FROM members WHERE id = ?
  `).run(id);

    if (!result.changes) {
        return res.status(404).json({
            message: "Member not found",
        });
    }

    res.status(204).end();
});

// DELETE: Delete selected members
app.delete("/api/members", (req, res) => {
    const { ids } = req.body || {};

    if (
        !Array.isArray(ids) ||
        ids.length === 0 ||
        ids.some(
            (id) => !Number.isSafeInteger(id) || id <= 0
        )
    ) {
        return res.status(400).json({
            message: "Provide a valid list of member IDs",
        });
    }

    const removeMembers = db.transaction((memberIds) => {
        const remove = db.prepare(`
      DELETE FROM members WHERE id = ?
    `);

        for (const id of new Set(memberIds)) {
            remove.run(id);
        }
    });

    removeMembers(ids);

    res.status(204).end();
});

// Start server
app.listen(PORT, () => {
    console.log(`Attendance API is currently running at http://localhost:${PORT}`);
});
