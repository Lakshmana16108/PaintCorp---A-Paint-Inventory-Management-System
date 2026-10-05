import React, { useState, useEffect, useContext, useMemo } from "react";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../services/api";

export default function UserManagement() {
  const { currentUser } = useContext(AuthContext);
  const { showToast } = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("ALL");

  // Edit Modal State
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    mobile: "",
    role: "Staff",
    isActive: true
  });
  const [saving, setSaving] = useState(false);

  // Fetch users on mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/admin/users");
      if (res && res.success) {
        setUsers(res.users || []);
      } else {
        showToast(res?.error || "Failed to load users.", "danger");
      }
    } catch (err) {
      console.error("Load users error:", err);
      showToast(err.message || "Failed to load users from server.", "danger");
    } finally {
      setLoading(false);
    }
  };

  // Filtered users calculation
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.mobile && u.mobile.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q));

      const matchesRole = selectedRole === "ALL" || u.role === selectedRole;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, selectedRole]);

  // Open edit modal
  const handleEditClick = (u) => {
    setEditingUser(u);
    setEditForm({
      name: u.name || "",
      mobile: u.mobile || "",
      role: u.role || "Staff",
      isActive: u.isActive !== false
    });
  };

  // Close edit modal
  const handleCloseModal = () => {
    setEditingUser(null);
  };

  // Handle edit form submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.mobile.trim()) {
      showToast("Name and Mobile are required.", "danger");
      return;
    }

    try {
      setSaving(true);
      const res = await api.put(`/api/admin/users/${editingUser.id}`, editForm);
      if (res && res.success) {
        showToast(res.message || "User updated successfully.", "success");
        setUsers((prev) =>
          prev.map((u) =>
            u.id === editingUser.id
              ? {
                  ...u,
                  name: editForm.name,
                  mobile: editForm.mobile,
                  role: editForm.role,
                  isActive: editForm.isActive
                }
              : u
          )
        );
        handleCloseModal();
      } else {
        showToast(res?.error || "Failed to update user.", "danger");
      }
    } catch (err) {
      console.error("Update user error:", err);
      showToast(err.message || "Failed to save user updates.", "danger");
    } finally {
      setSaving(false);
    }
  };

  // Toggle user active status directly
  const handleToggleStatus = async (user) => {
    if (Number(currentUser?.id) === Number(user.id)) {
      showToast("You cannot deactivate your own Administrator account.", "warning");
      return;
    }

    const nextState = !user.isActive;
    try {
      const res = await api.patch(`/api/admin/users/${user.id}/status`, {
        isActive: nextState
      });
      if (res && res.success) {
        showToast(res.message, "success");
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, isActive: nextState } : u))
        );
      } else {
        showToast(res?.error || "Failed to update status.", "danger");
      }
    } catch (err) {
      console.error("Toggle status error:", err);
      showToast(err.message || "Status update failed.", "danger");
    }
  };

  const getRoleBadge = (role) => {
    if (role === "Administrator") return "badge-info";
    if (role === "Warehouse Manager") return "badge-warning";
    return "badge-success";
  };

  return (
    <div id="admin-user-management-page" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div className="page-title">
          <h1>User Management</h1>
          <p>Supervise user credentials, roles, and security authorization for PaintCorp ERP.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadUsers} disabled={loading} id="refresh-users-btn">
          {loading ? "Refreshing..." : "↻ Refresh List"}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", justifyContent: "space-between" }}>
          {/* Search Box */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: "1 1 280px" }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search by name, email, mobile or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="search-users-input"
              style={{ width: "100%" }}
            />
          </div>

          {/* Role Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>Filter Role:</label>
            <select
              className="select-input"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              id="filter-role-select"
              style={{ padding: "0.45rem 1.75rem 0.45rem 0.75rem", fontSize: "0.875rem" }}
            >
              <option value="ALL">All Roles</option>
              <option value="Administrator">Administrator</option>
              <option value="Warehouse Manager">Warehouse Manager</option>
              <option value="Staff">Staff</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-container" style={{ border: "none", boxShadow: "none", margin: 0 }}>
          <table className="erp-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>User Details</th>
                <th>Contact</th>
                <th>Assigned Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                    Loading user registry from database...
                  </td>
                </tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((u) => {
                  const isSelf = Number(currentUser?.id) === Number(u.id);
                  return (
                    <tr key={u.id} style={{ opacity: u.isActive === false ? 0.6 : 1 }}>
                      <td style={{ fontWeight: 600 }}>#{u.id}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <div
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              backgroundColor: "var(--primary)",
                              color: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 600,
                              fontSize: "0.8rem",
                              flexShrink: 0
                            }}
                          >
                            {(u.name || "U").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
                              {u.name} {isSelf && <span style={{ fontSize: "0.7rem", color: "var(--primary)" }}>(You)</span>}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: "0.85rem" }}>{u.mobile || "—"}</td>
                      <td>
                        <span className={`badge ${getRoleBadge(u.role)}`}>{u.role}</span>
                      </td>
                      <td>
                        <span
                          className={`badge ${u.isActive !== false ? "badge-success" : "badge-danger"}`}
                          style={{ cursor: isSelf ? "default" : "pointer" }}
                          onClick={() => !isSelf && handleToggleStatus(u)}
                          title={isSelf ? "Self account" : "Click to toggle status"}
                        >
                          {u.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN") : "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleEditClick(u)}
                            id={`edit-user-${u.id}`}
                            style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                          >
                            Edit
                          </button>
                          {!isSelf && (
                            <button
                              className={`btn ${u.isActive !== false ? "btn-danger" : "btn-secondary"} btn-sm`}
                              onClick={() => handleToggleStatus(u)}
                              id={`toggle-status-${u.id}`}
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                            >
                              {u.isActive !== false ? "Deactivate" : "Activate"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                    No users matching the current criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: "1rem"
          }}
          onClick={handleCloseModal}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: "480px", margin: 0, boxShadow: "var(--shadow-lg)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "1.1rem", margin: 0 }}>Edit User #{editingUser.id}</h2>
              <button
                type="button"
                onClick={handleCloseModal}
                style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Email Address (Read-only)</label>
                <input
                  type="email"
                  className="form-input"
                  value={editingUser.email}
                  disabled
                  style={{ backgroundColor: "var(--bg-main)", cursor: "not-allowed" }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Mobile Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.mobile}
                  onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">System Role</label>
                <select
                  className="select-input w-full"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  style={{ padding: "0.625rem 2rem 0.625rem 0.75rem" }}
                >
                  <option value="Administrator">Administrator</option>
                  <option value="Warehouse Manager">Warehouse Manager</option>
                  <option value="Staff">Staff</option>
                </select>
              </div>

              {Number(currentUser?.id) !== Number(editingUser.id) && (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-checkbox">
                    <input
                      type="checkbox"
                      checked={editForm.isActive}
                      onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    />
                    <span>Account Active</span>
                  </label>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
