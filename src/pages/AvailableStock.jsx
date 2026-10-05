import React, { useState, useMemo, useEffect, useRef, useContext } from "react";
import { useToast } from "../context/ToastContext";
import { AuthContext } from "../context/AuthContext";
import Pagination from "../components/Pagination";
import { api } from "../services/api";
import { refreshInventoryData } from "../utils/syncInventory";

export default function AvailableStock({ state, dispatch }) {
  const { stock = [] } = state || {};
  const { showToast } = useToast();
  const { currentUser } = useContext(AuthContext) || {};

  // Filter and sort states for existing Available Stock table
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [quantitySort, setQuantitySort] = useState(""); // "" | "asc" | "desc"
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Local Modal for updating stock levels (existing functionality)
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
        await refreshInventoryData(dispatch);
        showToast(
          `Stock levels updated for "${editTarget.paintName}" at ${editTarget.warehouse}.`,
          "success"
        );
        setIsModalOpen(false);
      } catch (err) {
        console.error("API update stock failed:", err);
        setFormError(err.message || "Failed to update warehouse stock.");
        showToast(err.message || "Failed to update stock.", "danger");
      }
    }
  };

  // ====================================================
  // CONTINUOUS STOCK ADDITION MODULE STATE & HANDLERS
  // ====================================================
  const [paintCodeInput, setPaintCodeInput] = useState("");
  const [isSearchingPaint, setIsSearchingPaint] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productWarehouseStocks, setProductWarehouseStocks] = useState([]);
  const [addStockWarehouse, setAddStockWarehouse] = useState("");
  const [availableWarehousesList, setAvailableWarehousesList] = useState([]);
  const [addQuantity, setAddQuantity] = useState("");
  const [addStockError, setAddStockError] = useState("");
  const [isAddingStock, setIsAddingStock] = useState(false);
  const [lastAdditionResult, setLastAdditionResult] = useState(null);

  // Recent Stock Additions History State
  const [recentAdditions, setRecentAdditions] = useState([]);
  const [loadingRecentAdditions, setLoadingRecentAdditions] = useState(false);

  const paintCodeInputRef = useRef(null);

  // Load distinct warehouse nodes from database
  const loadWarehouses = async () => {
    try {
      const whs = await api.get("/api/stock/warehouses");
      if (Array.isArray(whs) && whs.length > 0) {
        setAvailableWarehousesList(whs);
        if (!addStockWarehouse) {
          setAddStockWarehouse(whs[0]);
        }
        return whs;
      }
    } catch (e) {
      console.warn("Could not fetch warehouses endpoint, using local stock list:", e.message);
    }
    const fallbackWhs = [...new Set(stock.map((s) => s.warehouse))].filter(Boolean);
    if (fallbackWhs.length > 0) {
      setAvailableWarehousesList(fallbackWhs);
      if (!addStockWarehouse) setAddStockWarehouse(fallbackWhs[0]);
    }
    return fallbackWhs;
  };

  // Load recent stock addition transactions
  const loadRecentAdditions = async () => {
    try {
      setLoadingRecentAdditions(true);
      const res = await api.get("/api/stock/recent-additions");
      if (Array.isArray(res)) {
        setRecentAdditions(res);
      }
    } catch (e) {
      console.warn("Failed to load recent stock additions:", e.message);
    } finally {
      setLoadingRecentAdditions(false);
    }
  };

  useEffect(() => {
    loadWarehouses();
    loadRecentAdditions();
  }, []);

  // Update warehouses list if stock changes and warehouses haven't loaded yet
  useEffect(() => {
    if (availableWarehousesList.length === 0 && stock.length > 0) {
      const unique = [...new Set(stock.map((s) => s.warehouse))].filter(Boolean);
      if (unique.length > 0) {
        setAvailableWarehousesList(unique);
        if (!addStockWarehouse) setAddStockWarehouse(unique[0]);
      }
    }
  }, [stock, availableWarehousesList.length, addStockWarehouse]);

  // Compute selected warehouse's actual current stock
  const currentWarehouseStock = useMemo(() => {
    if (!selectedProduct || !addStockWarehouse) return 0;
    // Check locally updated productWarehouseStocks first (has latest live additions)
    const localMatch = productWarehouseStocks.find((w) => w.warehouse === addStockWarehouse);
    if (localMatch !== undefined) return Number(localMatch.quantity);

    // Fallback to state.stock
    const globalMatch = stock.find(
      (s) => s.paintId === selectedProduct.id && s.warehouse === addStockWarehouse
    );
    return globalMatch ? Number(globalMatch.quantity) : 0;
  }, [selectedProduct, addStockWarehouse, productWarehouseStocks, stock]);

  // Search product by Paint Code
  const handleSearchPaintCode = async (e) => {
    if (e) e.preventDefault();
    const code = paintCodeInput.trim();
    if (!code) {
      setSearchError("Please enter a Paint Code to search.");
      return;
    }

    setIsSearchingPaint(true);
    setSearchError("");
    setLastAdditionResult(null);

    try {
      const res = await api.get(`/api/paints/${encodeURIComponent(code)}`);
      if (res && res.success && res.product) {
        setSelectedProduct(res.product);
        const whStocks = res.product.warehouseStocks || [];
        setProductWarehouseStocks(whStocks);

        // Set default warehouse if none selected
        if (!addStockWarehouse) {
          const defaultWh = whStocks[0]?.warehouse || availableWarehousesList[0] || "Central Warehouse - Tirunelveli";
          setAddStockWarehouse(defaultWh);
        }
        setSearchError("");
      } else {
        setSelectedProduct(null);
        setProductWarehouseStocks([]);
        setSearchError(`❌ Paint code "${code}" was not found.`);
      }
    } catch (err) {
      setSelectedProduct(null);
      setProductWarehouseStocks([]);
      setSearchError(err.message || `❌ Paint code "${code}" was not found.`);
    } finally {
      setIsSearchingPaint(false);
    }
  };

  // Perform continuous stock addition
  const handleAddStockSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isAddingStock) return; // Prevent double submission

    if (!selectedProduct) {
      setAddStockError("Please search and select a paint product first.");
      return;
    }

    if (!addStockWarehouse) {
      setAddStockError("Please select a warehouse location.");
      return;
    }

    const trimmedQty = String(addQuantity).trim();
    if (!trimmedQty) {
      setAddStockError("Quantity to Add is required.");
      return;
    }

    const qty = Number(trimmedQty);
    if (isNaN(qty) || !Number.isFinite(qty)) {
      setAddStockError("Quantity must be a valid number.");
      return;
    }

    if (!Number.isInteger(qty)) {
      setAddStockError("Quantity must be a whole integer.");
      return;
    }

    if (qty <= 0) {
      setAddStockError("Quantity to add must be greater than 0.");
      return;
    }

    setIsAddingStock(true);
    setAddStockError("");

    try {
      const res = await api.post("/api/stock/add", {
        paintCode: selectedProduct.id,
        warehouse: addStockWarehouse,
        quantity: qty
      });

      if (res && res.success) {
        setLastAdditionResult(res);
        showToast(
          `✓ ${res.addedQuantity} units successfully added to ${res.warehouse}.`,
          "success"
        );

        // CONTINUOUS STOCK ADDITION:
        // 1. Immediately update the product's local warehouse stocks state
        setProductWarehouseStocks((prev) => {
          const exists = prev.some((w) => w.warehouse === res.warehouse);
          if (exists) {
            return prev.map((w) =>
              w.warehouse === res.warehouse ? { ...w, quantity: res.newStock } : w
            );
          }
          return [
            ...prev,
            { warehouse: res.warehouse, quantity: res.newStock, minQuantity: 15, status: "In Stock" }
          ];
        });

        // 2. Immediately update the product's total stock in local view
        setSelectedProduct((prev) => ({
          ...prev,
          quantity: res.totalProductStock
        }));

        // 3. Clear/reset the Quantity field for immediate next addition
        setAddQuantity("");

        // 4. Selected paint and selected warehouse remain selected!
        // 5. Update global application state so Available Stock table above updates in-place
        await refreshInventoryData(dispatch);

        // 6. Refresh recent stock additions table
        loadRecentAdditions();
      } else {
        const errMsg = res?.error || "Failed to add stock.";
        setAddStockError(errMsg);
        showToast(errMsg, "danger");
      }
    } catch (err) {
      console.error("Add stock request failed:", err);
      const errMsg = err.message || "Failed to add stock due to network/server error.";
      setAddStockError(errMsg);
      showToast(errMsg, "danger");
    } finally {
      setIsAddingStock(false);
    }
  };

  // Change Paint: Clear selected product and reset form
  const handleChangePaint = () => {
    setSelectedProduct(null);
    setProductWarehouseStocks([]);
    setPaintCodeInput("");
    setSearchError("");
    setAddQuantity("");
    setAddStockError("");
    setLastAdditionResult(null);
    setTimeout(() => {
      paintCodeInputRef.current?.focus();
    }, 50);
  };

  return (
    <div id="available-stock-page">
      {/* Header */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div className="page-title">
          <h1>Warehouse Stock Registry</h1>
          <p>Monitor physical stock distributions and safety thresholds across nodes</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            document.getElementById("add-stock-section")?.scrollIntoView({ behavior: "smooth" });
            paintCodeInputRef.current?.focus();
          }}
          id="scroll-to-add-stock-btn"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          + Add Stock
        </button>
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

      {/* ------------------------------------------------ */}
      {/* ADD STOCK MODULE (CONTINUOUS STOCK ADDITION)      */}
      {/* ------------------------------------------------ */}
      <div
        className="card"
        id="add-stock-section"
        style={{
          marginTop: "2.5rem",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-lg)",
          backgroundColor: "var(--bg-card)",
          boxShadow: "var(--shadow-md)"
        }}
      >
        <div
          className="card-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid var(--border-color)",
            padding: "1.25rem 1.5rem"
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                margin: 0,
                color: "var(--text-main)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
              }}
            >
              <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Stock
            </h2>
            <p style={{ margin: "0.25rem 0 0 0", color: "var(--text-muted)", fontSize: "0.875rem" }}>
              Search paint SKU, select warehouse node, and continuously augment stock levels
            </p>
          </div>
          {selectedProduct && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleChangePaint}
              id="change-paint-header-btn"
            >
              Change Paint
            </button>
          )}
        </div>

        <div className="card-body" style={{ padding: "1.5rem" }}>
          {/* Paint Code Search Form */}
          <form onSubmit={handleSearchPaintCode} style={{ marginBottom: "1.5rem" }}>
            <label
              className="form-label"
              htmlFor="paint-code-search-input"
              style={{ fontWeight: 600, marginBottom: "0.5rem", display: "block" }}
            >
              Paint Code
            </label>
            <div style={{ display: "flex", gap: "0.75rem", maxWidth: "600px" }}>
              <input
                ref={paintCodeInputRef}
                type="text"
                id="paint-code-search-input"
                className="form-input"
                placeholder="e.g. PNT-001 or PNT001"
                value={paintCodeInput}
                onChange={(e) => {
                  setPaintCodeInput(e.target.value);
                  if (searchError) setSearchError("");
                }}
                disabled={isSearchingPaint}
                style={{ flex: 1, textTransform: "uppercase" }}
              />
              <button
                type="submit"
                id="search-paint-btn"
                className="btn btn-primary"
                disabled={isSearchingPaint || !paintCodeInput.trim()}
                style={{ minWidth: "120px" }}
              >
                {isSearchingPaint ? "Searching..." : "Search"}
              </button>
            </div>
            {searchError && (
              <div
                id="search-error-msg"
                style={{
                  marginTop: "0.75rem",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--danger-bg)",
                  color: "var(--danger-text)",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  maxWidth: "600px"
                }}
              >
                {searchError}
              </div>
            )}
          </form>

          {/* Product Details & Stock Addition Flow */}
          {selectedProduct && (
            <div id="product-found-container" style={{ animation: "fadeIn 0.2s ease" }}>
              {/* Product Found Indicator */}
              <div
                id="product-found-badge"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.375rem 0.75rem",
                  borderRadius: "9999px",
                  backgroundColor: "var(--success-bg)",
                  color: "var(--success-text)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  marginBottom: "1.25rem"
                }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Product Found
              </div>

              {/* Product Details Card */}
              <div
                className="product-details-card"
                id="product-details-card"
                style={{
                  backgroundColor: "var(--bg-main)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)",
                  padding: "1.25rem",
                  marginBottom: "1.5rem"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid var(--border-color)",
                    paddingBottom: "0.75rem",
                    marginBottom: "1rem"
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text-main)" }}>
                    Paint Details
                  </h3>
                  <span className="badge badge-info" style={{ textTransform: "uppercase" }}>
                    {selectedProduct.status}
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "1rem"
                  }}
                >
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Paint Code
                    </span>
                    <span style={{ fontWeight: 700, fontSize: "0.9375rem" }} id="detail-paint-code">
                      {selectedProduct.id}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Product Name
                    </span>
                    <span style={{ fontWeight: 600, fontSize: "0.9375rem" }} id="detail-product-name">
                      {selectedProduct.name}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Brand
                    </span>
                    <span style={{ fontWeight: 600, fontSize: "0.9375rem" }} id="detail-brand">
                      {selectedProduct.brand}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Category
                    </span>
                    <span style={{ fontWeight: 500, fontSize: "0.9375rem" }} id="detail-category">
                      {selectedProduct.category}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Color
                    </span>
                    <span style={{ fontWeight: 500, fontSize: "0.9375rem" }} id="detail-color">
                      {selectedProduct.color}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Finish
                    </span>
                    <span style={{ fontWeight: 500, fontSize: "0.9375rem" }} id="detail-finish">
                      {selectedProduct.finish}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Size
                    </span>
                    <span style={{ fontWeight: 500, fontSize: "0.9375rem" }}>20 L</span>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Unit Price
                    </span>
                    <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--primary)" }} id="detail-price">
                      ₹{Number(selectedProduct.price).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      GST
                    </span>
                    <span style={{ fontWeight: 500, fontSize: "0.9375rem" }}>18%</span>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Total Catalog Stock
                    </span>
                    <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text-main)" }} id="detail-total-stock">
                      {selectedProduct.quantity} L
                    </span>
                  </div>
                </div>
              </div>

              {/* Warehouse Selection & Quantity Form */}
              <form onSubmit={handleAddStockSubmit} style={{ maxWidth: "600px" }}>
                {/* Warehouse Dropdown */}
                <div className="form-group" style={{ marginBottom: "1.25rem" }}>
                  <label className="form-label" htmlFor="add-stock-warehouse-select" style={{ fontWeight: 600 }}>
                    Warehouse
                  </label>
                  <select
                    id="add-stock-warehouse-select"
                    className="select-input w-full"
                    value={addStockWarehouse}
                    onChange={(e) => setAddStockWarehouse(e.target.value)}
                    style={{ width: "100%", padding: "0.625rem 2rem 0.625rem 0.75rem" }}
                  >
                    {availableWarehousesList.map((wh) => (
                      <option key={wh} value={wh}>
                        {wh}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Warehouse Current Stock Display */}
                <div
                  id="warehouse-current-stock-box"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1rem 1.25rem",
                    backgroundColor: "var(--bg-main)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-md)",
                    marginBottom: "1.25rem"
                  }}
                >
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {addStockWarehouse || "Selected Warehouse"}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Physical Inventory</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Current Stock</span>
                    <span
                      id="selected-warehouse-current-stock"
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: 800,
                        color: currentWarehouseStock <= 15 ? "var(--danger)" : "var(--primary)"
                      }}
                    >
                      {currentWarehouseStock} L
                    </span>
                  </div>
                </div>

                {/* Quantity to Add */}
                <div className="form-group" style={{ marginBottom: "1.25rem" }}>
                  <label className="form-label" htmlFor="add-stock-qty-input" style={{ fontWeight: 600 }}>
                    Quantity to Add
                  </label>
                  <input
                    type="number"
                    id="add-stock-qty-input"
                    className="form-input"
                    placeholder="Enter quantity to add (e.g. 500)"
                    min="1"
                    step="1"
                    value={addQuantity}
                    onChange={(e) => {
                      setAddQuantity(e.target.value);
                      if (addStockError) setAddStockError("");
                    }}
                    disabled={isAddingStock}
                  />
                  {addStockError && (
                    <div id="add-stock-error-msg" style={{ color: "var(--danger)", fontSize: "0.8125rem", marginTop: "0.375rem", fontWeight: 500 }}>
                      {addStockError}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "1.5rem" }}>
                  <button
                    type="submit"
                    id="submit-add-stock-btn"
                    className="btn btn-primary"
                    disabled={isAddingStock}
                    style={{ minWidth: "150px" }}
                  >
                    {isAddingStock ? (
                      <>
                        <span className="spinner-border spinner-border-sm" style={{ width: "1rem", height: "1rem", marginRight: "0.5rem" }}></span>
                        Adding Stock...
                      </>
                    ) : (
                      "+ Add Stock"
                    )}
                  </button>
                  <button
                    type="button"
                    id="change-paint-btn"
                    className="btn btn-secondary"
                    onClick={handleChangePaint}
                    disabled={isAddingStock}
                  >
                    Change Paint
                  </button>
                </div>
              </form>

              {/* Success Result Banner */}
              {lastAdditionResult && (
                <div
                  id="stock-addition-success-banner"
                  style={{
                    marginTop: "1.5rem",
                    padding: "1rem 1.25rem",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--success-bg)",
                    border: "1px solid var(--success)",
                    color: "var(--success-text)",
                    maxWidth: "600px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "0.9375rem", marginBottom: "0.375rem" }}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    ✓ {lastAdditionResult.addedQuantity} units successfully added to {lastAdditionResult.warehouse}.
                  </div>
                  <div style={{ fontSize: "0.875rem", display: "flex", gap: "1.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                    <span>Previous Stock: <strong>{lastAdditionResult.previousStock} L</strong></span>
                    <span>Added: <strong>{lastAdditionResult.addedQuantity} L</strong></span>
                    <span>New Stock: <strong style={{ fontSize: "1rem" }}>{lastAdditionResult.newStock} L</strong></span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------ */}
      {/* RECENT STOCK ADDITIONS SECTION                    */}
      {/* ------------------------------------------------ */}
      <div
        className="card"
        id="recent-stock-additions-section"
        style={{
          marginTop: "2.5rem",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-lg)",
          backgroundColor: "var(--bg-card)",
          boxShadow: "var(--shadow-md)"
        }}
      >
        <div
          className="card-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid var(--border-color)",
            padding: "1.25rem 1.5rem"
          }}
        >
          <div>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--text-main)" }}>
              Recent Stock Additions
            </h3>
            <p style={{ margin: "0.25rem 0 0 0", color: "var(--text-muted)", fontSize: "0.8125rem" }}>
              Audit ledger of stock replenishment transactions across warehouse nodes
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadRecentAdditions}
            disabled={loadingRecentAdditions}
            id="refresh-recent-additions-btn"
          >
            {loadingRecentAdditions ? "Refreshing..." : "Refresh History"}
          </button>
        </div>

        <div className="table-container" style={{ margin: 0 }}>
          <table className="erp-table" id="recent-additions-table">
            <thead>
              <tr>
                <th>Paint Code</th>
                <th>Product Name</th>
                <th>Warehouse Node</th>
                <th className="text-right">Previous</th>
                <th className="text-right">Added</th>
                <th className="text-right">New Stock</th>
                <th>Added By</th>
                <th>Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {recentAdditions.length > 0 ? (
                recentAdditions.map((tx, idx) => (
                  <tr key={tx.id || idx}>
                    <td>
                      <span className="font-semibold">{tx.paintCode}</span>
                    </td>
                    <td>{tx.paintName}</td>
                    <td>{tx.warehouse}</td>
                    <td className="text-right font-medium">{tx.previousStock} L</td>
                    <td className="text-right font-bold" style={{ color: "var(--success)" }}>
                      +{tx.addedQuantity} L
                    </td>
                    <td className="text-right font-bold" style={{ color: "var(--primary)" }}>
                      {tx.newStock} L
                    </td>
                    <td>
                      <span className="badge badge-info">{tx.addedBy || "Staff"}</span>
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
                      {tx.date ? new Date(tx.date).toLocaleString("en-IN") : "Today"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center" style={{ padding: "2.5rem", color: "var(--text-muted)" }}>
                    No recent stock additions recorded yet. Use the Add Stock form above to replenish inventory.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update Stock Modal (Existing functionality preserved) */}
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
