import React, { useState, useEffect, useMemo, useContext, useCallback } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from "recharts";
import { api } from "../services/api";
import { formatCurrency } from "../utils/currencyFormatter";
import Pagination from "../components/Pagination";
import { ThemeContext } from "../context/ThemeContext";

/**
 * Returns default date range: past 30 days up to today
 */
function getDefaultDateRange() {
  const today = new Date();
  const to = today.toISOString().split("T")[0];
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 30);
  const from = fromDate.toISOString().split("T")[0];
  return { from, to };
}

/**
 * Format date for chart axis label (e.g. "2026-09-08" -> "Sep 8")
 */
function formatAxisDate(dateStr) {
  if (!dateStr) return "";
  if (dateStr.includes(" to ")) return dateStr;
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const mIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return `${monthNames[mIdx]} ${day}`;
    }
    if (parts.length === 2) {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${monthNames[mIdx]} ${parts[0]}`;
    }
  } catch (e) {}
  return dateStr;
}

/**
 * Intelligent axis label formatter for paint names.
 * Ensures readable names on horizontal bar charts while preventing label clipping.
 */
function formatPaintAxisLabel(name, maxLen = 23) {
  if (!name || typeof name !== "string") return "";
  if (name.length <= maxLen) return name;
  return `${name.substring(0, maxLen).trim()}...`;
}

export default function SalesDashboard() {
  const { theme } = useContext(ThemeContext) || {};
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);

  const initialDates = useMemo(() => getDefaultDateRange(), []);
  const [fromDate, setFromDate] = useState(initialDates.from);
  const [toDate, setToDate] = useState(initialDates.to);

  // Active query parameters currently fetched
  const [activeRange, setActiveRange] = useState({ from: initialDates.from, to: initialDates.to });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [reportData, setReportData] = useState(null);

  // Pagination for Sales Details Table
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Chart theme colors matching PaintCorp CSS variables
  const chartColors = useMemo(() => ({
    grid: isDark ? "#374151" : "#E2E8F0",
    text: isDark ? "#94A3B8" : "#64748B",
    primary: "#2563EB",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
    info: "#0284C7",
    tooltipBg: isDark ? "#1F2937" : "#FFFFFF",
    tooltipBorder: isDark ? "#374151" : "#CBD5E1",
    tooltipText: isDark ? "#F8FAFC" : "#1E293B"
  }), [isDark]);

  // Fetch sales report from backend MySQL API
  const fetchReport = useCallback(async (from, to) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/api/sales-report?from=${from}&to=${to}`);
      if (response && response.success) {
        setReportData(response);
      } else {
        throw new Error(response?.error || "Failed to load sales report.");
      }
    } catch (err) {
      console.error("Sales report fetch error:", err);
      setError("Unable to load sales data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchReport(activeRange.from, activeRange.to);
  }, [activeRange, fetchReport]);

  // Handle Date Filter Submit
  const handleApplyFilter = (e) => {
    e.preventDefault();
    setValidationError(null);

    if (!fromDate || !toDate) {
      setValidationError("Both From Date and To Date are required.");
      return;
    }

    if (fromDate > toDate) {
      setValidationError("From Date cannot be after To Date.");
      return;
    }

    setCurrentPage(1);
    setActiveRange({ from: fromDate, to: toDate });
  };

  // Reset Filter
  const handleResetFilter = () => {
    const defaults = getDefaultDateRange();
    setFromDate(defaults.from);
    setToDate(defaults.to);
    setValidationError(null);
    setCurrentPage(1);
    setActiveRange({ from: defaults.from, to: defaults.to });
  };

  const summary = reportData?.summary || {
    totalRevenue: 0,
    totalOrders: 0,
    quantitySold: 0,
    averageOrderValue: 0
  };

  const timelineData = reportData?.timeline || [];
  const topProducts = reportData?.topProducts || [];
  const revenueByProduct = reportData?.revenueByProduct || [];
  const orderStatus = reportData?.orderStatus || [];
  const details = reportData?.details || [];

  const paginatedDetails = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return details.slice(start, start + itemsPerPage);
  }, [details, currentPage]);

  const hasSales = summary.totalOrders > 0;

  // Custom Chart Tooltip
  const CustomLineTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div
          style={{
            backgroundColor: chartColors.tooltipBg,
            border: `1px solid ${chartColors.tooltipBorder}`,
            padding: "0.75rem 1rem",
            borderRadius: "6px",
            boxShadow: "var(--shadow-md)",
            color: chartColors.tooltipText,
            fontSize: "0.85rem"
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
            {dataPoint.date}
          </div>
          <div style={{ color: "var(--success-text)", fontWeight: 700 }}>
            Revenue: {formatCurrency(dataPoint.revenue)}
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
            Orders: {dataPoint.ordersCount || 0} | Quantity: {dataPoint.quantity || 0} L
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Product Bar Tooltip showing full unabbreviated paint name, quantity, and revenue
  const CustomProductTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const fullName = dataPoint.paintName || "Paint Product";
      const quantity = dataPoint.quantity ?? 0;
      const revenue = dataPoint.revenue ?? 0;

      return (
        <div
          style={{
            backgroundColor: chartColors.tooltipBg,
            border: `1px solid ${chartColors.tooltipBorder}`,
            padding: "0.75rem 1rem",
            borderRadius: "6px",
            boxShadow: "var(--shadow-md)",
            color: chartColors.tooltipText,
            fontSize: "0.85rem",
            maxWidth: "320px",
            wordBreak: "break-word"
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: "0.5rem", color: "var(--text-main)", fontSize: "0.9rem", lineHeight: 1.35 }}>
            {fullName}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
              <span style={{ color: "var(--text-muted)" }}>Quantity Sold:</span>
              <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{quantity} L</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
              <span style={{ color: "var(--text-muted)" }}>Revenue:</span>
              <span style={{ fontWeight: 700, color: "var(--success-text)" }}>{formatCurrency(revenue)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="sales-dashboard-page" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div className="page-title">
          <h1>Sales Analysis</h1>
          <p>Real-time analytics and revenue performance derived from MySQL transactions</p>
        </div>
      </div>

      {/* Date Range Filter Card */}
      <div className="card" style={{ padding: "1.25rem 1.5rem" }} id="sales-filter-card">
        <form onSubmit={handleApplyFilter} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "1rem" }}>
          <div>
            <label
              htmlFor="sales-from-date"
              style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.375rem", color: "var(--text-main)" }}
            >
              From Date
            </label>
            <input
              id="sales-from-date"
              type="date"
              className="form-input"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setValidationError(null);
              }}
              style={{ minWidth: "160px", padding: "0.5rem 0.75rem" }}
              required
            />
          </div>

          <div>
            <label
              htmlFor="sales-to-date"
              style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.375rem", color: "var(--text-main)" }}
            >
              To Date
            </label>
            <input
              id="sales-to-date"
              type="date"
              className="form-input"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setValidationError(null);
              }}
              style={{ minWidth: "160px", padding: "0.5rem 0.75rem" }}
              required
            />
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="submit"
              className="btn btn-primary"
              id="sales-apply-filter-btn"
              disabled={loading}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {loading ? "Analyzing..." : "Apply Filter"}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              id="sales-reset-filter-btn"
              onClick={handleResetFilter}
              disabled={loading}
            >
              Reset
            </button>
          </div>

          <div style={{ marginLeft: "auto", alignSelf: "center", fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Showing interval: <strong style={{ color: "var(--text-main)" }}>{activeRange.from}</strong> to <strong style={{ color: "var(--text-main)" }}>{activeRange.to}</strong>
          </div>
        </form>

        {validationError && (
          <div
            id="sales-validation-error"
            style={{
              color: "var(--danger-text)",
              backgroundColor: "var(--danger-bg)",
              padding: "0.625rem 1rem",
              borderRadius: "6px",
              marginTop: "1rem",
              fontSize: "0.875rem",
              fontWeight: 500
            }}
          >
            {validationError}
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div
          className="card"
          id="sales-error-state"
          style={{
            padding: "1.5rem",
            backgroundColor: "var(--danger-bg)",
            color: "var(--danger-text)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <span>{error}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchReport(activeRange.from, activeRange.to)}>
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton Indicator */}
      {loading && !error && (
        <div
          className="card"
          id="sales-loading-state"
          style={{
            padding: "2.5rem",
            textAlign: "center",
            color: "var(--text-muted)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem"
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              border: "3px solid var(--border-color)",
              borderTopColor: "var(--primary)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite"
            }}
          />
          <p style={{ fontSize: "0.95rem", fontWeight: 500 }}>Loading sales analysis from MySQL database...</p>
        </div>
      )}

      {/* Empty State Banner when no sales exist in the selected range */}
      {!loading && !error && !hasSales && (
        <div
          className="card"
          id="sales-empty-state"
          style={{
            padding: "2rem",
            textAlign: "center",
            backgroundColor: "var(--warning-bg)",
            color: "var(--warning-text)",
            borderRadius: "var(--radius-lg)",
            fontWeight: 600
          }}
        >
          No sales data available for the selected date range.
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="metrics-grid" id="sales-kpi-grid">
        {/* KPI 1: Total Revenue */}
        <div className="card metric-card" id="sales-kpi-revenue">
          <div className="metric-info">
            <span className="metric-label">Total Revenue</span>
            <span className="metric-value" style={{ color: "var(--success-text)" }}>
              {formatCurrency(summary.totalRevenue)}
            </span>
          </div>
          <div className="metric-icon-box green">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* KPI 2: Total Orders */}
        <div className="card metric-card" id="sales-kpi-orders">
          <div className="metric-info">
            <span className="metric-label">Total Orders</span>
            <span className="metric-value">
              {summary.totalOrders} <span style={{ fontSize: "14px", fontWeight: "normal", color: "var(--text-muted)" }}>Orders</span>
            </span>
          </div>
          <div className="metric-icon-box blue">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
        </div>

        {/* KPI 3: Quantity Sold */}
        <div className="card metric-card" id="sales-kpi-quantity">
          <div className="metric-info">
            <span className="metric-label">Quantity Sold</span>
            <span className="metric-value">
              {summary.quantitySold} <span style={{ fontSize: "14px", fontWeight: "normal", color: "var(--text-muted)" }}>L</span>
            </span>
          </div>
          <div className="metric-icon-box orange">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        </div>

        {/* KPI 4: Average Order Value */}
        <div className="card metric-card" id="sales-kpi-aov">
          <div className="metric-info">
            <span className="metric-label">Average Order Value</span>
            <span className="metric-value" style={{ color: "var(--primary)" }}>
              {formatCurrency(summary.averageOrderValue)}
            </span>
          </div>
          <div className="metric-icon-box blue">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Main Visualization: Daily Sales Revenue (Line Chart) */}
      <div className="card" style={{ padding: "1.5rem" }} id="sales-trend-chart-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)" }}>Daily Sales Revenue</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
              Chronological revenue progression (zero-filled across inactive trading days)
            </p>
          </div>
          {reportData?.granularity && (
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                padding: "0.25rem 0.625rem",
                borderRadius: "9999px",
                backgroundColor: "var(--info-bg)",
                color: "var(--info-text)"
              }}
            >
              {reportData.granularity} view
            </span>
          )}
        </div>

        {timelineData.length === 0 ? (
          <div style={{ height: "280px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
            No sales revenue to plot for this date interval.
          </div>
        ) : (
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke={chartColors.text}
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={formatAxisDate}
                  dy={10}
                />
                <YAxis
                  stroke={chartColors.text}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => (val >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : `₹${val}`)}
                  dx={-5}
                />
                <Tooltip content={<CustomLineTooltip />} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--primary)"
                  strokeWidth={3}
                  dot={{ r: 3, fill: "var(--primary)" }}
                  activeDot={{ r: 6, stroke: "var(--bg-card)", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Two Column Section: Top Selling Paints & Revenue by Paint */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: "1.5rem" }}>
        {/* Top Selling Paints (Horizontal Bar Chart) */}
        <div className="card" style={{ padding: "1.5rem" }} id="top-selling-paints-card">
          <div style={{ marginBottom: "1.25rem" }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)" }}>Top Selling Paints</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
              Ranked by total quantity sold (liters)
            </p>
          </div>

          {topProducts.length === 0 ? (
            <div style={{ height: "280px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
              No paint sales recorded in this interval.
            </div>
          ) : (
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={false} />
                  <XAxis
                    type="number"
                    stroke={chartColors.text}
                    fontSize={12}
                    tickLine={false}
                    tickFormatter={(val) => `${val} L`}
                  />
                  <YAxis
                    type="category"
                    dataKey="paintName"
                    stroke={chartColors.text}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={180}
                    tickFormatter={(val) => formatPaintAxisLabel(val, 23)}
                  />
                  <Tooltip
                    content={<CustomProductTooltip />}
                    cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}
                  />
                  <Bar dataKey="quantity" fill="var(--info)" radius={[0, 4, 4, 0]}>
                    {topProducts.map((entry, index) => (
                      <Cell key={`top-cell-${index}`} fill={index === 0 ? "var(--primary)" : "var(--info)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Revenue by Paint (Horizontal Bar Chart) */}
        <div className="card" style={{ padding: "1.5rem" }} id="revenue-by-paint-card">
          <div style={{ marginBottom: "1.25rem" }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)" }}>Revenue by Paint</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
              Paint formulations sorted by gross revenue contributions
            </p>
          </div>

          {revenueByProduct.length === 0 ? (
            <div style={{ height: "280px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
              No product revenue recorded in this interval.
            </div>
          ) : (
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByProduct} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={false} />
                  <XAxis
                    type="number"
                    stroke={chartColors.text}
                    fontSize={12}
                    tickLine={false}
                    tickFormatter={(val) => (val >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : `₹${val}`)}
                  />
                  <YAxis
                    type="category"
                    dataKey="paintName"
                    stroke={chartColors.text}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={180}
                    tickFormatter={(val) => formatPaintAxisLabel(val, 23)}
                  />
                  <Tooltip
                    content={<CustomProductTooltip />}
                    cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}
                  />
                  <Bar dataKey="revenue" fill="var(--success)" radius={[0, 4, 4, 0]}>
                    {revenueByProduct.map((entry, index) => (
                      <Cell key={`rev-cell-${index}`} fill={index === 0 ? "var(--success)" : "var(--info)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Order Status Analysis Section */}
      <div className="card" style={{ padding: "1.5rem" }} id="order-status-analysis-card">
        <div style={{ marginBottom: "1.25rem" }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)" }}>Order Status Analysis</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
            Logistics and processing breakdown across all orders placed during this period (including Cancelled)
          </p>
        </div>

        {orderStatus.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>No orders placed in this interval.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
            {orderStatus.map((st) => {
              const badgeClass =
                st.status === "Delivered"
                  ? "badge-success"
                  : st.status === "Pending"
                  ? "badge-warning"
                  : st.status === "Cancelled"
                  ? "badge-danger"
                  : "badge-info";

              return (
                <div
                  key={st.status}
                  style={{
                    padding: "1rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-main)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <span className={`badge ${badgeClass}`} style={{ fontSize: "0.75rem" }}>
                      {st.status}
                    </span>
                    <strong style={{ fontSize: "1.1rem" }}>{st.count}</strong>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Value: {formatCurrency(st.totalAmount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sales Details Table */}
      <div className="card" style={{ padding: "1.5rem" }} id="sales-details-table-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)" }}>Sales Details</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
              Individual line-item sales records filtered between {activeRange.from} and {activeRange.to}
            </p>
          </div>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Total entries: {details.length}
          </span>
        </div>

        <div className="table-container" style={{ margin: "0 -1.5rem" }}>
          <table className="erp-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Paint Formulation</th>
                <th className="text-right">Quantity</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDetails.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                    No order line items found for the selected interval.
                  </td>
                </tr>
              ) : (
                paginatedDetails.map((item) => {
                  const badgeClass =
                    item.status === "Delivered"
                      ? "badge-success"
                      : item.status === "Pending"
                      ? "badge-warning"
                      : item.status === "Cancelled"
                      ? "badge-danger"
                      : "badge-info";

                  return (
                    <tr key={item.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{item.date}</td>
                      <td className="font-semibold">{item.orderId}</td>
                      <td>{item.customerName}</td>
                      <td>{item.paintName}</td>
                      <td className="text-right">{item.quantity} L</td>
                      <td className="text-right font-semibold">{formatCurrency(item.amount)}</td>
                      <td>
                        <span className={`badge ${badgeClass}`}>{item.status}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        <Pagination
          currentPage={currentPage}
          totalItems={details.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
