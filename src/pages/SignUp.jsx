import React, { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function SignUp() {
  const { signup } = useContext(AuthContext);
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Form states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [role, setRole] = useState("Staff");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Error states
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9]{10,14}$/;

    if (!fullName.trim()) {
      newErrors.fullName = "Full Name is required.";
    }

    if (!email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!mobileNumber.trim()) {
      newErrors.mobileNumber = "Mobile Number is required.";
    } else if (!phoneRegex.test(mobileNumber.replace(/\s+/g, ""))) {
      newErrors.mobileNumber = "Please enter a valid mobile number (10-14 digits).";
    }

    if (!password) {
      newErrors.password = "Password is required.";
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
      showToast("Please fill in the form correctly.", "danger");
      return;
    }

    const userData = {
      name: fullName,
      email,
      mobile: mobileNumber,
      role,
      password
    };

    const result = await signup(userData);
    if (result.success) {
      showToast("Sign up successful! Please log in with your credentials.", "success");
      navigate("/login");
    } else {
      showToast(result.message || "Registration failed.", "danger");
      setErrors({ form: result.message });
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
          <h2>Create Account</h2>
          <p>Register a new ERP user session</p>
        </div>

        <form onSubmit={handleSubmit} id="signup-form">
          {errors.form && (
            <div style={{ color: "var(--danger)", fontSize: "0.875rem", marginBottom: "1rem", textAlign: "center" }}>
              {errors.form}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="signup-name">Full Name</label>
            <input
              type="text"
              id="signup-name"
              className={`form-input ${errors.fullName ? "error" : ""}`}
              placeholder="e.g. John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            {errors.fullName && <div className="form-error">{errors.fullName}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">Email Address</label>
            <input
              type="text"
              id="signup-email"
              className={`form-input ${errors.email ? "error" : ""}`}
              placeholder="e.g. john@paintcorp.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email && <div className="form-error">{errors.email}</div>}
          </div>

          <div className="form-group row">
            <div>
              <label className="form-label" htmlFor="signup-mobile">Mobile Number</label>
              <input
                type="text"
                id="signup-mobile"
                className={`form-input ${errors.mobileNumber ? "error" : ""}`}
                placeholder="e.g. +15551234"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
              />
              {errors.mobileNumber && <div className="form-error">{errors.mobileNumber}</div>}
            </div>
            <div>
              <label className="form-label" htmlFor="signup-role">System Role</label>
              <select
                id="signup-role"
                className="select-input w-full"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{ padding: "0.625rem 2rem 0.625rem 0.75rem" }}
              >
                <option value="Administrator">Administrator</option>
                <option value="Warehouse Manager">Warehouse Manager</option>
                <option value="Staff">Staff</option>
              </select>
            </div>
          </div>

          <div className="form-group row">
            <div>
              <label className="form-label" htmlFor="signup-password">Password</label>
              <input
                type="password"
                id="signup-password"
                className={`form-input ${errors.password ? "error" : ""}`}
                placeholder="Min 6 chars"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {errors.password && <div className="form-error">{errors.password}</div>}
            </div>
            <div>
              <label className="form-label" htmlFor="signup-confirm">Confirm Password</label>
              <input
                type="password"
                id="signup-confirm"
                className={`form-input ${errors.confirmPassword ? "error" : ""}`}
                placeholder="Match password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {errors.confirmPassword && <div className="form-error">{errors.confirmPassword}</div>}
            </div>
          </div>

          <button type="submit" className="btn btn-primary auth-btn" id="signup-submit-btn">
            Create Account
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{" "}
          <Link to="/login" className="auth-link" id="go-to-login">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
