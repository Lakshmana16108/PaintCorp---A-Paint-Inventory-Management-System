import React, { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ACTIONS } from "../reducers/inventoryReducer";
import { useToast } from "../context/ToastContext";
import Pagination from "../components/Pagination";
import { formatCurrency } from "../utils/currencyFormatter";
import { api } from "../services/api";

export default function Orders({ state, dispatch }) {
  const { orders = [] } = state || {};
  const { showToast } = useToast();

  // Search, Filter, Pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const searchInputRef = useRef(null);

  // Focus search on load
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatus]);

  // Optimized Search and Filters using useMemo
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.includes(q) ||
          o.paintName.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (selectedStatus) {
      result = result.filter((o) => o.status === selectedStatus);
    }

    return result;
  }, [orders, searchQuery, selectedStatus]);

  // Paginated orders
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage]);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await api.put(`/api/orders/${orderId}/status`, { status: newStatus });
    } catch (err) {
      console.warn("API status update error, applying local update:", err);
    }

    dispatch({
      type: ACTIONS.UPDATE_ORDER_STATUS,
      payload: {
        orderId,
        newStatus
      }
    });

    if (newStatus === "Cancelled") {
      showToast(`Order ${orderId} cancelled. Stock quantities restored.`, "warning");
    } else {
      showToast(`Order ${orderId} updated to ${newStatus}.`, "success");
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
              <th>Customer Name</th>
              <th>Product SKU</th>
              <th className="text-right">Quantity</th>
              <th className="text-right">Unit Price</th>
              <th className="text-right">Total Price</th>
              <th>Order Date</th>
              <th>Status Dropdown</th>
            </tr>
          </thead>
          <tbody>
            {paginatedOrders.length > 0 ? (
              paginatedOrders.map((order) => (
                <tr key={order.id}>
                  <td className="font-semibold">
                    <Link to={`/orders/${order.id}`} style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}>
                      {order.id}
                    </Link>
                  </td>
                  <td>
                    <div>{order.customerName}</div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{order.customerPhone}</span>
                  </td>
                  <td>{order.paintName}</td>
                  <td className="text-right font-medium">{order.quantity} L</td>
                  <td className="text-right">{formatCurrency(order.price)}</td>
                  <td className="text-right font-semibold">{formatCurrency(order.quantity * order.price)}</td>
                  <td>{order.date}</td>
                  <td>
                    <select
                      className={`select-input btn-sm ${
                        order.status === "Delivered"
                          ? "badge-success"
                          : order.status === "Pending"
                          ? "badge-warning"
                          : order.status === "Cancelled"
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
                      value={order.status}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      id={`order-status-${order.id}`}
                    >
                      <option value="Pending" style={{ color: "var(--text-main)", backgroundColor: "var(--bg-card)" }}>Pending</option>
                      <option value="Processing" style={{ color: "var(--text-main)", backgroundColor: "var(--bg-card)" }}>Processing</option>
                      <option value="Packed" style={{ color: "var(--text-main)", backgroundColor: "var(--bg-card)" }}>Packed</option>
                      <option value="Delivered" style={{ color: "var(--text-main)", backgroundColor: "var(--bg-card)" }}>Delivered</option>
                      <option value="Cancelled" style={{ color: "var(--text-main)", backgroundColor: "var(--bg-card)" }}>Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center" style={{ padding: "3rem", color: "var(--text-muted)" }}>
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
