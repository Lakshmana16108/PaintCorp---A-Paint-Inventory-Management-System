import React, { useState, useEffect, useRef, useContext } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getGoogleAuthUrl } from "../services/api";

export default function Login() {
  const { login, completeGoogleAuth } = useContext(AuthContext);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Form states using useState
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Error states
  const [errors, setErrors] = useState({});

  // Ref to auto-focus email on load
  const emailInputRef = useRef(null);

  // Check for Google OAuth callback params on mount
  useEffect(() => {
    const tokenParam = searchParams.get("token");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      const cleanMsg = decodeURIComponent(errorParam);
      showToast(cleanMsg, "danger");
      setErrors({ form: cleanMsg });
      navigate("/login", { replace: true });
    } else if (tokenParam) {
      setIsGoogleLoading(true);
      completeGoogleAuth(tokenParam)
        .then((res) => {
          if (res.success) {
            showToast("Signed in with Google successfully! Welcome back.", "success");
            navigate("/dashboard", { replace: true });
          } else {
            showToast(res.message || "Google authentication failed.", "danger");
            setErrors({ form: res.message });
            navigate("/login", { replace: true });
          }
        })
        .catch((err) => {
          showToast(err.message || "Google authentication failed.", "danger");
          setErrors({ form: err.message });
          navigate("/login", { replace: true });
        })
        .finally(() => {
          setIsGoogleLoading(false);
        });
    }
  }, [searchParams]);

  useEffect(() => {
    // Focus email input on load
    emailInputRef.current?.focus();
    
    // Check if email was remembered
    const savedEmail = localStorage.getItem("remembered_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const validate = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!password) {
      newErrors.password = "Password is required.";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      showToast("Please correct the errors in the form.", "danger");
      return;
    }

    const result = await login(email, password);
    if (result.success) {
      showToast("Logged in successfully! Welcome back.", "success");
      if (rememberMe) {
        localStorage.setItem("remembered_email", email);
      } else {
        localStorage.removeItem("remembered_email");
      }
      navigate("/dashboard");
    } else {
      showToast(result.message || "Login failed.", "danger");
      setErrors({ form: result.message });
    }
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    navigate("/forgot-password");
  };

  const handleGoogleLogin = () => {
    setIsGoogleLoading(true);
    window.location.href = getGoogleAuthUrl();
  };


  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19L12 22Z" />
            <path d="M12 8A4 4 0 0 0 8 12C8 13.5 9 14.5 9.5 15.5C10 16.5 10.5 18 12 18C13.5 18 14 16.5 14.5 15.5C15 14.5 16 13.5 16 12A4 4 0 0 0 12 8Z" fill="currentColor" fillOpacity="0.2"/>
          </svg>
          <h2>PaintCorp Portal</h2>
          <p>Inventory ERP login panel</p>
        </div>

        <form onSubmit={handleSubmit} id="login-form">
          {errors.form && (
            <div style={{ color: "var(--danger)", fontSize: "0.875rem", marginBottom: "1rem", textAlign: "center" }}>
              {errors.form}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email Address</label>
            <input
              ref={emailInputRef}
              type="text"
              id="login-email"
              className={`form-input ${errors.email ? "error" : ""}`}
              placeholder="e.g. admin@paintcorp.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email && <div className="form-error">{errors.email}</div>}
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="form-label" htmlFor="login-password">Password</label>
              <a href="#" className="forgot-password-link" onClick={handleForgotPassword} id="forgot-password-link">
                Forgot Password?
              </a>
            </div>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="login-password"
                className={`form-input ${errors.password ? "error" : ""}`}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                id="password-toggle"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password && <div className="form-error">{errors.password}</div>}
          </div>

          <div className="form-group" style={{ display: "flex", justifyContent: "space-between" }}>
            <label className="form-checkbox" htmlFor="login-remember">
              <input
                type="checkbox"
                id="login-remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Remember Me</span>
            </label>
          </div>

          <button type="submit" className="btn btn-primary auth-btn" id="login-submit-btn">
            Login Securely
          </button>

          <div className="auth-divider">
            <span>or continue with</span>
          </div>

          <button
            type="button"
            className="btn btn-google"
            id="google-login-btn"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading}
          >
            {isGoogleLoading ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: "1rem", height: "1rem", marginRight: "0.5rem" }}></span>
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" className="google-icon" style={{ marginRight: "0.625rem" }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account?{" "}
          <Link to="/signup" className="auth-link" id="go-to-signup">
            Sign Up Now
          </Link>
        </div>
      </div>
    </div>
  );
}
