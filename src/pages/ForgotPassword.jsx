import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { api } from "../services/api";

export default function ForgotPassword() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const emailInputRef = useRef(null);

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  const validate = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Please enter a valid email address.";
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
      const result = await api.post("/api/auth/forgot-password", { email });
      if (result.success) {
        showToast(result.message || "Verification code sent to your email.", "success");
        // Navigate to verification page and pass email in state
        navigate("/verify-otp", { state: { email } });
      } else {
        showToast(result.error || "Something went wrong.", "danger");
        setErrors({ form: result.error });
      }
    } catch (error) {
      showToast(error.message || "Connection failed.", "danger");
      setErrors({ form: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19L12 22Z" />
            <path d="M12 8A4 4 0 0 0 8 12C8 13.5 9 14.5 9.5 15.5C10 16.5 10.5 18 12 18C13.5 18 14 16.5 14.5 15.5C15 14.5 16 13.5 16 12A4 4 0 0 0 12 8Z" fill="currentColor" fillOpacity="0.2"/>
          </svg>
          <h2>Reset Password</h2>
          <p>Retrieve access to PaintCorp ERP</p>
        </div>

        <form onSubmit={handleSubmit} id="forgot-password-form">
          {errors.form && (
            <div style={{ color: "var(--danger)", fontSize: "0.875rem", marginBottom: "1rem", textAlign: "center" }}>
              {errors.form}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="forgot-email">Email Address</label>
            <input
              ref={emailInputRef}
              type="text"
              id="forgot-email"
              className={`form-input ${errors.email ? "error" : ""}`}
              placeholder="e.g. admin@paintcorp.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            {errors.email && <div className="form-error">{errors.email}</div>}
          </div>

          <button type="submit" className="btn btn-primary auth-btn" id="forgot-submit-btn" disabled={loading}>
            {loading ? "Sending..." : "Send Verification Code"}
          </button>
        </form>

        <div className="auth-footer">
          Remembered your credentials?{" "}
          <Link to="/login" className="auth-link" id="forgot-back-to-login">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
