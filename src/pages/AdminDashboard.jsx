import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";
import { AuthContext } from "../context/AuthContext";
import { api } from "../services/api";
import { formatCurrency } from "../utils/currencyFormatter";

export default function AdminDashboard() {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    kpis: {
      totalUsers: 0,
      newUsersThisMonth: 0,
      totalProducts: 0,
      totalStockUnits: 0,
      lowStockCount: 0,
      totalOrders: 0,
      pendingOrdersCount: 0,
      todaysSales: 0,
      monthlySales: 0
    },
    warehouses: [],
    salesOverview: {
      todaySales: 0,
      weekSales: 0,
      monthSales: 0,
      chartData: []
    },
    recentOrders: [],
    lowStockAlerts: [],
    userSummary: {
      administrators: 0,
      warehouseManagers: 0,
      staff: 0,
      totalUsers: 0
    },
    inventorySummary: {
      totalProducts: 0,
      totalStock: 0,
      lowStock: 0,
      outOfStock: 0,
      warehouseDistribution: []
    },
    recentActivity: []
  });

  // Current live clock state
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch admin dashboard data on mount
  useEffect(() => {
    let isMounted = true;

    async function fetchDashboard() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get("/api/admin/dashboard");
        if (isMounted) {
          if (res && res.success) {
            setData(res);
          } else {
            setError(res?.error || "Failed to load admin dashboard data.");
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error("Admin dashboard fetch error:", err);
          setError(err.message || "Failed to communicate with administration server.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const formatClock = (date) => {
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  const getStatusBadge = (status) => {
    const normalized = (status || "").toLowerCase();
    if (normalized === "delivered" || normalized === "completed" || normalized === "healthy" || normalized === "optimal") {
      return "badge-success";
    }
    if (normalized === "pending" || normalized === "processing" || normalized === "attention") {
      return "badge-warning";
    }
    if (normalized === "cancelled" || normalized === "critical") {
      return "badge-danger";
    }
    return "badge-info";
  };

  return (
    <div id="admin-dashboard-page" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* STEP 5: ADMIN DASHBOARD HEADER */}
      <div
        className="card"
        style={{
          background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(37, 99, 235, 0.05) 100%)",
          borderLeft: "4px solid var(--primary)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem"
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span className="badge badge-info" style={{ textTransform: "uppercase", fontSize: "0.7rem", fontWeight: 700 }}>
              Executive Control
            </span>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>PaintCorp ERP</span>
          </div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0, color: "var(--text-main)" }}>
            Administration Dashboard
          </h1>
          <p style={{ margin: "0.25rem 0 0 0", color: "var(--text-muted)", fontSize: "0.95rem" }}>
            Welcome, <strong>{currentUser?.name || "Administrator"}</strong>. Centralized company-wide operations and metrics.
          </p>
        </div>

        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "var(--bg-main)",
              padding: "0.5rem 0.85rem",
              borderRadius: "var(--radius-md)",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--text-main)",
              border: "1px solid var(--border-color)"
            }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formatClock(currentTime)}</span>
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Role: {currentUser?.role || "Administrator"}</span>
        </div>
      </div>

      {/* Error Notice if any */}
      {error && (
        <div className="card" style={{ backgroundColor: "#fef2f2", borderColor: "#fca5a5", color: "#991b1b" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* STEP 14: ADMIN QUICK ACTIONS */}
      <div className="card" style={{ padding: "1rem 1.25rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
          <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: "var(--primary)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Administrative Quick Actions</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate("/paint-list")}
              id="admin-action-add-product"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            >
              <span>+ Add Product</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate("/available-stock")}
              id="admin-action-add-stock"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            >
              <span>+ Add Stock</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate("/orders")}
              id="admin-action-view-orders"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            >
              <span>View Orders</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate("/admin/users")}
              id="admin-action-manage-users"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            >
              <span>Manage Users</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate("/sales-analysis")}
              id="admin-action-sales-analysis"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            >
              <span>Sales Analysis</span>
            </button>
          </div>
        </div>
      </div>

      {/* STEP 6: KEY PERFORMANCE INDICATORS (8 Cards) */}
      <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {/* 1. Total Users */}
        <div className="card metric-card" id="admin-metric-users" onClick={() => navigate("/admin/users")} style={{ cursor: "pointer" }}>
          <div className="metric-info">
            <span className="metric-label">Total Users</span>
            <span className="metric-value">{data.kpis.totalUsers}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--success-text)", fontWeight: 500, marginTop: "0.25rem" }}>
              +{data.kpis.newUsersThisMonth} this month
            </span>
          </div>
          <div className="metric-icon-box blue">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>

        {/* 2. Paint Products */}
        <div className="card metric-card" id="admin-metric-products" onClick={() => navigate("/paint-list")} style={{ cursor: "pointer" }}>
          <div className="metric-info">
            <span className="metric-label">Paint Products</span>
            <span className="metric-value">{data.kpis.totalProducts}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>catalog varieties</span>
          </div>
          <div className="metric-icon-box blue">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
        </div>

        {/* 3. Total Stock */}
        <div className="card metric-card" id="admin-metric-stock" onClick={() => navigate("/available-stock")} style={{ cursor: "pointer" }}>
          <div className="metric-info">
            <span className="metric-label">Total Stock</span>
            <span className="metric-value">{data.kpis.totalStockUnits.toLocaleString()}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>liters across depots</span>
          </div>
          <div className="metric-icon-box green">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        </div>

        {/* 4. Low Stock Products */}
        <div className="card metric-card" id="admin-metric-low-stock" onClick={() => navigate("/available-stock")} style={{ cursor: "pointer" }}>
          <div className="metric-info">
            <span className="metric-label">Low Stock</span>
            <span className="metric-value" style={{ color: data.kpis.lowStockCount > 0 ? "var(--danger)" : "inherit" }}>
              {data.kpis.lowStockCount} items
            </span>
            <span style={{ fontSize: "0.75rem", color: data.kpis.lowStockCount > 0 ? "var(--danger)" : "var(--text-muted)", marginTop: "0.25rem" }}>
              {data.kpis.lowStockCount > 0 ? "Requires replenishment" : "Inventory optimal"}
            </span>
          </div>
          <div className="metric-icon-box red">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        {/* 5. Total Orders */}
        <div className="card metric-card" id="admin-metric-orders" onClick={() => navigate("/orders")} style={{ cursor: "pointer" }}>
          <div className="metric-info">
            <span className="metric-label">Orders</span>
            <span className="metric-value">{data.kpis.totalOrders}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>lifetime orders</span>
          </div>
          <div className="metric-icon-box orange">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
        </div>

        {/* 6. Pending Orders */}
        <div className="card metric-card" id="admin-metric-pending" onClick={() => navigate("/orders")} style={{ cursor: "pointer" }}>
          <div className="metric-info">
            <span className="metric-label">Pending Orders</span>
            <span className="metric-value" style={{ color: data.kpis.pendingOrdersCount > 0 ? "var(--warning)" : "inherit" }}>
              {data.kpis.pendingOrdersCount}
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>awaiting fulfillment</span>
          </div>
          <div className="metric-icon-box orange">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* 7. Today's Sales */}
        <div className="card metric-card" id="admin-metric-today-sales">
          <div className="metric-info">
            <span className="metric-label">Today's Sales</span>
            <span className="metric-value" style={{ color: "var(--success-text)", fontSize: "1.3rem" }}>
              {formatCurrency(data.kpis.todaysSales)}
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>settled transactions</span>
          </div>
          <div className="metric-icon-box green">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1" />
            </svg>
          </div>
        </div>

        {/* 8. Monthly Sales */}
        <div className="card metric-card" id="admin-metric-monthly-sales">
          <div className="metric-info">
            <span className="metric-label">Monthly Sales</span>
            <span className="metric-value" style={{ color: "var(--primary)", fontSize: "1.3rem" }}>
              {formatCurrency(data.kpis.monthlySales)}
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>current billing period</span>
          </div>
          <div className="metric-icon-box blue">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
        </div>
      </div>

      {/* STEP 7: THREE WAREHOUSE OVERVIEW */}
      <div className="card" id="admin-warehouse-overview">
        <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>Warehouse Overview</h2>
            <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Real-time stock capacity and operational health across distribution facilities
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("/available-stock")}>
            Manage Stock Details →
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
          {data.warehouses.map((wh, idx) => (
            <div
              key={wh.name || idx}
              style={{
                backgroundColor: "var(--bg-main)",
                borderRadius: "var(--radius-md)",
                padding: "1.25rem",
                border: "1px solid var(--border-color)",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                transition: "transform 0.15s ease, box-shadow 0.15s ease"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0, color: "var(--text-main)" }}>
                    {wh.name}
                  </h3>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Facility Depot #{idx + 1}</span>
                </div>
                <span className={`badge ${getStatusBadge(wh.status)}`} style={{ textTransform: "capitalize" }}>
                  {wh.status}
                </span>
              </div>

              <div style={{ height: "1px", backgroundColor: "var(--border-color)" }} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", textAlign: "center" }}>
                <div style={{ background: "var(--bg-card)", padding: "0.6rem 0.4rem", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Total Stock</div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-main)", marginTop: "0.2rem" }}>
                    {wh.totalStock.toLocaleString()}
                  </div>
                </div>

                <div style={{ background: "var(--bg-card)", padding: "0.6rem 0.4rem", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Products</div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-main)", marginTop: "0.2rem" }}>
                    {wh.productsCount}
                  </div>
                </div>

                <div style={{ background: "var(--bg-card)", padding: "0.6rem 0.4rem", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Low Stock</div>
                  <div
                    style={{
                      fontSize: "1.05rem",
                      fontWeight: 700,
                      color: wh.lowStockCount > 0 ? "var(--danger)" : "var(--success-text)",
                      marginTop: "0.2rem"
                    }}
                  >
                    {wh.lowStockCount}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* STEP 8: SALES OVERVIEW (Chart + Summary) */}
      <div className="card" id="admin-sales-overview">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>Sales Overview</h2>
            <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Revenue generated from fulfilled order transactions
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <div style={{ background: "var(--bg-main)", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Today</span>
              <strong style={{ fontSize: "0.95rem", color: "var(--success-text)" }}>{formatCurrency(data.salesOverview.todaySales)}</strong>
            </div>
            <div style={{ background: "var(--bg-main)", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>This Week</span>
              <strong style={{ fontSize: "0.95rem", color: "var(--primary)" }}>{formatCurrency(data.salesOverview.weekSales)}</strong>
            </div>
            <div style={{ background: "var(--bg-main)", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>This Month</span>
              <strong style={{ fontSize: "0.95rem", color: "var(--text-main)" }}>{formatCurrency(data.salesOverview.monthSales)}</strong>
            </div>
          </div>
        </div>

        <div style={{ width: "100%", height: "260px" }}>
          {data.salesOverview.chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.salesOverview.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 12 }} stroke="var(--border-color)" />
                <YAxis
                  tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                  stroke="var(--border-color)"
                  tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  formatter={(val) => [formatCurrency(val), "Sales"]}
                  labelStyle={{ color: "var(--text-main)", fontWeight: 600 }}
                  contentStyle={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--border-color)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "var(--shadow-md)"
                  }}
                />
                <Area type="monotone" dataKey="sales" stroke="var(--primary)" strokeWidth={2.5} fillOpacity={1} fill="url(#salesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>
              No historical sales data available in the current period.
            </div>
          )}
        </div>
      </div>

      {/* TWO-COLUMN GRID: Recent Orders & Low Stock Alerts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: "1.5rem" }}>
        {/* STEP 9: ORDER OVERVIEW */}
        <div className="card" id="admin-recent-orders">
          <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>Recent Orders</h2>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Latest registered customer orders</span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate("/orders")} id="admin-view-all-orders-btn">
              View All Orders →
            </button>
          </div>

          <div className="table-container" style={{ border: "none", boxShadow: "none", margin: "0.5rem 0 0 0" }}>
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.length > 0 ? (
                  data.recentOrders.map((ord) => (
                    <tr key={ord.id}>
                      <td style={{ fontWeight: 600 }}>{ord.id}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{ord.customerName}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{ord.paintName}</div>
                      </td>
                      <td style={{ fontWeight: 600, color: "var(--text-main)" }}>{formatCurrency(ord.amount)}</td>
                      <td>
                        <span className={`badge ${getStatusBadge(ord.status)}`}>{ord.status}</span>
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{ord.date}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                      No recent orders recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* STEP 10: LOW STOCK ALERTS */}
        <div className="card" id="admin-low-stock-alerts">
          <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>Low Stock Alerts</h2>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Items below minimum safety threshold</span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate("/available-stock")}>
              Available Stock →
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.75rem" }}>
            {data.lowStockAlerts.length > 0 ? (
              data.lowStockAlerts.map((item) => (
                <div
                  key={`${item.id}-${item.paintId}-${item.warehouse}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 1rem",
                    backgroundColor: "var(--bg-main)",
                    borderRadius: "var(--radius-md)",
                    borderLeft: "4px solid var(--danger)",
                    border: "1px solid var(--border-color)",
                    borderLeftColor: "var(--danger)"
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-main)" }}>
                        ⚠️ {item.paintId}
                      </span>
                      <span style={{ fontSize: "0.85rem", color: "var(--text-main)" }}>{item.paintName}</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                      {item.warehouse} • <strong style={{ color: "var(--danger)" }}>{item.quantity} units remaining</strong> (Min: {item.minQuantity})
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate("/available-stock")}
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                    >
                      View Stock
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate("/available-stock")}
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                    >
                      + Add Stock
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>✅</div>
                <div>All paint items across all 3 warehouses are safely above minimum thresholds.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TWO-COLUMN GRID: User Summary & Inventory Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: "1.5rem" }}>
        {/* STEP 11: USER SUMMARY */}
        <div className="card" id="admin-user-summary">
          <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>User Overview</h2>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Platform credentials and system access breakdown</span>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => navigate("/admin/users")} id="admin-manage-users-btn">
              Manage Users →
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", marginTop: "1rem" }}>
            <div style={{ padding: "1rem", backgroundColor: "var(--bg-main)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Administrators</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--primary)", marginTop: "0.25rem" }}>
                {data.userSummary.administrators}
              </div>
            </div>

            <div style={{ padding: "1rem", backgroundColor: "var(--bg-main)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Warehouse Managers</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-main)", marginTop: "0.25rem" }}>
                {data.userSummary.warehouseManagers}
              </div>
            </div>

            <div style={{ padding: "1rem", backgroundColor: "var(--bg-main)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Staff Personnel</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-main)", marginTop: "0.25rem" }}>
                {data.userSummary.staff}
              </div>
            </div>

            <div style={{ padding: "1rem", backgroundColor: "var(--bg-main)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Total Users</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--success-text)", marginTop: "0.25rem" }}>
                {data.userSummary.totalUsers}
              </div>
            </div>
          </div>
        </div>

        {/* STEP 13: INVENTORY SUMMARY */}
        <div className="card" id="admin-inventory-summary">
          <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>Inventory Summary</h2>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Stock counts and warehouse distribution</span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate("/paint-list")}>
              Catalog →
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem", marginTop: "1rem", textAlign: "center" }}>
            <div style={{ background: "var(--bg-main)", padding: "0.75rem 0.5rem", borderRadius: "var(--radius-sm)" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Total Products</span>
              <strong style={{ fontSize: "1.1rem" }}>{data.inventorySummary.totalProducts}</strong>
            </div>
            <div style={{ background: "var(--bg-main)", padding: "0.75rem 0.5rem", borderRadius: "var(--radius-sm)" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Total Stock</span>
              <strong style={{ fontSize: "1.1rem" }}>{data.inventorySummary.totalStock.toLocaleString()}</strong>
            </div>
            <div style={{ background: "var(--bg-main)", padding: "0.75rem 0.5rem", borderRadius: "var(--radius-sm)" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Low Stock</span>
              <strong style={{ fontSize: "1.1rem", color: "var(--danger)" }}>{data.inventorySummary.lowStock}</strong>
            </div>
            <div style={{ background: "var(--bg-main)", padding: "0.75rem 0.5rem", borderRadius: "var(--radius-sm)" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Out of Stock</span>
              <strong style={{ fontSize: "1.1rem", color: data.inventorySummary.outOfStock > 0 ? "var(--danger)" : "inherit" }}>
                {data.inventorySummary.outOfStock}
              </strong>
            </div>
          </div>

          <div style={{ marginTop: "1.25rem" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.5rem" }}>
              Warehouse Stock Breakdown
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {data.inventorySummary.warehouseDistribution.map((dist) => {
                const total = data.inventorySummary.totalStock || 1;
                const pct = Math.min(100, Math.round((dist.stock / total) * 100));
                return (
                  <div key={dist.warehouse}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.2rem" }}>
                      <span>{dist.warehouse}</span>
                      <span style={{ fontWeight: 600 }}>{dist.stock.toLocaleString()} L ({pct}%)</span>
                    </div>
                    <div style={{ height: "6px", backgroundColor: "var(--bg-main)", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", backgroundColor: "var(--primary)", borderRadius: "3px" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* STEP 12: RECENT ACTIVITY */}
      <div className="card" id="admin-recent-activity">
        <div className="card-title">
          <h2 style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>Recent System Activity</h2>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Live database actions & audit log</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.75rem" }}>
          {data.recentActivity.length > 0 ? (
            data.recentActivity.map((act) => (
              <div
                key={act.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  padding: "0.75rem",
                  backgroundColor: "var(--bg-main)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-color)"
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: act.type === "stock" ? "rgba(16, 185, 129, 0.15)" : act.type === "order" ? "rgba(37, 99, 235, 0.15)" : "rgba(245, 158, 11, 0.15)",
                    color: act.type === "stock" ? "var(--success-text)" : act.type === "order" ? "var(--primary)" : "var(--warning)",
                    flexShrink: 0
                  }}
                >
                  {act.type === "stock" && (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  )}
                  {act.type === "order" && (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  )}
                  {act.type === "product" && (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-main)" }}>
                      {act.title}
                    </span>
                    <span className="badge badge-info" style={{ fontSize: "0.65rem" }}>
                      {act.category}
                    </span>
                  </div>
                  <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {act.description}
                  </p>
                  {act.time && (
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginTop: "0.25rem" }}>
                      {new Date(act.time).toLocaleString("en-IN")}
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--text-muted)" }}>
              No system activity events recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
