import React, { useContext } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

/**
 * AdminRoute Guard
 * Restricts nested routes strictly to authenticated users with role === 'Administrator'.
 * If not authenticated, redirects to /login.
 * If authenticated but lacking Administrator privileges, redirects to the operational /dashboard.
 */
export default function AdminRoute() {
  const { currentUser } = useContext(AuthContext);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (currentUser.role !== "Administrator") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
