import React, { useState, useMemo, useEffect, useRef } from "react";
import { ACTIONS } from "../reducers/inventoryReducer";
import { useToast } from "../context/ToastContext";
import Pagination from "../components/Pagination";
import { api } from "../services/api";

export default function AvailableStock({ state, dispatch }) {
  const { stock = [] } = state || {};
  const { showToast } = useToast();

  // Filter and sort states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [quantitySort, setQuantitySort] = useState(""); // "" | "asc" | "desc"
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Local Modal for updating stock levels
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editQty, setEditQty] = useState("");
  const [editMinQty, setEditMinQty] = useState("");
  const [formError, setFormError] = useState("");

  const searchInputRef = useRef(null);

  // Focus search on load
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedWarehouse, selectedBrand, quantitySort]);

  // Extract unique warehouses and brands for filter options
  const filterOptions = useMemo(() => {
    const warehouses = stock.map((s) => s.warehouse);
    const brands = stock.map((s) => s.brand);
    return {
      warehouses: [...new Set(warehouses)].filter(Boolean),
      brands: [...new Set(brands)].filter(Boolean)
    };
  }, [stock]);

  // Optimized Search and Filters using useMemo
  const filteredStock = useMemo(() => {
    let result = [...stock];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.paintId.toLowerCase().includes(q) ||
          s.paintName.toLowerCase().includes(q) ||
          s.brand.toLowerCase().includes(q)
      );
    }

    // Warehouse filter
    if (selectedWarehouse) {
      result = result.filter((s) => s.warehouse === selectedWarehouse);
    }

    // Brand filter
    if (selectedBrand) {
      result = result.filter((s) => s.brand === selectedBrand);
    }

    // Sort by Quantity
    if (quantitySort === "asc") {
      result.sort((a, b) => a.quantity - b.quantity);
    } else if (quantitySort === "desc") {
      result.sort((a, b) => b.quantity - a.quantity);
    }

    return result;
  }, [stock, searchQuery, selectedWarehouse, selectedBrand, quantitySort]);

  // Paginated data
  const paginatedStock = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredStock.slice(start, start + itemsPerPage);
  }, [filteredStock, currentPage]);

  const handleEditStockTrigger = (item) => {
    setEditTarget(item);
    setEditQty(item.quantity.toString());
    setEditMinQty(item.minQuantity.toString());
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSaveStock = async (e) => {
    e.preventDefault();
    const qty = parseInt(editQty, 10);
    const minQty = parseInt(editMinQty, 10);

    if (isNaN(qty) || qty < 0) {
      setFormError("Quantity must be a valid positive integer.");
      return;
    }
    if (isNaN(minQty) || minQty < 0) {
      setFormError("Minimum quantity must be a valid positive integer.");
      return;
    }

    if (editTarget?.id) {
      try {
        await api.put(`/api/stock/${editTarget.id}`, { quantity: qty, minQuantity: minQty });
      } catch (err) {
        console.warn("API update stock failed, updating local state:", err);
      }
    }

    dispatch({
      type: ACTIONS.UPDATE_STOCK,
      payload: {
        paintId: editTarget.paintId,
        warehouse: editTarget.warehouse,
        quantity: qty,
        minQuantity: minQty
      }
    });

    showToast(
      `Stock levels updated for "${editTarget.paintName}" at ${editTarget.warehouse}.`,
      "success"
    );
    setIsModalOpen(false);
  };

  return (
    <div id="available-stock-page">
      {/* Header */}
      <div className="page-header">
        <div className="page-title">
          <h1>Warehouse Stock Registry</h1>
          <p>Monitor physical stock distributions and safety thresholds across nodes</p>
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
              placeholder="Search SKU or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="stock-search-input"
            />
          </div>

          {/* Warehouse filter */}
          <select
            className="select-input"
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            id="stock-warehouse-filter"
          >
            <option value="">All Warehouses</option>
            {filterOptions.warehouses.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>

          {/* Brand filter */}
          <select
            className="select-input"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            id="stock-brand-filter"
          >
            <option value="">All Brands</option>
            {filterOptions.brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          {/* Sort by Quantity */}
          <select
            className="select-input"
            value={quantitySort}
            onChange={(e) => setQuantitySort(e.target.value)}
            id="stock-quantity-sort"
          >
            <option value="">Sort by Quantity</option>
            <option value="asc">Stock: Low to High</option>
            <option value="desc">Stock: High to Low</option>
          </select>
        </div>

        <div className="filters-right">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearchQuery("");
              setSelectedWarehouse("");
              setSelectedBrand("");
              setQuantitySort("");
            }}
            id="stock-reset-filters"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Stock Table */}
      <div className="table-container">
        <table className="erp-table">
          <thead>
            <tr>
              <th>Paint Name</th>
              <th>Brand</th>
              <th>Warehouse Node</th>
              <th className="text-right">Quantity</th>
              <th className="text-right">Min Quantity</th>
              <th>Status Alert</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedStock.length > 0 ? (
              paginatedStock.map((item, index) => {
                // Status Logic: Green if qty >= min * 1.5, Orange if qty > min but < min * 1.5, Red if qty <= min
                let statusClass = "badge-success";
                let statusLabel = "Adequate";
                
                if (item.quantity <= item.minQuantity) {
                  statusClass = "badge-danger";
                  statusLabel = "Critical Low";
                } else if (item.quantity < item.minQuantity * 1.5) {
                  statusClass = "badge-warning";
                  statusLabel = "Safety Warning";
                }

                return (
                  <tr key={`${item.paintId}-${item.warehouse}-${index}`}>
                    <td>
                      <span className="font-semibold">{item.paintId}</span> - {item.paintName}
                    </td>
                    <td>{item.brand}</td>
                    <td>{item.warehouse}</td>
                    <td className="text-right font-medium">{item.quantity} L</td>
                    <td className="text-right">{item.minQuantity} L</td>
                    <td>
                      <span className={`badge ${statusClass}`}>{statusLabel}</span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleEditStockTrigger(item)}
                        id={`edit-stock-${item.paintId}-${index}`}
                      >
                        Adjust Levels
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" className="text-center" style={{ padding: "3rem", color: "var(--text-muted)" }}>
                  No stock records matched your selection filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalItems={filteredStock.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      {/* Update Stock Modal */}
      {isModalOpen && editTarget && (
        <div className="modal-overlay" id="stock-form-modal">
          <div className="modal-container" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <h3>Adjust Stock Levels</h3>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveStock}>
              <div className="modal-body">
                <div style={{ marginBottom: "1rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>PRODUCT</span>
                  <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{editTarget.paintName} ({editTarget.brand})</span>
                </div>
                <div style={{ marginBottom: "1.25rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>WAREHOUSE LOCATION</span>
                  <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{editTarget.warehouse}</span>
                </div>

                {formError && (
                  <div style={{ color: "var(--danger)", fontSize: "0.75rem", marginBottom: "1rem" }}>
                    {formError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="stock-qty-input">Physical Quantity (liters)</label>
                  <input
                    type="text"
                    id="stock-qty-input"
                    className="form-input"
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="stock-min-qty-input">Minimum Buffer Limit (liters)</label>
                  <input
                    type="text"
                    id="stock-min-qty-input"
                    className="form-input"
                    value={editMinQty}
                    onChange={(e) => setEditMinQty(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" id="save-stock-modal-btn">
                  Update Levels
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
