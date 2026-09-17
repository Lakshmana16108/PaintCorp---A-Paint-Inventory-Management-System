import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { ACTIONS } from "../reducers/inventoryReducer";
import { useToast } from "../context/ToastContext";
import Pagination from "../components/Pagination";
import ConfirmationDialog from "../components/ConfirmationDialog";
import { formatCurrency } from "../utils/currencyFormatter";
import { api } from "../services/api";

export default function PaintList({ state, dispatch }) {
  const { paints = [] } = state || {};
  const { showToast } = useToast();

  // Search, Filter, Sort, Pagination states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [priceSort, setPriceSort] = useState(""); // "" | "asc" | "desc"
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Local Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // "add" | "edit"
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    brand: "",
    category: "",
    color: "",
    finish: "",
    price: "",
    quantity: ""
  });
  const [formErrors, setFormErrors] = useState({});

  // Confirmation dialog states
  const [deleteId, setDeleteId] = useState(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Focus refs
  const searchRef = useRef(null);
  const modalFirstInputRef = useRef(null);

  // Sync search input focus
  useEffect(() => {
    // Focus search on mount
    searchRef.current?.focus();
  }, []);

  // Set modal focus when it opens
  useEffect(() => {
    if (isModalOpen) {
      setTimeout(() => {
        modalFirstInputRef.current?.focus();
      }, 50);
    }
  }, [isModalOpen]);

  // Extract unique brands for filter options
  const uniqueBrands = useMemo(() => {
    const brands = paints.map((p) => p.brand);
    return [...new Set(brands)].filter(Boolean);
  }, [paints]);

  // Optimized Search & Filter Results using useMemo
  const filteredPaints = useMemo(() => {
    let result = [...paints];

    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.id.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.color.toLowerCase().includes(q)
      );
    }

    // Brand filter
    if (selectedBrand) {
      result = result.filter((p) => p.brand === selectedBrand);
    }

    // Price sorting
    if (priceSort === "asc") {
      result.sort((a, b) => a.price - b.price);
    } else if (priceSort === "desc") {
      result.sort((a, b) => b.price - a.price);
    }

    return result;
  }, [paints, searchQuery, selectedBrand, priceSort]);

  // Reset page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedBrand, priceSort]);

  // Paginated results
  const paginatedPaints = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPaints.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPaints, currentPage]);

  // Memoized Delete handler using useCallback
  const handleDeleteConfirm = useCallback(async () => {
    if (deleteId) {
      try {
        await api.delete(`/api/paints/${deleteId}`);
      } catch (err) {
        console.warn("API delete failed, performing local delete", err);
      }
      dispatch({ type: ACTIONS.DELETE_PAINT, payload: deleteId });
      showToast(`Paint SKU ${deleteId} deleted successfully.`, "success");
      setDeleteId(null);
      setIsConfirmOpen(false);

      // Adjust page if page becomes empty
      const totalPages = Math.ceil((filteredPaints.length - 1) / itemsPerPage);
      if (currentPage > totalPages && currentPage > 1) {
        setCurrentPage(totalPages);
      }
    }
  }, [deleteId, dispatch, showToast, currentPage, filteredPaints.length]);

  const handleDeleteTrigger = (id) => {
    setDeleteId(id);
    setIsConfirmOpen(true);
  };

  const handleOpenAddModal = () => {
    setModalMode("add");
    setFormData({
      id: "PNT" + Math.floor(100 + Math.random() * 900),
      name: "",
      brand: "",
      category: "Interior",
      color: "",
      finish: "Matte",
      price: "",
      quantity: ""
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (paint) => {
    setModalMode("edit");
    setFormData({
      id: paint.id,
      name: paint.name,
      brand: paint.brand,
      category: paint.category,
      color: paint.color,
      finish: paint.finish,
      price: paint.price.toString(),
      quantity: paint.quantity.toString()
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = "Paint name is required.";
    if (!formData.brand.trim()) errors.brand = "Brand is required.";
    if (!formData.color.trim()) errors.color = "Color is required.";
    
    const parsedPrice = parseFloat(formData.price);
    if (!formData.price.trim()) {
      errors.price = "Price is required.";
    } else if (isNaN(parsedPrice) || parsedPrice <= 0) {
      errors.price = "Price must be a valid number greater than 0.";
    }

    const parsedQty = parseInt(formData.quantity, 10);
    if (!formData.quantity.trim()) {
      errors.quantity = "Quantity is required.";
    } else if (isNaN(parsedQty) || parsedQty < 0) {
      errors.quantity = "Quantity must be a positive integer.";
    }

    if (modalMode === "add") {
      const idExists = paints.some((p) => p.id === formData.id);
      if (idExists) {
        errors.id = "Paint SKU code already exists.";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSavePaint = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const paintPayload = {
      id: formData.id,
      name: formData.name,
      brand: formData.brand,
      category: formData.category,
      color: formData.color,
      finish: formData.finish,
      price: parseFloat(formData.price),
      quantity: parseInt(formData.quantity, 10)
    };

    try {
      if (modalMode === "add") {
        await api.post("/api/paints", paintPayload);
        dispatch({ type: ACTIONS.ADD_PAINT, payload: paintPayload });
        showToast(`New paint formulation "${paintPayload.name}" added to warehouse records.`, "success");
      } else {
        await api.put(`/api/paints/${paintPayload.id}`, paintPayload);
        dispatch({ type: ACTIONS.UPDATE_PAINT, payload: paintPayload });
        showToast(`Updated SKU ${paintPayload.id} records successfully.`, "success");
      }
    } catch (err) {
      console.warn("API operation error, applying local state update:", err);
      if (modalMode === "add") {
        dispatch({ type: ACTIONS.ADD_PAINT, payload: paintPayload });
      } else {
        dispatch({ type: ACTIONS.UPDATE_PAINT, payload: paintPayload });
      }
    }

    setIsModalOpen(false);
  };

  return (
    <div id="paint-list-page">
      {/* Header section with add button */}
      <div className="page-header">
        <div className="page-title">
          <h1>Paint Catalog Management</h1>
          <p>Maintain warehouse stock products and formulations</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={handleOpenAddModal} id="add-paint-btn">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add New Paint
          </button>
        </div>
      </div>

      {/* Filters section */}
      <div className="filters-bar">
        <div className="filters-left">
          {/* Search Input using Ref */}
          <div className="search-input-wrapper" onClick={() => searchRef.current?.focus()}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="search-icon">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search by ID, name, brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="paint-search-input"
            />
          </div>

          {/* Brand Filter */}
          <select
            className="select-input"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            id="paint-brand-filter"
          >
            <option value="">All Brands</option>
            {uniqueBrands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          {/* Price Sorting */}
          <select
            className="select-input"
            value={priceSort}
            onChange={(e) => setPriceSort(e.target.value)}
            id="paint-price-sort"
          >
            <option value="">Sort by Price</option>
            <option value="asc">Price: Low to High</option>
            <option value="desc">Price: High to Low</option>
          </select>
        </div>
        <div className="filters-right">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearchQuery("");
              setSelectedBrand("");
              setPriceSort("");
            }}
            id="paint-reset-filters"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Table section */}
      <div className="table-container">
        <table className="erp-table">
          <thead>
            <tr>
              <th>Paint ID</th>
              <th>Paint Name</th>
              <th>Brand</th>
              <th>Category</th>
              <th>Color</th>
              <th>Finish</th>
              <th className="text-right">Price</th>
              <th className="text-right">Total Qty</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPaints.length > 0 ? (
              paginatedPaints.map((paint) => (
                <tr key={paint.id}>
                  <td className="font-semibold">{paint.id}</td>
                  <td>{paint.name}</td>
                  <td>{paint.brand}</td>
                  <td>{paint.category}</td>
                  <td>{paint.color}</td>
                  <td>{paint.finish}</td>
                  <td className="text-right">{formatCurrency(paint.price)}</td>
                  <td className="text-right font-medium">{paint.quantity} L</td>
                  <td>
                    <span
                      className={`badge ${
                        paint.status === "In Stock"
                          ? "badge-success"
                          : paint.status === "Low Stock"
                          ? "badge-warning"
                          : "badge-danger"
                      }`}
                    >
                      {paint.status}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenEditModal(paint)}
                      id={`edit-paint-${paint.id}`}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteTrigger(paint.id)}
                      id={`delete-paint-${paint.id}`}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" className="text-center" style={{ padding: "3rem", color: "var(--text-muted)" }}>
                  No paint items matched your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalItems={filteredPaints.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isConfirmOpen}
        title="Confirm Deletion"
        message={`Are you sure you want to delete paint SKU code "${deleteId}"? This will clear stock values for this paint.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsConfirmOpen(false)}
      />

      {/* Add / Edit Paint Modal */}
      {isModalOpen && (
        <div className="modal-overlay" id="paint-form-modal">
          <div className="modal-container">
            <div className="modal-header">
              <h3>{modalMode === "add" ? "Register Paint Product" : "Edit Paint Configuration"}</h3>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSavePaint}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="modal-paint-id">Paint ID / SKU</label>
                  <input
                    ref={modalFirstInputRef}
                    type="text"
                    id="modal-paint-id"
                    className={`form-input ${formErrors.id ? "error" : ""}`}
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    disabled={modalMode === "edit"}
                  />
                  {formErrors.id && <div className="form-error">{formErrors.id}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="modal-paint-name">Paint Formulation Name</label>
                  <input
                    type="text"
                    id="modal-paint-name"
                    className={`form-input ${formErrors.name ? "error" : ""}`}
                    placeholder="e.g. Silk Glamor Matt"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                  {formErrors.name && <div className="form-error">{formErrors.name}</div>}
                </div>

                <div className="form-group row">
                  <div>
                    <label className="form-label" htmlFor="modal-brand">Brand Name</label>
                    <input
                      type="text"
                      id="modal-brand"
                      className={`form-input ${formErrors.brand ? "error" : ""}`}
                      placeholder="e.g. Dulux"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    />
                    {formErrors.brand && <div className="form-error">{formErrors.brand}</div>}
                  </div>
                  <div>
                    <label className="form-label" htmlFor="modal-category">Category</label>
                    <select
                      id="modal-category"
                      className="select-input w-full"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      style={{ padding: "0.625rem 2rem 0.625rem 0.75rem" }}
                    >
                      <option value="Interior">Interior</option>
                      <option value="Exterior">Exterior</option>
                      <option value="Primer">Primer</option>
                      <option value="Wood & Metal">Wood & Metal</option>
                    </select>
                  </div>
                </div>

                <div className="form-group row">
                  <div>
                    <label className="form-label" htmlFor="modal-color">Color Code / Shade</label>
                    <input
                      type="text"
                      id="modal-color"
                      className={`form-input ${formErrors.color ? "error" : ""}`}
                      placeholder="e.g. Cherry Red"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    />
                    {formErrors.color && <div className="form-error">{formErrors.color}</div>}
                  </div>
                  <div>
                    <label className="form-label" htmlFor="modal-finish">Finish Type</label>
                    <select
                      id="modal-finish"
                      className="select-input w-full"
                      value={formData.finish}
                      onChange={(e) => setFormData({ ...formData, finish: e.target.value })}
                      style={{ padding: "0.625rem 2rem 0.625rem 0.75rem" }}
                    >
                      <option value="Matte">Matte</option>
                      <option value="Satin">Satin</option>
                      <option value="Semi-Gloss">Semi-Gloss</option>
                      <option value="Gloss">Gloss</option>
                    </select>
                  </div>
                </div>

                <div className="form-group row">
                  <div>
                    <label className="form-label" htmlFor="modal-price">Price (₹ per liter)</label>
                    <input
                      type="text"
                      id="modal-price"
                      className={`form-input ${formErrors.price ? "error" : ""}`}
                      placeholder="0.00"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    />
                    {formErrors.price && <div className="form-error">{formErrors.price}</div>}
                  </div>
                  <div>
                    <label className="form-label" htmlFor="modal-qty">Initial Total Qty (liters)</label>
                    <input
                      type="text"
                      id="modal-qty"
                      className={`form-input ${formErrors.quantity ? "error" : ""}`}
                      placeholder="0"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      disabled={modalMode === "edit"} // Quantity edited via Stock system for audit trail integrity
                    />
                    {formErrors.quantity && <div className="form-error">{formErrors.quantity}</div>}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" id="save-paint-modal-btn">
                  {modalMode === "add" ? "Register Product" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
