import React from "react";
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        textAlign: "center",
        padding: "2rem"
      }}
      id="not-found-page"
    >
      <div
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "50%",
          backgroundColor: "var(--danger-bg)",
          color: "var(--danger)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "2.5rem",
          fontWeight: 700,
          marginBottom: "1.5rem"
        }}
      >
        !
      </div>
      <h1 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: "0.5rem" }}>404 - Page Not Found</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem", maxWidth: "450px" }}>
        The requested ERP section does not exist or you do not have permissions to view this log.
      </p>
      <button className="btn btn-primary" onClick={() => navigate("/dashboard")} id="not-found-back-btn">
        Return to Dashboard
      </button>
    </div>
  );
}
