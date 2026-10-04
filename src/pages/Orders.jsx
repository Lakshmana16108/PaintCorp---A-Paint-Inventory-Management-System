import React, { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ACTIONS } from "../reducers/inventoryReducer";
import { useToast } from "../context/ToastContext";
import Pagination from "../components/Pagination";
import { formatCurrency } from "../utils/currencyFormatter";
import { api } from "../services/api";
import { refreshInventoryData } from "../utils/syncInventory";

export default function Orders({ state, dispatch }) {
  const { orders = [] } = state || {};
  const { showToast } = useToast();

  // Search, Filter, Pagination, Sync state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSyncing, setIsSyncing] = useState(false);
  const itemsPerPage = 6;

  const searchInputRef = useRef(null);

  // Focus search on load & refresh authoritative data on mount
  useEffect(() => {
    searchInputRef.current?.focus();
    refreshInventoryData(dispatch);
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatus]);

  const handleManualRefresh = async () => {
    setIsSyncing(true);
    try {
      await refreshInventoryData(dispatch);
      showToast("Dispatch orders refreshed successfully.", "success");
    } catch (err) {
      showToast("Failed to refresh orders.", "danger");
    } finally {
      setIsSyncing(false);
    }
  };

  // Robust, crash-proof Search and Filters using useMemo
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    // Search query with safe fallback access
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((o) => {
        if (!o) return false;
        const id = (o.id || "").toLowerCase();
        const custName = (o.customerName || o.customer_name || "").toLowerCase();
        const custPhone = String(o.customerPhone || o.customer_phone || "").toLowerCase();
        const pName = (o.paintName || o.paint_name || "").toLowerCase();
        const itemsMatch =
          Array.isArray(o.items) &&
          o.items.some((it) => {
            if (!it) return false;
            const itName = (it.paintName || it.paint_name || "").toLowerCase();
            const itId = (it.paintId || it.paint_id || "").toLowerCase();
            return itName.includes(q) || itId.includes(q);
          });

        return (
          id.includes(q) ||
          custName.includes(q) ||
          custPhone.includes(q) ||
          pName.includes(q) ||
          itemsMatch
        );
      });
    }

    // Status filter
    if (selectedStatus) {
      result = result.filter((o) => (o.status || "Pending") === selectedStatus);
    }

    return result;
  }, [orders, searchQuery, selectedStatus]);

  // Paginated orders
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage]);

  const handleStatusChange = async (orderId, newStatus) => {
    // 1. Optimistically update local state & local storage immediately
    dispatch({
      type: ACTIONS.UPDATE_ORDER_STATUS,
      payload: { orderId, newStatus }
    });

    try {
      await api.put(`/api/orders/${orderId}/status`, { status: newStatus });
      await refreshInventoryData(dispatch);

      if (newStatus === "Cancelled") {
        showToast(`Order ${orderId} cancelled. Stock quantities restored.`, "warning");
      } else {
        showToast(`Order ${orderId} updated to ${newStatus}.`, "success");
      }
    } catch (err) {
      console.error("API status update error:", err);
      showToast(err.message || "Failed to update order status.", "danger");
    }
  };

  return (
    <div id="orders-page">
      {/* Header */}
      <div className="page-header">
        <div className="page-title">
          <h1>Purchase Dispatch Orders</h1>
          <p>Track customer order shipments and update logistics status</p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-secondary"
            onClick={handleManualRefresh}
            disabled={isSyncing}
            id="orders-refresh-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
          >
            <svg
              width="16"
              height="16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.2"
              style={{
                animation: isSyncing ? "spin 1s linear infinite" : "none"
              }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {isSyncing ? "Syncing..." : "Refresh Orders"}
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="filters-bar">
        <div className="filters-left">
          {/* Search */}
          <div className="search-input-wrapper" onClick={() => searchInputRef.current?.focus()}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="search-icon">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search Customer, ID or Paint..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="orders-search-input"
            />
          </div>

          {/* Status filter */}
          <select
            className="select-input"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            id="orders-status-filter"
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Processing">Processing</option>
            <option value="Packed">Packed</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div className="filters-right">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearchQuery("");
              setSelectedStatus("");
            }}
            id="orders-reset-filters"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="table-container">
        <table className="erp-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Products</th>
              <th className="text-right">Quantity</th>
              <th className="text-right">Total Price</th>
              <th>Order Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {paginatedOrders.length > 0 ? (
              paginatedOrders.map((order) => {
                const orderId = order.id || "-";
                const customerName = order.customerName || order.customer_name || "Valued Customer";
                const customerPhone = order.customerPhone || order.customer_phone || "-";

                const hasMultipleItems = Array.isArray(order.items) && order.items.length > 1;
                const productsDisplay =
                  Array.isArray(order.items) && order.items.length > 0
                    ? order.items.map((i) => i.paintName || i.paint_name || "Paint").join(", ")
                    : (order.paintName || order.paint_name || "Paint Product");

                const quantityDisplay = hasMultipleItems
                  ? order.items.map((i) => `${i.quantity || 1}L`).join(" + ")
                  : `${order.items?.[0]?.quantity ?? order.quantity ?? order.totalQuantity ?? 1} L`;

                const orderTotal =
                  order.totalAmount !== undefined && order.totalAmount !== null
                    ? Number(order.totalAmount)
                    : order.total_amount !== undefined && order.total_amount !== null
                    ? Number(order.total_amount)
                    : Number((order.quantity || 1) * (order.price || 0));

                const orderDate =
                  order.date ||
                  (order.order_date ? String(order.order_date).slice(0, 10) : "") ||
                  (order.created_at ? String(order.created_at).slice(0, 10) : "") ||
                  new Date().toISOString().split("T")[0];

                const orderStatus = order.status || "Pending";

                return (
                  <tr key={orderId}>
                    <td className="font-semibold">
                      <Link to={`/orders/${orderId}`} style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}>
                        {orderId}
                      </Link>
                    </td>
                    <td>
                      <div>{customerName}</div>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{customerPhone}</span>
                    </td>
                    <td>
                      <div style={{ maxWidth: "300px", whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.4 }} title={productsDisplay}>
                        {productsDisplay}
                      </div>
                    </td>
                    <td className="text-right font-medium">{quantityDisplay}</td>
                    <td className="text-right font-semibold">{formatCurrency(orderTotal)}</td>
                    <td>{orderDate}</td>
                    <td>
                      <select
                        className={`select-input btn-sm ${
                          orderStatus === "Delivered"
                            ? "badge-success"
                            : orderStatus === "Pending"
                            ? "badge-warning"
                            : orderStatus === "Cancelled"
                            ? "badge-danger"
                            : "badge-info"
                        }`}
                        style={{
                          padding: "0.25rem 1.5rem 0.25rem 0.5rem",
                          fontWeight: 600,
                          border: "none",
                          fontSize: "0.75rem",
                          color: "inherit"
                        }}
                        value={orderStatus}
                        onChange={(e) => handleStatusChange(orderId, e.target.value)}
                        id={`order-status-${orderId}`}
                      >
                        <option value="Pending" style={{ color: "var(--text-main)", backgroundColor: "var(--bg-card)" }}>Pending</option>
                        <option value="Processing" style={{ color: "var(--text-main)", backgroundColor: "var(--bg-card)" }}>Processing</option>
                        <option value="Packed" style={{ color: "var(--text-main)", backgroundColor: "var(--bg-card)" }}>Packed</option>
                        <option value="Delivered" style={{ color: "var(--text-main)", backgroundColor: "var(--bg-card)" }}>Delivered</option>
                        <option value="Cancelled" style={{ color: "var(--text-main)", backgroundColor: "var(--bg-card)" }}>Cancelled</option>
                      </select>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" className="text-center" style={{ padding: "3rem", color: "var(--text-muted)" }}>
                  No dispatch records matched your search query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalItems={filteredOrders.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
