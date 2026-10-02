import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { api } from "../services/api";

export default function ResetPassword() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const resetToken = location.state?.resetToken || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const passwordInputRef = useRef(null);

  // Redirect to forgot-password if token is missing
  useEffect(() => {
    if (!resetToken) {
      showToast("Access unauthorized. Please complete verification first.", "warning");
      navigate("/forgot-password");
    } else {
      passwordInputRef.current?.focus();
    }
  }, [resetToken, navigate]);

  const validate = () => {
    const newErrors = {};

    if (!password) {
      newErrors.password = "New password is required.";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters.";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Confirm password is required.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const result = await api.post("/api/auth/reset-password", {
        password,
        token: resetToken
      });

      if (result.success) {
        setIsSuccess(true);
        showToast("Your password has been reset successfully.", "success");
      } else {
        showToast(result.error || "Failed to reset password.", "danger");
        setErrors({ form: result.error });
      }
    } catch (error) {
      showToast(error.message || "Failed to reset password.", "danger");
      setErrors({ form: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center", padding: "2.5rem 2rem" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            backgroundColor: "rgba(72, 187, 120, 0.1)",
            color: "var(--success)",
            marginBottom: "1.5rem"
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{ marginBottom: "0.75rem" }}>Reset Complete</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", lineHeight: "1.6", marginBottom: "2rem" }}>
            Your account credentials have been successfully updated. You can now use your new password to access PaintCorp ERP.
          </p>
          <Link to="/login" className="btn btn-primary w-full" id="reset-success-login-btn" style={{ display: "block", textDecoration: "none" }}>
            Return to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19L12 22Z" />
            <path d="M12 8A4 4 0 0 0 8 12C8 13.5 9 14.5 9.5 15.5C10 16.5 10.5 18 12 18C13.5 18 14 16.5 14.5 15.5C15 14.5 16 13.5 16 12A4 4 0 0 0 12 8Z" fill="currentColor" fillOpacity="0.2"/>
          </svg>
          <h2>New Password</h2>
          <p>Create a secure password for your account</p>
        </div>

        <form onSubmit={handleSubmit} id="reset-password-form">
          {errors.form && (
            <div style={{ color: "var(--danger)", fontSize: "0.875rem", marginBottom: "1rem", textAlign: "center" }}>
              {errors.form}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="reset-new-password">New Password</label>
            <div className="password-input-wrapper">
              <input
                ref={passwordInputRef}
                type={showPassword ? "text" : "password"}
                id="reset-new-password"
                className={`form-input ${errors.password ? "error" : ""}`}
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                id="reset-pass-toggle-1"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password && <div className="form-error">{errors.password}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reset-confirm-password">Confirm Password</label>
            <input
              type={showPassword ? "text" : "password"}
              id="reset-confirm-password"
              className={`form-input ${errors.confirmPassword ? "error" : ""}`}
              placeholder="Match password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
            {errors.confirmPassword && <div className="form-error">{errors.confirmPassword}</div>}
          </div>

          <button type="submit" className="btn btn-primary auth-btn" id="reset-submit-btn" disabled={loading}>
            {loading ? "Updating..." : "Save Password"}
          </button>
        </form>

        <div className="auth-footer">
          Cancel process and{" "}
          <Link to="/login" className="auth-link" id="reset-back-to-login">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
