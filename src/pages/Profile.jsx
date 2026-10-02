import React, { useContext, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../services/api";

export default function Profile() {
  const { currentUser, logout, updateUser } = useContext(AuthContext);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const fileInputRef = useRef(null);

  // Form states
  const [fullName, setFullName] = useState(currentUser?.name || "");
  const [email, setEmail] = useState(currentUser?.email || "");
  const [mobile, setMobile] = useState(currentUser?.mobile || "");
  const [username, setUsername] = useState(currentUser?.username || "");
  const [avatar, setAvatar] = useState(currentUser?.avatar || "");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(currentUser?.twoFactorEnabled || false);

  // Password change states
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Error states
  const [errors, setErrors] = useState({});
  const [securityErrors, setSecurityErrors] = useState({});

  if (!currentUser) return null;

  // Handle Profile Photo Upload
  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast("Image size must be less than 2MB.", "danger");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        setAvatar(base64String);
        // Automatically save avatar when updated
        updateUser({ avatar: base64String });
        showToast("Profile photo updated successfully.", "success");
      };
      reader.readAsDataURL(file);
    }
  };

  // Validate personal info fields
  const validateProfileForm = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9]{10,14}$/;

    if (!fullName.trim()) newErrors.fullName = "Full name is required.";
    if (!username.trim()) newErrors.username = "Username is required.";
    
    if (!email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = "Enter a valid email address.";
    }

    if (!mobile.trim()) {
      newErrors.mobile = "Phone number is required.";
    } else if (!phoneRegex.test(mobile.replace(/\s+/g, ""))) {
      newErrors.mobile = "Enter a valid phone number (10-14 digits).";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save profile changes
  const handleSaveChanges = (e) => {
    e.preventDefault();
    if (!validateProfileForm()) {
      showToast("Please correct the validation errors.", "danger");
      return;
    }

    // Save changes using the context method
    const result = updateUser({
      name: fullName,
      email: email,
      mobile: mobile,
      username: username,
      twoFactorEnabled: twoFactorEnabled
    });

    if (result.success) {
      showToast("Profile updated successfully.", "success");
    } else {
      showToast(result.message || "Failed to update profile.", "danger");
    }
  };

  // Validate and submit password change
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const newSecErrors = {};

    if (!currentPassword) newSecErrors.currentPassword = "Current password is required.";
    if (newPassword.length < 6) newSecErrors.newPassword = "Password must be at least 6 characters.";
    if (newPassword !== confirmPassword) newSecErrors.confirmPassword = "Passwords do not match.";

    if (Object.keys(newSecErrors).length > 0) {
      setSecurityErrors(newSecErrors);
      return;
    }

    try {
      const result = await api.post("/api/auth/change-password", {
        currentPassword,
        newPassword
      });

      if (result.success) {
        // Clear form and close section
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setSecurityErrors({});
        setShowPasswordChange(false);
        showToast("Password updated successfully.", "success");
      } else {
        showToast(result.error || "Failed to update password.", "danger");
      }
    } catch (error) {
      setSecurityErrors({ currentPassword: error.message || "Failed to update password." });
      showToast(error.message || "Failed to update password.", "danger");
    }
  };


  const handleLogoutClick = () => {
    logout();
    navigate("/login");
  };

  return (
    <div id="profile-page" style={{ maxWidth: "1200px", margin: "0 auto", padding: "1rem" }}>
      {/* Header */}
      <div className="page-header">
        <div className="page-title">
          <h1>Profile Settings</h1>
          <p>Manage your personal account details, security credentials, and authentication preferences</p>
        </div>
      </div>

      {/* Main Grid: Left and Right columns */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", marginTop: "1rem" }}>
        
        {/* Left Column: Avatar Card & Actions Card */}
        <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Profile Photo Card */}
          <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "2rem", textAlign: "center" }}>
            <h3 className="card-title" style={{ width: "100%", textAlign: "left", marginBottom: "1.5rem" }}>Profile Photo</h3>
            
            <div style={{ position: "relative", marginBottom: "1.5rem" }}>
              {avatar ? (
                <img 
                  src={avatar} 
                  alt="Profile Avatar" 
                  style={{ width: "120px", height: "120px", borderRadius: "50%", objectFit: "cover", border: "3px solid var(--border-color)" }} 
                />
              ) : (
                <div style={{
                  width: "120px",
                  height: "120px",
                  borderRadius: "50%",
                  backgroundColor: "var(--primary)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "3.5rem",
                  fontWeight: 700,
                  border: "3px solid var(--border-color)"
                }}>
                  {fullName.charAt(0)}
                </div>
              )}
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: "none" }} 
              accept="image/*" 
              onChange={handleFileChange}
            />

            <button className="btn btn-secondary btn-sm" onClick={handlePhotoClick} id="change-photo-btn">
              Change Photo
            </button>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.75rem" }}>
              JPG or PNG formats supported. Max size 2MB.
            </p>
          </div>

          {/* Account Actions Card */}
          <div className="card" style={{ padding: "1.5rem" }}>
            <h3 className="card-title" style={{ marginBottom: "1rem" }}>Account Actions</h3>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
              Safely end your session and log out of the Paintcorp ERP system.
            </p>
            <button 
              className="btn btn-danger w-full" 
              onClick={handleLogoutClick} 
              id="profile-logout-action-btn"
              style={{ padding: "0.75rem" }}
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "0.5rem" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Log Out Account
            </button>
          </div>
        </div>

        {/* Right Column: Personal Information & Security */}
        <div style={{ flex: "2 2 600px", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* Personal Information Card */}
          <div className="card" id="profile-info-card">
            <h3 className="card-title" style={{ marginBottom: "1.5rem" }}>Personal Information</h3>
            
            <form onSubmit={handleSaveChanges} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div className="form-group row">
                <div>
                  <label className="form-label" htmlFor="profile-fullname">Full Name</label>
                  <input
                    type="text"
                    id="profile-fullname"
                    className={`form-input ${errors.fullName ? "error" : ""}`}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="E.g. Lakshmana Perumal"
                  />
                  {errors.fullName && <div className="form-error">{errors.fullName}</div>}
                </div>
                <div>
                  <label className="form-label" htmlFor="profile-username">Username</label>
                  <input
                    type="text"
                    id="profile-username"
                    className={`form-input ${errors.username ? "error" : ""}`}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="E.g. lperumal"
                  />
                  {errors.username && <div className="form-error">{errors.username}</div>}
                </div>
              </div>

              <div className="form-group row">
                <div>
                  <label className="form-label" htmlFor="profile-email">Email Address</label>
                  <input
                    type="email"
                    id="profile-email"
                    className={`form-input ${errors.email ? "error" : ""}`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@email.com"
                  />
                  {errors.email && <div className="form-error">{errors.email}</div>}
                </div>
                <div>
                  <label className="form-label" htmlFor="profile-phone">Phone Number</label>
                  <input
                    type="text"
                    id="profile-phone"
                    className={`form-input ${errors.mobile ? "error" : ""}`}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                  />
                  {errors.mobile && <div className="form-error">{errors.mobile}</div>}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="profile-role">System Role Permissions</label>
                <input
                  type="text"
                  id="profile-role"
                  className="form-input"
                  value={currentUser.role}
                  disabled
                  style={{ backgroundColor: "var(--bg-sidebar)", color: "var(--text-muted)", cursor: "not-allowed" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
                <button type="submit" className="btn btn-primary" id="profile-save-btn" style={{ padding: "0.625rem 1.5rem" }}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>

          {/* Account Security Card */}
          <div className="card" id="profile-security-card">
            <h3 className="card-title" style={{ marginBottom: "1.5rem" }}>Account Security</h3>
            
            {/* Password Row */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <div>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-main)", display: "block" }}>Password</span>
                  <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>••••••••••••</span>
                </div>
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => setShowPasswordChange(!showPasswordChange)}
                  id="profile-change-password-toggle"
                >
                  {showPasswordChange ? "Cancel" : "Change Password"}
                </button>
              </div>

              {/* Password Change Form (Toggled) */}
              {showPasswordChange && (
                <form onSubmit={handlePasswordSubmit} style={{ 
                  backgroundColor: "var(--bg-sidebar)", 
                  padding: "1.25rem", 
                  borderRadius: "var(--radius-md)", 
                  marginTop: "1rem", 
                  display: "flex", 
                  flexDirection: "column", 
                  gap: "1rem",
                  border: "1px solid var(--border-color)"
                }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="profile-curr-pass">Current Password</label>
                    <input
                      type="password"
                      id="profile-curr-pass"
                      className={`form-input ${securityErrors.currentPassword ? "error" : ""}`}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                    />
                    {securityErrors.currentPassword && <div className="form-error">{securityErrors.currentPassword}</div>}
                  </div>

                  <div className="form-group row" style={{ margin: 0 }}>
                    <div>
                      <label className="form-label" htmlFor="profile-new-pass">New Password</label>
                      <input
                        type="password"
                        id="profile-new-pass"
                        className={`form-input ${securityErrors.newPassword ? "error" : ""}`}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 6 characters"
                      />
                      {securityErrors.newPassword && <div className="form-error">{securityErrors.newPassword}</div>}
                    </div>
                    <div>
                      <label className="form-label" htmlFor="profile-confirm-pass">Confirm Password</label>
                      <input
                        type="password"
                        id="profile-confirm-pass"
                        className={`form-input ${securityErrors.confirmPassword ? "error" : ""}`}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-type new password"
                      />
                      {securityErrors.confirmPassword && <div className="form-error">{securityErrors.confirmPassword}</div>}
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button type="submit" className="btn btn-primary btn-sm" id="profile-update-password-btn" style={{ padding: "0.5rem 1rem" }}>
                      Update Password
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="dropdown-divider" style={{ margin: "1.5rem 0" }}></div>

            {/* Two-Factor Authentication Row */}
            <div className="settings-row" style={{ borderBottom: "none", padding: 0 }}>
              <div className="settings-row-info">
                <span className="settings-row-title">Two-Factor Authentication</span>
                <span className="settings-row-desc">Secure account with OTP tokens sent via authenticator app.</span>
              </div>
              <div className="settings-row-control">
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={twoFactorEnabled}
                    onChange={(e) => {
                      setTwoFactorEnabled(e.target.checked);
                      // Update instantly
                      updateUser({ twoFactorEnabled: e.target.checked });
                      showToast(
                        `Two-factor authentication turned ${e.target.checked ? "ON" : "OFF"}.`,
                        e.target.checked ? "success" : "warning"
                      );
                    }}
                    id="profile-toggle-2fa"
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
