import React, { useContext, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { AuthContext } from "../context/AuthContext";

export default function Navbar({ lowStockAlerts = [], _isSidebarCollapsed, onToggleSidebar }) {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { currentUser, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = () => {
      setShowProfileDropdown(false);
      setShowNotificationsDropdown(false);
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  if (!currentUser) return null;

  return (
    <nav className="navbar">
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        {/* Toggle Sidebar Button for responsive views */}
        <button
          className="navbar-btn"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSidebar();
          }}
          style={{ display: "flex", alignItems: "center" }}
          id="sidebar-toggle-btn"
          aria-label="Toggle Sidebar"
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <Link to="/dashboard" className="navbar-brand" id="navbar-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19L12 22Z" />
            <path d="M12 8A4 4 0 0 0 8 12C8 13.5 9 14.5 9.5 15.5C10 16.5 10.5 18 12 18C13.5 18 14 16.5 14.5 15.5C15 14.5 16 13.5 16 12A4 4 0 0 0 12 8Z" fill="currentColor" fillOpacity="0.2"/>
          </svg>
          <span style={{ fontSize: "1.125rem", color: "var(--text-main)" }}>PaintCorp ERP</span>
        </Link>
      </div>

      {/* Actions */}
      <div className="navbar-actions">
        {/* Theme Toggle */}
        <button
          className="navbar-btn"
          onClick={toggleTheme}
          title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
          id="theme-toggle-btn"
        >
          {theme === "light" ? (
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m2.828-9.9a5 5 0 117.07 7.07l-2.828-2.828z" />
            </svg>
          )}
        </button>

        {/* Notifications Icon with Badge & Popover */}
        <div className="user-profile-menu">
          <button
            className="navbar-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowNotificationsDropdown(!showNotificationsDropdown);
              setShowProfileDropdown(false);
            }}
            id="notifications-btn"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {lowStockAlerts.length > 0 && <span className="badge-dot" id="notifications-badge"></span>}
          </button>

          {showNotificationsDropdown && (
            <div className="notifications-popover" onClick={(e) => e.stopPropagation()} id="notifications-popover">
              <div className="notifications-header">
                <span>Alert Notifications</span>
                <span className="badge badge-danger">{lowStockAlerts.length} Alert{lowStockAlerts.length !== 1 ? 's' : ''}</span>
              </div>
              {lowStockAlerts.length > 0 ? (
                lowStockAlerts.map((alert, idx) => (
                  <div key={idx} className="notification-item">
                    <div className="notification-title font-medium" style={{ color: "var(--danger-text)" }}>
                      {alert.paintName} Low Stock
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0.125rem 0" }}>
                      {alert.warehouse}: {alert.quantity} liters remaining (Min: {alert.minQuantity})
                    </p>
                    <div className="notification-time">{alert.brand}</div>
                  </div>
                ))
              ) : (
                <div className="notification-empty">
                  <p>All stock levels normal.</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>No low stock alerts detected.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Profile menu */}
        <div className="user-profile-menu">
          <div
            className="user-profile-trigger"
            onClick={() => navigate("/profile")}
            id="profile-dropdown-trigger"
            style={{ cursor: "pointer" }}
          >
            {currentUser.avatar ? (
              <img 
                src={currentUser.avatar} 
                alt="Avatar" 
                className="user-avatar" 
                style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover" }} 
              />
            ) : (
              <div className="user-avatar">{currentUser.name.charAt(0)}</div>
            )}
            <div className="user-info" style={{ display: "none" }}>
              <span className="user-name">{currentUser.name}</span>
              <span className="user-role">{currentUser.role}</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
