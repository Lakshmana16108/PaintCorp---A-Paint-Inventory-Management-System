import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { api } from "../services/api";

export default function VerifyOtp() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "";

  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const otpInputRef = useRef(null);

  // Redirect to forgot-password if email is missing from state (e.g. page refresh)
  useEffect(() => {
    if (!email) {
      showToast("Please request a reset verification code first.", "warning");
      navigate("/forgot-password");
    } else {
      otpInputRef.current?.focus();
    }
  }, [email, navigate]);

  // Countdown timer logic
  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const validate = () => {
    const newErrors = {};
    if (!otp.trim()) {
      newErrors.otp = "Verification code is required.";
    } else if (otp.trim().length !== 6 || isNaN(Number(otp))) {
      newErrors.otp = "Please enter a valid 6-digit numeric code.";
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
      const result = await api.post("/api/auth/verify-reset-otp", { email, otp });
      if (result.success && result.resetToken) {
        showToast("Code verified successfully.", "success");
        // Pass resetToken in state to Reset Password page
        navigate("/reset-password", { state: { resetToken: result.resetToken } });
      } else {
        showToast(result.error || "Verification failed.", "danger");
        setErrors({ form: result.error });
      }
    } catch (error) {
      showToast(error.message || "Verification failed.", "danger");
      setErrors({ form: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;

    setLoading(true);
    try {
      const result = await api.post("/api/auth/forgot-password", { email });
      if (result.success) {
        showToast("A new verification code has been sent.", "success");
        setCountdown(60);
        setOtp("");
        setErrors({});
        otpInputRef.current?.focus();
      } else {
        showToast(result.error || "Failed to resend code.", "danger");
      }
    } catch (error) {
      showToast(error.message || "Failed to resend code.", "danger");
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
          <h2>Enter Verification Code</h2>
          <p>We've sent a 6-digit OTP code to:</p>
          <strong style={{ display: "block", color: "var(--text-main)", fontSize: "0.875rem", marginTop: "0.25rem", wordBreak: "break-all" }}>
            {email}
          </strong>
        </div>

        <form onSubmit={handleSubmit} id="verify-otp-form">
          {errors.form && (
            <div style={{ color: "var(--danger)", fontSize: "0.875rem", marginBottom: "1rem", textAlign: "center" }}>
              {errors.form}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="otp-input">6-Digit Verification Code</label>
            <input
              ref={otpInputRef}
              type="text"
              id="otp-input"
              className={`form-input ${errors.otp ? "error" : ""}`}
              placeholder="e.g. 123456"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              disabled={loading}
              style={{ textAlign: "center", fontSize: "1.5rem", letterSpacing: "8px", fontWeight: "bold" }}
            />
            {errors.otp && <div className="form-error">{errors.otp}</div>}
          </div>

          <button type="submit" className="btn btn-primary auth-btn" id="verify-submit-btn" disabled={loading}>
            {loading ? "Verifying..." : "Verify Code"}
          </button>
        </form>

        <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
          {countdown > 0 ? (
            <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
              Resend code in <strong>{countdown}s</strong>
            </span>
          ) : (
            <button 
              type="button" 
              className="btn btn-secondary btn-sm" 
              onClick={handleResend} 
              id="resend-code-btn"
              disabled={loading}
              style={{ width: "100%", padding: "0.5rem" }}
            >
              Resend Verification Code
            </button>
          )}
        </div>

        <div className="auth-footer" style={{ marginTop: "1.5rem" }}>
          <Link to="/forgot-password" className="auth-link" id="back-to-forgot-password">
            Back to Email Input
          </Link>
        </div>
      </div>
    </div>
  );
}
