import React from "react";

export default function ConfirmationDialog({ isOpen, title, message, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="confirm-backdrop" id="confirmation-dialog">
      <div className="confirm-dialog">
        <div className="confirm-icon-box">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h4>{title || "Confirm Action"}</h4>
        <p>{message || "Are you sure you want to proceed?"}</p>
        <div className="confirm-actions">
          <button className="btn btn-secondary" onClick={onCancel} id="confirm-cancel-btn">
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm} id="confirm-ok-btn">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
