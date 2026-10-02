import React, { useState, useEffect, useReducer, useMemo } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { inventoryReducer, ACTIONS } from "./reducers/inventoryReducer";
import { api } from "./services/api";

// Layout components
import Layout from "./components/Layout";
import Spinner from "./components/Spinner";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";

// Pages
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyOtp from "./pages/VerifyOtp";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import PaintList from "./pages/PaintList";
import AvailableStock from "./pages/AvailableStock";
import Billing from "./pages/Billing";
import Orders from "./pages/Orders";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import OrderDetails from "./pages/OrderDetails";

export default function App() {
  // Loading spinner state
  const [loading, setLoading] = useState(true);

  // Central Inventory database reducer
  const [state, dispatch] = useReducer(inventoryReducer, {
    paints: [],
    stock: [],
    orders: []
  });

  // Fetch live inventory data from backend MySQL database on mount
  useEffect(() => {
    let isMounted = true;
    async function loadLiveData() {
      setLoading(true);
      try {
        const [paintsRes, stockRes, ordersRes] = await Promise.all([
          api.get("/api/paints").catch(() => []),
          api.get("/api/stock").catch(() => []),
          api.get("/api/orders").catch(() => [])
        ]);

        if (isMounted) {
          dispatch({
            type: ACTIONS.LOAD_DATA,
            payload: {
              paints: Array.isArray(paintsRes) ? paintsRes : [],
              stock: Array.isArray(stockRes) ? stockRes : [],
              orders: Array.isArray(ordersRes) ? ordersRes : []
            }
          });
        }
      } catch (err) {
        console.error("Error loading live database data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadLiveData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute live low stock alerts across warehouses
  const lowStockAlerts = useMemo(() => {
    return state.stock.filter((item) => item.quantity <= item.minQuantity);
  }, [state.stock]);

  return (
    <>
      <Spinner loading={loading} />

      <Routes>
        {/* Root URL redirection */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Guest Routes - Login and SignUp */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>

        {/* Protected Dashboard/ERP Routes */}
        <Route element={<ProtectedRoute />}>
          <Route
            element={
              <Layout
                lowStockAlerts={lowStockAlerts}
              />
            }
          >
            {/* Dashboard nested routing */}
            <Route path="/dashboard" element={<Dashboard state={state} />}>
              <Route path="profile" element={<Profile />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />

            <Route path="/paint-list" element={<PaintList state={state} dispatch={dispatch} />} />
            <Route path="/available-stock" element={<AvailableStock state={state} dispatch={dispatch} />} />
            <Route path="/billing" element={<Billing state={state} dispatch={dispatch} />} />
            <Route path="/orders" element={<Orders state={state} dispatch={dispatch} />} />
            <Route path="/orders/:orderId" element={<OrderDetails state={state} />} />
          </Route>
        </Route>

        {/* 404 Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
