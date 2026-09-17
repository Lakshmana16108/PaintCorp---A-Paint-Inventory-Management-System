import React, { useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { formatCurrency } from "../utils/currencyFormatter";

export default function Dashboard({ state }) {
  const { paints = [], stock = [], orders = [] } = state || {};
  const navigate = useNavigate();
  const location = useLocation();

  // Sub-routing delegation: if route is nested (e.g. /dashboard/profile), render Outlet
  const isDashboardHome = location.pathname === "/dashboard" || location.pathname === "/dashboard/";

  // Optimizing statistics using useMemo
  const stats = useMemo(() => {
    // 1. Total Paint Types
    const totalPaints = paints.length;

    // 2. Available Stock Quantity (physical liters/cans)
    const totalStockQty = stock.reduce((sum, item) => sum + item.quantity, 0);

    // 3. Low Stock Items (based on stock entries <= minQuantity)
    const lowStockCount = stock.filter((item) => item.quantity <= item.minQuantity).length;

    // 4. Today's Orders (date = "2026-08-08" as per system date)
    const todayStr = "2026-08-08";
    const todaysOrdersCount = orders.filter((o) => o.date === todayStr).length;

    // 5. Pending Orders
    const pendingOrdersCount = orders.filter((o) => o.status === "Pending").length;

    // 6. Revenue (sum of quantity * price for non-cancelled orders)
    const totalRevenue = orders
      .filter((o) => o.status !== "Cancelled")
      .reduce((sum, o) => sum + o.quantity * o.price, 0);

    return {
      totalPaints,
      totalStockQty,
      lowStockCount,
      todaysOrdersCount,
      pendingOrdersCount,
      totalRevenue
    };
  }, [paints, stock, orders]);

  // Derive recent activity logs dynamically from the order history and low stock items
  const recentActivities = useMemo(() => {
    const logs = [];

    // Add low stock warnings
    stock
      .filter((item) => item.quantity <= item.minQuantity)
      .slice(0, 3)
      .forEach((item) => {
        logs.push({
          type: "warning",
          text: `Critical alert: Low stock on ${item.paintName} (${item.brand}) at ${item.warehouse}.`,
          time: "Just now"
        });
      });

    // Add order activities
    orders.slice(0, 5).forEach((order) => {
      let type = "info";
      let text = `Order ${order.id} (${order.paintName}) status updated to: ${order.status}`;
      if (order.status === "Pending") {
        type = "warning";
        text = `New purchase order ${order.id} placed by ${order.customerName} (${order.quantity} units).`;
      } else if (order.status === "Delivered") {
        type = "success";
        text = `Order ${order.id} successfully delivered to ${order.customerName}.`;
      } else if (order.status === "Cancelled") {
        type = "danger";
        text = `Order ${order.id} from ${order.customerName} has been cancelled and returned to inventory.`;
      }

      logs.push({
        type,
        text,
        time: order.date === "2026-08-08" ? "Today" : "Yesterday"
      });
    });

    // Fallback if no logs
    if (logs.length === 0) {
      logs.push({
        type: "info",
        text: "No warehouse logs reported in the current session.",
        time: "-"
      });
    }

    return logs.slice(0, 6);
  }, [orders, stock]);

  const recentOrders = useMemo(() => {
    return orders.slice(0, 5);
  }, [orders]);

  if (!isDashboardHome) {
    return <Outlet />;
  }

  return (
    <div id="dashboard-page">
      {/* Dashboard KPI metrics */}
      <div className="metrics-grid">
        <div className="card metric-card" id="metric-total-paints">
          <div className="metric-info">
            <span className="metric-label">Total Paint Types</span>
            <span className="metric-value">{stats.totalPaints}</span>
          </div>
          <div className="metric-icon-box blue">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
        </div>

        <div className="card metric-card" id="metric-total-stock">
          <div className="metric-info">
            <span className="metric-label">Total Stock Quantity</span>
            <span className="metric-value">{stats.totalStockQty} <span style={{ fontSize: "14px", fontWeight: "normal", color: "var(--text-muted)" }}>liters</span></span>
          </div>
          <div className="metric-icon-box green">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        </div>

        <div className="card metric-card" id="metric-low-stock">
          <div className="metric-info" style={{ cursor: "pointer" }} onClick={() => navigate("/available-stock")}>
            <span className="metric-label">Low Stock Items</span>
            <span className="metric-value" style={{ color: stats.lowStockCount > 0 ? "var(--danger)" : "inherit" }}>
              {stats.lowStockCount}
            </span>
          </div>
          <div className="metric-icon-box red">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        <div className="card metric-card" id="metric-today-orders">
          <div className="metric-info" style={{ cursor: "pointer" }} onClick={() => navigate("/orders")}>
            <span className="metric-label">Today's Orders</span>
            <span className="metric-value">{stats.todaysOrdersCount}</span>
          </div>
          <div className="metric-icon-box orange">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        <div className="card metric-card" id="metric-pending-orders">
          <div className="metric-info" style={{ cursor: "pointer" }} onClick={() => navigate("/orders")}>
            <span className="metric-label">Pending Orders</span>
            <span className="metric-value" style={{ color: stats.pendingOrdersCount > 0 ? "var(--warning)" : "inherit" }}>
              {stats.pendingOrdersCount}
            </span>
          </div>
          <div className="metric-icon-box orange">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <div className="card metric-card" id="metric-revenue">
          <div className="metric-info">
            <span className="metric-label">Revenue</span>
            <span className="metric-value" style={{ color: "var(--success-text)" }}>
              {formatCurrency(stats.totalRevenue)}
            </span>
          </div>
          <div className="metric-icon-box green">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1" />
            </svg>
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Activities & Orders */}
      <div className="dashboard-grid">
        {/* Recent Orders Table */}
        <div className="card" id="dashboard-recent-orders">
          <div className="card-title">
            <span>Recent Dispatch Orders</span>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate("/orders")} id="view-all-orders-btn">
              View All Orders
            </button>
          </div>
          <div className="table-container" style={{ border: "none", boxShadow: "none", margin: 0 }}>
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Paint Name</th>
                  <th>Quantity</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="font-semibold">{order.id}</td>
                    <td>{order.customerName}</td>
                    <td>{order.paintName}</td>
                    <td>{order.quantity} L</td>
                    <td>{order.date}</td>
                    <td>
                      <span
                        className={`badge ${
                          order.status === "Delivered"
                            ? "badge-success"
                            : order.status === "Pending"
                            ? "badge-warning"
                            : order.status === "Cancelled"
                            ? "badge-danger"
                            : "badge-info"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activities list */}
        <div className="card" id="dashboard-recent-activity">
          <h3 className="card-title">Recent Activity Logs</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {recentActivities.map((act, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  paddingBottom: "0.75rem",
                  borderBottom: index !== recentActivities.length - 1 ? "1px solid var(--border-color)" : "none"
                }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: `var(--${act.type})`,
                    marginTop: "6px",
                    flexShrink: 0
                  }}
                />
                <div style={{ flexGrow: 1 }}>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-main)" }}>{act.text}</p>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{act.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
