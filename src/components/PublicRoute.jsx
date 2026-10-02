import React, { useContext } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function PublicRoute() {
  const { currentUser } = useContext(AuthContext);

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
