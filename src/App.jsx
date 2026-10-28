import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import ListIcon from './assets/files.png';
import clock from './assets/clock.png';
import group from './assets/group.png';
import tick from './assets/checkmark.png';
import dcross from './assets/delete.png';
import bin from './assets/bin.png';
import loop from './assets/loop.png';
import "./App.css";

const API_URL = "http://localhost:5000/api";

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

async function readError(response) {
  const data = await response.json().catch(() => ({}));
  return data.message || "Something went wrong. Please try again.";
}

// Shared header and footer
function Layout({ children }) {
  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <Link to="/" className="brand">
            <div className="brand-icon">A+</div>
            <div>
              <h1>Attendly</h1>
              <p>Attendance Register</p>
            </div>
          </Link>

          <span className="header-badge">Daily Attendance</span>
        </div>
      </header>

      <nav className="navigation">
        <div className="nav-content">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `nav-link ${isActive ? "active" : ""}`
            }
          >
            <span><img src={ListIcon} alt="attendance register" style={{ height: '18px' }} /></span> Attendance Register
          </NavLink>

          <NavLink
            to="/history"
            className={({ isActive }) =>
              `nav-link ${isActive ? "active" : ""}`
            }
          >
            <span><img src={clock} alt="attendance history" style={{ height: '18px' }} /></span> Attendance History
          </NavLink>
        </div>
      </nav>

      {children}

      <footer className="footer">
        <p>© {new Date().getFullYear()} Attendly. All rights reserved.</p>
        <p>Simple attendance. Better organization.</p>
      </footer>
    </div>
  );
}

