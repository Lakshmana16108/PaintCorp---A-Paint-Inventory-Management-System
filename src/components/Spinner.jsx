import React from "react";

export default function Spinner({ loading }) {
  if (!loading) return null;
  return (
    <div className="spinner-overlay" id="loading-spinner">
      <div className="spinner"></div>
    </div>
  );
}