// Attendance Register page
function RegisterPage() {
  const [members, setMembers] = useState([]);
  const [newName, setNewName] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingIds, setSavingIds] = useState([]);

  async function loadMembers() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/members`);

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setMembers(await response.json());
    } catch (err) {
      setError(err.message || "Unable to load members.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMembers();
  }, []);

  const presentCount = members.filter(
    (member) => member.status === "Present"
  ).length;

  const absentCount = members.length - presentCount;

  async function addMember(event) {
    event.preventDefault();

    const name = newName.trim();
    if (!name) return;

    setError("");

    try {
      const response = await fetch(`${API_URL}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const member = await response.json();

      setMembers((prev) => [...prev, member]);
      setNewName("");
    } catch (err) {
      setError(err.message || "Unable to add member.");
    }
  }

  async function toggleAttendance(member) {
    if (savingIds.includes(member.id)) return;

    const nextStatus =
      member.status === "Present" ? "Absent" : "Present";

    setSavingIds((prev) => [...prev, member.id]);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/members/${member.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: nextStatus,
            attendance_date: getToday(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const updated = await response.json();

      setMembers((prev) =>
        prev.map((item) =>
          item.id === updated.id
            ? { ...item, status: updated.status }
            : item
        )
      );
    } catch (err) {
      setError(err.message || "Unable to update attendance.");
    } finally {
      setSavingIds((prev) =>
        prev.filter((id) => id !== member.id)
      );
    }
  }

  function toggleSelection(id) {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((selectedId) => selectedId !== id)
        : [...prev, id]
    );
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      members.length > 0 && prev.length === members.length
        ? []
        : members.map((member) => member.id)
    );
  }

  async function deleteSelected() {
    if (selectedIds.length === 0) return;

    const idsToDelete = [...selectedIds];
    setError("");

    try {
      const response = await fetch(`${API_URL}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: idsToDelete }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setMembers((prev) =>
        prev.filter((member) => !idsToDelete.includes(member.id))
      );
      setSelectedIds([]);
    } catch (err) {
      setError(err.message || "Unable to delete members.");
    }
  }

  async function deleteOne(id) {
    setError("");

    try {
      const response = await fetch(`${API_URL}/members/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setMembers((prev) => prev.filter((member) => member.id !== id));
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    } catch (err) {
      setError(err.message || "Unable to delete member.");
    }
  }

  return (
    <main className="main-content">
      <section className="page-heading">
        <div>
          <p className="eyebrow">MANAGEMENT</p>
          <h2>Attendance Register</h2>
          <p className="subtitle">
            Manage your daily attendance in one place.
          </p>
        </div>

        <div className="date-card">
          <span>Today's Date</span>
          <strong>
            {new Date().toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </strong>
        </div>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon total-icon"><img src={group} alt="total" style={{ height: '18px' }} /></div>
          <div>
            <p>Total Members</p>
            <h3>{members.length}</h3>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon present-icon"><img src={tick} alt="present" style={{ height: '16px' }} /></div>
          <div>
            <p>Present</p>
            <h3>{presentCount}</h3>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon absent-icon"><img src={dcross} alt="absent" style={{ height: '18px' }} /></div>
          <div>
            <p>Absent</p>
            <h3>{absentCount}</h3>
          </div>
        </div>
      </section>

      <section className="attendance-card">
        <div className="card-heading">
          <div>
            <h3>Member Attendance</h3>
            <p>Mark each member as present or absent.</p>
          </div>
          <span className="member-count">{members.length} Members</span>
        </div>

        <form className="add-form" onSubmit={addMember}>
          <input
            type="text"
            placeholder="Enter member name..."
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            maxLength={100}
            aria-label="Member name"
          />
          <button className="add-button" type="submit">
            <span>＋</span> Add Name
          </button>
        </form>

        {error && <p className="error-message" role="alert">{error}</p>}

        <div className="table-toolbar">
          <span>
            {selectedIds.length
              ? `${selectedIds.length} selected`
              : "Attendance list"}
          </span>

          <button
            className="delete-button"
            type="button"
            onClick={deleteSelected}
            disabled={selectedIds.length === 0}
          >
            <img src={bin} alt="delete" style={{ height: '17px' }} /> Delete Selected
          </button>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th className="checkbox-column">
                  <input
                    type="checkbox"
                    checked={
                      members.length > 0 &&
                      selectedIds.length === members.length
                    }
                    onChange={toggleSelectAll}
                    aria-label="Select all members"
                  />
                </th>
                <th className="number-column">No.</th>
                <th>Name</th>
                <th className="attendance-column">Attendance</th>
                <th className="action-column">Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="empty-state">
                    Loading attendance records...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-state">
                    <div className="empty-icon"><img src={group} alt="total" style={{ height: '28px' }} /></div>
                    <strong>No members added yet</strong>
                    <p>Add a name above to get started.</p>
                  </td>
                </tr>
              ) : (
                members.map((member, index) => (
                  <tr key={member.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(member.id)}
                        onChange={() => toggleSelection(member.id)}
                        aria-label={`Select ${member.name}`}
                      />
                    </td>

                    <td className="number-cell">
                      {String(index + 1).padStart(2, "0")}
                    </td>

                    <td>
                      <div className="member-name">
                        <div className="avatar">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <span>{member.name}</span>
                      </div>
                    </td>

                    <td>
                      <button
                        type="button"
                        disabled={savingIds.includes(member.id)}
                        className={`attendance-toggle ${member.status === "Present"
                            ? "is-present"
                            : "is-absent"
                          }`}
                        onClick={() => toggleAttendance(member)}
                        aria-label={`Change ${member.name} attendance`}
                      >
                        <span className="status-dot" />
                        {savingIds.includes(member.id)
                          ? "Saving..."
                          : member.status}
                        <span className="toggle-arrow"><img src={loop} alt="reload" style={{ height: '18px' }} /></span>
                      </button>
                    </td>

                    <td>
                      <button
                        className="icon-delete"
                        type="button"
                        onClick={() => deleteOne(member.id)}
                        aria-label={`Delete ${member.name}`}
                        title="Delete member and attendance history"
                      >
                        <img src={bin} alt="delete" style={{ height: '20px' }} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span>
            Showing <strong>{members.length}</strong> members
          </span>
          <span className="footer-hint">
            Click a status to change attendance
          </span>
        </div>
      </section>
    </main>
  );
}

// Attendance History page
function HistoryPage() {
  const [history, setHistory] = useState({ dates: [], members: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_URL}/attendance/history`);

        if (!response.ok) {
          throw new Error(await readError(response));
        }

        setHistory(await response.json());
      } catch (err) {
        setError(err.message || "Unable to load attendance history.");
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  return (
    <main className="main-content">
      <section className="page-heading">
        <div>
          <p className="eyebrow">REPORTS</p>
          <h2>Attendance History</h2>
          <p className="subtitle">
            Review each member's attendance over the last five calendar days.
          </p>
        </div>

        <div className="date-card">
          <span>Today's Date</span>
          <strong>{formatDate(getToday())}</strong>
        </div>
      </section>

      <section className="attendance-card">
        <div className="card-heading">
          <div>
            <h3>Last Five Days</h3>
            <p>Today's status and the four preceding calendar days.</p>
          </div>
          <span className="member-count">
            {history.members.length} Members
          </span>
        </div>

        {error && <p className="error-message" role="alert">{error}</p>}

        <div className="history-legend">
          <span><i className="legend-dot legend-present" /> Present</span>
          <span><i className="legend-dot legend-absent" /> Absent</span>
          <span><i className="legend-dot legend-na" /> Not joined</span>
        </div>

        <div className="table-wrapper history-table-wrapper">
          <table className="history-table">
            <thead>
              <tr>
                <th className="history-name-column">Name</th>
                {history.dates.map((date) => (
                  <th key={date} className="history-date-column">
                    <span>{formatDate(date)}</span>
                    {date === getToday() && (
                      <span className="today-label">Today</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    Loading attendance history...
                  </td>
                </tr>
              ) : history.members.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    <div className="empty-icon"><img src={clock} alt="attendance history" style={{ height: '32px' }} /></div>
                    <strong>No attendance history available</strong>
                    <p>Add members in the attendance register to begin.</p>
                  </td>
                </tr>
              ) : (
                history.members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="member-name history-member-name">
                        <div className="avatar">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <span>{member.name}</span>
                      </div>
                    </td>

                    {history.dates.map((date) => {
                      const status = member.attendance[date];

                      return (
                        <td key={date} className="history-status-cell">
                          {status === null ? (
                            <span className="history-na">—</span>
                          ) : (
                            <span
                              className={`history-status ${status === "Present"
                                  ? "history-is-present"
                                  : "history-is-absent"
                                }`}
                            >
                              {status}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span>
            Showing <strong>{history.members.length}</strong> members
          </span>
          <span className="footer-hint">
            Historical records are saved by date
          </span>
        </div>
      </section>
    </main>
  );
}

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<RegisterPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
