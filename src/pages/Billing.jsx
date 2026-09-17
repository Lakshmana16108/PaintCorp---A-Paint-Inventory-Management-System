import React, { useState, useMemo, useRef, useEffect } from "react";
import { ACTIONS } from "../reducers/inventoryReducer";
import { useToast } from "../context/ToastContext";
import { formatCurrency } from "../utils/currencyFormatter";
import { api } from "../services/api";

const DRAFT_STORAGE_KEY = "el2_billing_draft";

const getInitialDraft = () => {
  try {
    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to parse saved billing draft:", e);
  }
  return null;
};

// Helper function to convert numeric amount to Rupees in words
function numberToWords(num) {
  if (!num || isNaN(num) || num <= 0) return "ZERO RUPEES ONLY";
  const a = ['', 'ONE ', 'TWO ', 'THREE ', 'FOUR ', 'FIVE ', 'SIX ', 'SEVEN ', 'EIGHT ', 'NINE ', 'TEN ', 'ELEVEN ', 'TWELVE ', 'THIRTEEN ', 'FOURTEEN ', 'FIFTEEN ', 'SIXTEEN ', 'SEVENTEEN ', 'EIGHTEEN ', 'NINETEEN '];
  const b = ['', '', 'TWENTY ', 'THIRTY ', 'FORTY ', 'FIFTY ', 'SIXTY ', 'SEVENTY ', 'EIGHTY ', 'NINETY '];

  function inWords(n) {
    if ((n = n.toString()).length > 9) return 'OVERFLOW';
    let nArr = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!nArr) return '';
    let str = '';
    str += (nArr[1] != 0) ? (a[Number(nArr[1])] || b[nArr[1][0]] + ' ' + a[nArr[1][1]]) + 'CRORE ' : '';
    str += (nArr[2] != 0) ? (a[Number(nArr[2])] || b[nArr[2][0]] + ' ' + a[nArr[2][1]]) + 'LAKH ' : '';
    str += (nArr[3] != 0) ? (a[Number(nArr[3])] || b[nArr[3][0]] + ' ' + a[nArr[3][1]]) + 'THOUSAND ' : '';
    str += (nArr[4] != 0) ? (a[Number(nArr[4])] || b[nArr[4][0]] + ' ' + a[nArr[4][1]]) + 'HUNDRED ' : '';
    str += (nArr[5] != 0) ? ((str != '') ? 'AND ' : '') + (a[Number(nArr[5])] || b[nArr[5][0]] + ' ' + a[nArr[5][1]]) : '';
    return str;
  }

  const integerPart = Math.floor(num);
  const words = inWords(integerPart);
  return `${words.trim()} RUPEES ONLY`;
}

export default function Billing({ state, dispatch }) {
  const { paints = [] } = state || {};
  const { showToast } = useToast();

  const initialDraft = useMemo(() => getInitialDraft(), []);

  // Customer Profile states
  const [customerName, setCustomerName] = useState(initialDraft?.customerName || "");
  const [customerPhone, setCustomerPhone] = useState(initialDraft?.customerPhone || "");
  const [customerGst, setCustomerGst] = useState(initialDraft?.customerGst || "");
  const [customerAddress, setCustomerAddress] = useState(initialDraft?.customerAddress || "");
  const [invoiceDate, setInvoiceDate] = useState(
    initialDraft?.invoiceDate || new Date().toISOString().split("T")[0]
  );

  // Dynamic Invoice Number (seeded on load)
  const [invoiceNumber, setInvoiceNumber] = useState(initialDraft?.invoiceNumber || "");
  useEffect(() => {
    if (!invoiceNumber) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      setInvoiceNumber(`INV-20260808-${randomSuffix}`);
    }
  }, [invoiceNumber]);

  // Item Selection states
  const [selectedPaintId, setSelectedPaintId] = useState(initialDraft?.selectedPaintId || "");
  const [paintSearchQuery, setPaintSearchQuery] = useState("");
  const [isPaintDropdownOpen, setIsPaintDropdownOpen] = useState(false);
  const comboboxRef = useRef(null);

  const [itemQuantity, setItemQuantity] = useState(initialDraft?.itemQuantity || "1");
  const [invoiceItems, setInvoiceItems] = useState(initialDraft?.invoiceItems || []);
  const [lastSaved, setLastSaved] = useState(initialDraft?.lastSaved || null);

  // Sync paintSearchQuery when selectedPaintId changes or paints list updates
  useEffect(() => {
    if (selectedPaintId) {
      const p = paints.find((item) => item.id === selectedPaintId);
      if (p) {
        setPaintSearchQuery(`${p.id} - ${p.name}`);
      }
    }
  }, [selectedPaintId, paints]);

  // Click outside listener to close search dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target)) {
        setIsPaintDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter paints by Paint ID, Name, Brand, Category, or Color
  const filteredPaints = useMemo(() => {
    if (!paintSearchQuery.trim()) return paints;
    const q = paintSearchQuery.toLowerCase().trim();
    return paints.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.color.toLowerCase().includes(q) ||
        `${p.id} - ${p.name}`.toLowerCase().includes(q)
    );
  }, [paints, paintSearchQuery]);

  const handleSelectPaint = (paint) => {
    if (paint.quantity <= 0) {
      showToast(`Notice: "${paint.name}" (${paint.id}) is Out of Stock.`, "warning");
    }
    setSelectedPaintId(paint.id);
    setPaintSearchQuery(`${paint.id} - ${paint.name}`);
    setIsPaintDropdownOpen(false);
  };

  // Autosave effect: Persist state whenever fields or cart items change
  useEffect(() => {
    const hasContent =
      customerName.trim() ||
      customerPhone.trim() ||
      customerGst.trim() ||
      customerAddress.trim() ||
      selectedPaintId ||
      invoiceItems.length > 0;

    if (hasContent) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const draftData = {
        customerName,
        customerPhone,
        customerGst,
        customerAddress,
        invoiceDate,
        invoiceNumber,
        selectedPaintId,
        itemQuantity,
        invoiceItems,
        lastSaved: timeStr
      };
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
        setLastSaved(timeStr);
      } catch (err) {
        console.error("Error saving billing draft to localStorage:", err);
      }
    }
  }, [
    customerName,
    customerPhone,
    customerGst,
    customerAddress,
    invoiceDate,
    invoiceNumber,
    selectedPaintId,
    itemQuantity,
    invoiceItems
  ]);

  const [formErrors, setFormErrors] = useState({});
  const printAreaRef = useRef(null);

  // Computed Totals & Discretionary Discounts matching Enterprise Tax Invoice math
  const subtotal = useMemo(() => {
    return invoiceItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }, [invoiceItems]);

  const cashDiscount = useMemo(() => subtotal * 0.05, [subtotal]); // 5% Cash Discount
  const assessableValue = useMemo(() => Math.max(0, subtotal - cashDiscount), [subtotal, cashDiscount]);
  const cgst = useMemo(() => assessableValue * 0.09, [assessableValue]); // 9% CGST
  const sgst = useMemo(() => assessableValue * 0.09, [assessableValue]); // 9% SGST
  const grandTotal = useMemo(() => assessableValue + cgst + sgst, [assessableValue, cgst, sgst]);

  const totalPacks = useMemo(() => {
    return invoiceItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [invoiceItems]);

  // Selected Paint details memoized
  const currentSelectedPaint = useMemo(() => {
    return paints.find((p) => p.id === selectedPaintId) || null;
  }, [paints, selectedPaintId]);

  // Add Item to Invoice handler
  const handleAddItem = (e) => {
    e.preventDefault();
    if (!currentSelectedPaint) {
      showToast("Please search and select a paint product by ID or Name.", "warning");
      return;
    }

    const qty = parseInt(itemQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      showToast("Quantity must be at least 1.", "warning");
      return;
    }

    if (qty > currentSelectedPaint.quantity) {
      showToast(
        `Insufficient stock! Only ${currentSelectedPaint.quantity} units available.`,
        "danger"
      );
      return;
    }

    // Check if item already exists in current draft invoice
    const existingIndex = invoiceItems.findIndex(
      (item) => item.paintId === currentSelectedPaint.id
    );

    if (existingIndex !== -1) {
      const updated = [...invoiceItems];
      const newQty = updated[existingIndex].quantity + qty;

      if (newQty > currentSelectedPaint.quantity) {
        showToast(
          `Cannot exceed available inventory count of ${currentSelectedPaint.quantity}.`,
          "danger"
        );
        return;
      }

      updated[existingIndex].quantity = newQty;
      setInvoiceItems(updated);
    } else {
      setInvoiceItems((prev) => [
        ...prev,
        {
          paintId: currentSelectedPaint.id,
          paintName: currentSelectedPaint.name,
          brand: currentSelectedPaint.brand,
          price: currentSelectedPaint.price,
          quantity: qty
        }
      ]);
    }

    showToast(`Added "${currentSelectedPaint.name}" x ${qty} to invoice draft.`, "success");
    setSelectedPaintId("");
    setPaintSearchQuery("");
    setItemQuantity("1");
    setIsPaintDropdownOpen(false);
  };

  // Remove Item from Draft
  const handleRemoveItem = (paintId) => {
    setInvoiceItems((prev) => prev.filter((item) => item.paintId !== paintId));
    showToast("Item removed from invoice draft.", "info");
  };

  // GSTIN Format Validation Helper (Standard Indian 15-character Alphanumeric GSTIN)
  const validateGSTIN = (gst) => {
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
    return gstRegex.test(gst.trim());
  };

  // Form Validation for Billing Checkout
  const validateBillingForm = () => {
    const errors = {};
    const phoneRegex = /^\+?[0-9]{10,14}$/;

    if (!customerName.trim()) errors.name = "Customer name is required.";
    if (!customerPhone.trim()) {
      errors.phone = "Phone number is required.";
    } else if (!phoneRegex.test(customerPhone.replace(/\s+/g, ""))) {
      errors.phone = "Invalid phone number format.";
    }

    // Strict GST Number Validation
    if (!customerGst.trim()) {
      errors.gst = "GSTIN / GST Number is required to initiate billing.";
    } else if (!validateGSTIN(customerGst)) {
      errors.gst = "Invalid GSTIN format. Must be 15 characters (e.g. 27ABCDE1234F1Z5).";
    }

    if (!customerAddress.trim()) errors.address = "Billing address is required.";
    if (invoiceItems.length === 0) errors.items = "Add at least 1 paint item to bill.";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Generate & Save Order Invoice
  const handleGenerateInvoice = async (e) => {
    e.preventDefault();
    if (!validateBillingForm()) {
      if (!customerGst.trim() || !validateGSTIN(customerGst)) {
        showToast("Billing cannot initiate without a valid 15-character GSTIN number.", "danger");
      } else if (invoiceItems.length === 0) {
        showToast("Cannot generate empty invoice. Add products first.", "danger");
      } else {
        showToast("Please fill in all customer details correctly.", "danger");
      }
      return;
    }

    // Create Order records for each item in the invoice
    for (const item of invoiceItems) {
      const orderPayload = {
        id: `ORD${Math.floor(200 + Math.random() * 800)}`,
        customerName,
        customerPhone,
        customerGst: customerGst.toUpperCase(),
        customerAddress,
        paintId: item.paintId,
        paintName: item.paintName,
        quantity: item.quantity,
        price: item.price,
        date: invoiceDate,
        status: "Pending"
      };

      try {
        await api.post("/api/orders", orderPayload);
      } catch (err) {
        console.warn("API post order error, updating local state:", err);
      }
      dispatch({ type: ACTIONS.ADD_ORDER, payload: orderPayload });
    }

    showToast(`Invoice ${invoiceNumber} generated for GSTIN ${customerGst.toUpperCase()}.`, "success");

    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setLastSaved(null);

    setTimeout(() => {
      handlePrintInvoice();
    }, 500);
  };

  // Print Invoice using useRef & standard print command
  const handlePrintInvoice = () => {
    if (invoiceItems.length === 0) {
      showToast("Cannot print empty invoice.", "warning");
      return;
    }
    window.print();
  };

  const handleResetForm = () => {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerGst("");
    setCustomerAddress("");
    setSelectedPaintId("");
    setPaintSearchQuery("");
    setIsPaintDropdownOpen(false);
    setItemQuantity("1");
    setInvoiceItems([]);
    setFormErrors({});
    setLastSaved(null);
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setInvoiceNumber(`INV-20260808-${randomSuffix}`);
    showToast("Billing form reset.", "info");
  };

  return (
    <div id="billing-page">
      {/* Header */}
      <div className="page-header">
        <div className="page-title">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <h1>Billing & Invoicing</h1>
            {lastSaved && (
              <span
                id="billing-autosaved-badge"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "0.25rem 0.625rem",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                  color: "#059669",
                  border: "1px solid rgba(16, 185, 129, 0.25)"
                }}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Draft Autosaved {lastSaved ? `at ${lastSaved}` : ""}
              </span>
            )}
          </div>
          <p>Generate official GST Tax Invoices and record sales dispatches</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={handleResetForm} id="billing-reset-btn">
            New Invoice
          </button>
          <button className="btn btn-primary" onClick={handlePrintInvoice} disabled={invoiceItems.length === 0} id="billing-print-btn">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Tax Invoice
          </button>
        </div>
      </div>

      <div className="billing-layout">
        {/* Billing Form */}
        <div className="card" id="billing-form-card">
          <h3 className="card-title">Customer & GST Details</h3>

          <form onSubmit={handleGenerateInvoice}>
            {/* Customer Details & GST Field */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div className="form-group row">
                <div>
                  <label className="form-label" htmlFor="customer-name">Customer Full Name *</label>
                  <input
                    type="text"
                    id="customer-name"
                    className={`form-input ${formErrors.name ? "error" : ""}`}
                    placeholder="e.g. KRISHNA PAINTS"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                  {formErrors.name && <div className="form-error">{formErrors.name}</div>}
                </div>

                <div>
                  <label className="form-label" htmlFor="customer-phone">Contact Phone Number *</label>
                  <input
                    type="text"
                    id="customer-phone"
                    className={`form-input ${formErrors.phone ? "error" : ""}`}
                    placeholder="e.g. +91 9366701553"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                  {formErrors.phone && <div className="form-error">{formErrors.phone}</div>}
                </div>
              </div>

              {/* GSTIN & Invoice Date Row */}
              <div className="form-group row">
                <div>
                  <label className="form-label" htmlFor="customer-gst" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>GSTIN / GST Number *</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 600 }}>Mandatory</span>
                  </label>
                  <input
                    type="text"
                    id="customer-gst"
                    className={`form-input ${formErrors.gst ? "error" : ""}`}
                    placeholder="e.g. 33AHRPK6118P1ZR"
                    value={customerGst}
                    onChange={(e) => setCustomerGst(e.target.value.toUpperCase())}
                    maxLength={15}
                  />
                  {formErrors.gst ? (
                    <div className="form-error">{formErrors.gst}</div>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginTop: "0.25rem" }}>
                      Standard 15-character Alphanumeric GSTIN
                    </span>
                  )}
                </div>

                <div>
                  <label className="form-label" htmlFor="invoice-date">Invoice Date</label>
                  <input
                    type="date"
                    id="invoice-date"
                    className="form-input"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="customer-address">Billing/Shipping Address *</label>
                <textarea
                  id="customer-address"
                  className={`form-input ${formErrors.address ? "error" : ""}`}
                  placeholder="e.g. 182-E/22-F, S.N. HIGH ROAD, TIRUNELVELI-627007"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  rows="2"
                  style={{ resize: "none", fontFamily: "inherit" }}
                />
                {formErrors.address && <div className="form-error">{formErrors.address}</div>}
              </div>
            </div>

            <div className="dropdown-divider" style={{ margin: "1.5rem 0" }}></div>

            {/* Searchable Product Selection */}
            <div>
              <h4 style={{ fontSize: "0.938rem", fontWeight: 600, marginBottom: "0.875rem", color: "var(--text-main)" }}>
                Add Products to Invoice
              </h4>

              {/* Full-width Search Combobox */}
              <div className="form-group" style={{ position: "relative", marginBottom: "1.25rem" }} ref={comboboxRef}>
                <label className="form-label" htmlFor="billing-paint-search-input">
                  Select Paint Product (Search by Paint ID or Name)
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="billing-paint-search-input"
                    type="text"
                    className="form-input w-full"
                    placeholder="Type Paint ID (e.g. PNT001) or Name (e.g. WeatherShield)..."
                    value={paintSearchQuery}
                    onChange={(e) => {
                      setPaintSearchQuery(e.target.value);
                      setIsPaintDropdownOpen(true);
                      if (selectedPaintId) {
                        setSelectedPaintId("");
                      }
                    }}
                    onFocus={() => setIsPaintDropdownOpen(true)}
                    style={{ paddingRight: paintSearchQuery ? "2.5rem" : "2rem", paddingLeft: "2.5rem", fontSize: "0.938rem" }}
                    autoComplete="off"
                  />
                  <svg
                    width="18"
                    height="18"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{
                      position: "absolute",
                      left: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-muted)",
                      pointerEvents: "none"
                    }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {paintSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setPaintSearchQuery("");
                        setSelectedPaintId("");
                        setIsPaintDropdownOpen(true);
                      }}
                      style={{
                        position: "absolute",
                        right: "0.75rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        fontSize: "1rem",
                        lineHeight: 1,
                        padding: "0.25rem"
                      }}
                      title="Clear selection"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Wide & Detailed Dropdown Popover List */}
                {isPaintDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      width: "max(100%, 540px)",
                      marginTop: "0.375rem",
                      backgroundColor: "var(--bg-card)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--radius-lg)",
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.15)",
                      maxHeight: "340px",
                      overflowY: "auto",
                      zIndex: 1000
                    }}
                    id="billing-paint-dropdown-results"
                  >
                    <div
                      style={{
                        padding: "0.625rem 1rem",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "var(--text-muted)",
                        borderBottom: "1px solid var(--border-color)",
                        backgroundColor: "var(--bg-sidebar)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <span>Inventory Catalog ({filteredPaints.length} items found)</span>
                      <span>Click item to select</span>
                    </div>

                    {filteredPaints.length > 0 ? (
                      filteredPaints.map((paint) => {
                        const isSelected = selectedPaintId === paint.id;
                        const isOut = paint.quantity <= 0;
                        const isLow = paint.quantity > 0 && paint.quantity <= 15;

                        return (
                          <div
                            key={paint.id}
                            onClick={() => handleSelectPaint(paint)}
                            style={{
                              padding: "0.875rem 1rem",
                              cursor: "pointer",
                              borderBottom: "1px solid var(--border-color)",
                              backgroundColor: isSelected
                                ? "rgba(37, 99, 235, 0.08)"
                                : "transparent",
                              transition: "all 0.15s ease",
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.375rem"
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = "var(--bg-sidebar)";
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            {/* Row 1: ID, Name, Category & Price */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "nowrap" }}>
                                <span
                                  style={{
                                    fontFamily: "monospace",
                                    fontWeight: 700,
                                    fontSize: "0.813rem",
                                    padding: "0.15rem 0.5rem",
                                    borderRadius: "4px",
                                    backgroundColor: "rgba(37, 99, 235, 0.12)",
                                    color: "var(--primary)",
                                    border: "1px solid rgba(37, 99, 235, 0.2)",
                                    whiteSpace: "nowrap"
                                  }}
                                >
                                  {paint.id}
                                </span>
                                <span style={{ fontWeight: 600, fontSize: "0.938rem", color: "var(--text-main)" }}>
                                  {paint.name}
                                </span>
                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", backgroundColor: "var(--bg-sidebar)", padding: "0.1rem 0.4rem", borderRadius: "4px" }}>
                                  {paint.category}
                                </span>
                              </div>
                              <span style={{ fontWeight: 700, fontSize: "0.938rem", color: "var(--primary)", whiteSpace: "nowrap" }}>
                                {formatCurrency(paint.price)}
                              </span>
                            </div>

                            {/* Row 2: Specs & Available Stock Status */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.813rem" }}>
                              <span style={{ color: "var(--text-muted)" }}>
                                Brand: <strong style={{ color: "var(--text-main)" }}>{paint.brand}</strong> &bull; Finish: {paint.finish} &bull; Shade: {paint.color}
                              </span>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", whiteSpace: "nowrap" }}>
                                <span style={{ fontSize: "0.813rem", fontWeight: 600, color: isOut ? "var(--danger)" : "var(--text-main)" }}>
                                  {paint.quantity} L available
                                </span>
                                <span
                                  className={`badge ${
                                    isOut ? "badge-danger" : isLow ? "badge-warning" : "badge-success"
                                  }`}
                                  style={{ fontSize: "0.75rem", padding: "0.125rem 0.5rem" }}
                                >
                                  {isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock"}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div
                        style={{
                          padding: "1.75rem",
                          textAlign: "center",
                          fontSize: "0.875rem",
                          color: "var(--text-muted)"
                        }}
                      >
                        No paint products matched "<strong>{paintSearchQuery}</strong>"
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quantity and Action Buttons Row */}
              <div className="form-group row" style={{ alignItems: "flex-end", marginBottom: "1.25rem" }}>
                <div>
                  <label className="form-label" htmlFor="billing-item-qty">Order Quantity (liters)</label>
                  <input
                    type="number"
                    id="billing-item-qty"
                    className="form-input w-full"
                    placeholder="1"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(e.target.value)}
                    min="1"
                  />
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flex: 2 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleAddItem}
                    id="billing-add-item-btn"
                    style={{ flex: 2, height: "42px" }}
                  >
                    + Add Item to Cart
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      if (!selectedPaintId) {
                        showToast("Please select a paint product to remove.", "warning");
                        return;
                      }
                      handleRemoveItem(selectedPaintId);
                    }}
                    id="billing-remove-item-btn"
                    style={{ flex: 1, height: "42px" }}
                    disabled={!selectedPaintId || !invoiceItems.some((item) => item.paintId === selectedPaintId)}
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Selected Paint Detail Card */}
              {currentSelectedPaint && (
                <div
                  style={{
                    backgroundColor: "var(--bg-sidebar)",
                    border: "1px solid var(--border-color)",
                    padding: "0.875rem 1rem",
                    borderRadius: "var(--radius-md)",
                    fontSize: "0.875rem",
                    marginBottom: "1rem"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <div>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--primary)", marginRight: "0.5rem" }}>
                        {currentSelectedPaint.id}
                      </span>
                      <strong style={{ fontSize: "0.938rem" }}>{currentSelectedPaint.name}</strong>
                      <span style={{ color: "var(--text-muted)", fontSize: "0.813rem", marginLeft: "0.5rem" }}>
                        ({currentSelectedPaint.brand})
                      </span>
                    </div>
                    <span
                      className={`badge ${
                        currentSelectedPaint.quantity <= 0
                          ? "badge-danger"
                          : currentSelectedPaint.quantity <= 15
                          ? "badge-warning"
                          : "badge-success"
                      }`}
                    >
                      {currentSelectedPaint.quantity <= 0
                        ? "Out of Stock"
                        : currentSelectedPaint.quantity <= 15
                        ? "Low Stock"
                        : "In Stock"}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem", fontSize: "0.813rem" }}>
                    <div>
                      <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.7rem", textTransform: "uppercase" }}>UNIT PRICE</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(currentSelectedPaint.price)}</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.7rem", textTransform: "uppercase" }}>STOCK AVAIL</span>
                      <span style={{ fontWeight: 600, color: currentSelectedPaint.quantity <= 0 ? "var(--danger)" : "inherit" }}>
                        {currentSelectedPaint.quantity} Liters
                      </span>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.7rem", textTransform: "uppercase" }}>FINISH</span>
                      <span style={{ fontWeight: 600 }}>{currentSelectedPaint.finish}</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.7rem", textTransform: "uppercase" }}>COLOR / SHADE</span>
                      <span style={{ fontWeight: 600 }}>{currentSelectedPaint.color}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {formErrors.items && (
              <div className="form-error" style={{ marginTop: "1rem", fontSize: "0.875rem", textAlign: "center" }}>
                {formErrors.items}
              </div>
            )}

            <div className="dropdown-divider" style={{ margin: "1.5rem 0" }}></div>

            <button type="submit" className="btn btn-primary w-full" style={{ padding: "0.75rem" }} id="billing-generate-invoice-btn">
              Generate Sales Invoice
            </button>
          </form>
        </div>

        {/* OFFICIAL ENTERPRISE TAX INVOICE PREVIEW (Matches Kansai Nerolac Format) */}
        <div
          ref={printAreaRef}
          className="invoice-preview-card print-area"
          id="invoice-preview-panel"
          style={{
            fontFamily: "'Segoe UI', Arial, sans-serif",
            fontSize: "11px",
            color: "#000000",
            backgroundColor: "#ffffff",
            padding: "16px",
            border: "1px solid #000000",
            borderRadius: "0",
            boxShadow: "none"
          }}
        >
          {/* Top Brand Banner */}
          <div style={{ display: "flex", borderBottom: "1.5px solid #000000", paddingBottom: "8px", marginBottom: "8px" }}>
            <div style={{ flex: 1.5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "24px", height: "24px", backgroundColor: "#000", color: "#fff", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>
                  K
                </div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: "14px", letterSpacing: "0.5px" }}>KANSAI NEROLAC</div>
                  <div style={{ fontWeight: 900, fontSize: "16px", letterSpacing: "1px", lineHeight: "1" }}>PAINTS LIMITED</div>
                </div>
              </div>
              <div style={{ fontSize: "9px", marginTop: "6px", color: "#333" }}>
                <strong>Registered Office:</strong> 28th Floor, A-Wing, Marathon Futurex, N. M. Joshi Marg, Lower Parel, Mumbai - 400013<br />
                Tel: 022 4060 2500 &bull; Website: www.nerolac.com &bull; Toll Free: 1800 209 2092
              </div>
            </div>
            <div style={{ flex: 1, textAlign: "right", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <span style={{ border: "1.5px solid #000", padding: "2px 8px", fontWeight: "bold", fontSize: "12px", textTransform: "uppercase" }}>
                  TAX INVOICE
                </span>
                <div style={{ fontSize: "9px", fontWeight: "bold", marginTop: "4px" }}>ORIGINAL FOR RECIPIENT</div>
              </div>
              <div style={{ fontSize: "9px" }}>
                <strong>CIN:</strong> L24202MH1920PLC000825
              </div>
            </div>
          </div>

          {/* 3-Box Upper Grid: Supplying Location, Bill To Party & IRN / QR */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1fr", border: "1px solid #000", marginBottom: "8px" }}>
            {/* Box 1: Supplying Location */}
            <div style={{ padding: "6px", borderRight: "1px solid #000" }}>
              <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "10px", borderBottom: "1px solid #ddd", paddingBottom: "2px", marginBottom: "4px" }}>
                Supplying Location Address :
              </div>
              <div style={{ fontWeight: "bold" }}>KANSAI NEROLAC PAINTS LTD (D989)</div>
              <div>TAMILNADU WAREHOUSING CORP GODOWN NO 5, NO 6</div>
              <div>STC COLLEGE ROAD, TIRUNELVELI-627007</div>
              <div>Tamil Nadu</div>
              <div>Tel - 9962201663 / 7824872311</div>
              <div style={{ fontWeight: "bold", marginTop: "2px" }}>GSTIN- 33AAACG1376N1ZJ</div>
            </div>

            {/* Box 2: Bill To Party */}
            <div style={{ padding: "6px", borderRight: "1px solid #000" }}>
              <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "10px", borderBottom: "1px solid #ddd", paddingBottom: "2px", marginBottom: "4px" }}>
                Bill To Party : <span style={{ fontWeight: "normal" }}>113715</span>
              </div>
              <div style={{ fontWeight: "bold", fontSize: "12px" }}>{customerName || "KRISHNA PAINTS"}</div>
              <div>{customerAddress || "182-E/22-F, S.N. HIGH ROAD, TIRUNELVELI-627007"}</div>
              <div>Place Of Supply: Tamil Nadu-33</div>
              <div style={{ fontWeight: "bold", color: "#000", marginTop: "2px" }}>
                GSTIN- {customerGst ? customerGst.toUpperCase() : "33AHRPK6118P1ZR"}
              </div>
              <div>Tel - {customerPhone || "9366701553"}</div>
            </div>

            {/* Box 3: IRN Number & QR Code */}
            <div style={{ padding: "6px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ fontSize: "8.5px", wordBreak: "break-all" }}>
                <strong>IRN Number:</strong><br />
                6bfe80a8545c427cb60cb8525dd6ec0c5c65c68d3e0fcb52987bc2170d4d6fee<br />
                <strong>Ack No.:</strong> 152626535708505<br />
                <strong>Ack Date:</strong> {invoiceDate} 17:23:00
              </div>
              {/* Simulated QR Code */}
              <div style={{ textAlign: "center", marginTop: "4px" }}>
                <svg width="64" height="64" viewBox="0 0 100 100" fill="none" style={{ margin: "0 auto", display: "block" }}>
                  <rect width="100" height="100" fill="white" stroke="#000" strokeWidth="2" />
                  <rect x="10" y="10" width="25" height="25" fill="black" />
                  <rect x="15" y="15" width="15" height="15" fill="white" />
                  <rect x="18" y="18" width="9" height="9" fill="black" />
                  <rect x="65" y="10" width="25" height="25" fill="black" />
                  <rect x="70" y="15" width="15" height="15" fill="white" />
                  <rect x="73" y="18" width="9" height="9" fill="black" />
                  <rect x="10" y="65" width="25" height="25" fill="black" />
                  <rect x="15" y="70" width="15" height="15" fill="white" />
                  <rect x="18" y="73" width="9" height="9" fill="black" />
                  <rect x="40" y="40" width="20" height="20" fill="black" />
                  <rect x="45" y="10" width="10" height="20" fill="black" />
                  <rect x="70" y="45" width="20" height="10" fill="black" />
                  <rect x="45" y="70" width="15" height="20" fill="black" />
                  <rect x="70" y="70" width="18" height="18" fill="black" />
                </svg>
              </div>
            </div>
          </div>

          {/* 3-Column Metadata Row: Invoice, Order & Delivery */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", border: "1px solid #000", marginBottom: "8px", padding: "4px 6px", fontSize: "9.5px", backgroundColor: "#fafafa" }}>
            <div>
              <strong>Invoice Details :</strong><br />
              Invoice No: <strong>{invoiceNumber}</strong><br />
              Invoice Date/Time: {invoiceDate} 17:23:02<br />
              E-way Bill No: 502042422106
            </div>
            <div style={{ borderLeft: "1px solid #ccc", borderRight: "1px solid #ccc", paddingLeft: "6px", paddingRight: "6px" }}>
              <strong>Order Details :</strong><br />
              Order No: 223035242<br />
              Order Date/Time: {invoiceDate} 17:21:09<br />
              PO/Scheme No: RAJAN.S
            </div>
            <div style={{ paddingLeft: "6px" }}>
              <strong>Delivery & Vehicle Details :</strong><br />
              Delivery No: 143957860 &bull; LR No: LOCAL<br />
              Vehicle No: <strong>TN72BF9777</strong><br />
              Dispatched Date: {invoiceDate} 17:25:00
            </div>
          </div>

          {/* Main Line Items Tax Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", marginBottom: "8px", fontSize: "9px" }}>
            <thead>
              <tr style={{ backgroundColor: "#e2e8f0", textAlign: "center", fontWeight: "bold" }}>
                <th style={{ border: "1px solid #000", padding: "4px" }}>Material Code</th>
                <th style={{ border: "1px solid #000", padding: "4px", textAlign: "left" }}>Product Description</th>
                <th style={{ border: "1px solid #000", padding: "4px" }}>HSN Code</th>
                <th style={{ border: "1px solid #000", padding: "4px" }}>No of Packs</th>
                <th style={{ border: "1px solid #000", padding: "4px" }}>Qty Ltr/Kgs</th>
                <th style={{ border: "1px solid #000", padding: "4px" }}>Rate/Ltr</th>
                <th style={{ border: "1px solid #000", padding: "4px" }}>Value</th>
                <th style={{ border: "1px solid #000", padding: "4px" }}>Discount (5%)</th>
                <th style={{ border: "1px solid #000", padding: "4px" }}>Taxable Amount</th>
                <th style={{ border: "1px solid #000", padding: "4px" }}>Tax Amount (CGST+SGST)</th>
                <th style={{ border: "1px solid #000", padding: "4px" }}>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoiceItems.length > 0 ? (
                invoiceItems.map((item, idx) => {
                  const itemValue = item.price * item.quantity;
                  const itemDiscount = itemValue * 0.05;
                  const itemTaxable = itemValue - itemDiscount;
                  const itemTax = itemTaxable * 0.18;
                  const itemTotal = itemTaxable + itemTax;

                  return (
                    <tr key={item.paintId || idx} style={{ textAlign: "center" }}>
                      <td style={{ border: "1px solid #000", padding: "4px", fontWeight: "bold" }}>{item.paintId}</td>
                      <td style={{ border: "1px solid #000", padding: "4px", textAlign: "left" }}>
                        <strong>{item.paintName.toUpperCase()}</strong><br />
                        <span style={{ fontSize: "8px", color: "#444" }}>GST: CGST 9% + SGST 9% | Brand: {item.brand}</span>
                      </td>
                      <td style={{ border: "1px solid #000", padding: "4px" }}>3214.10.00</td>
                      <td style={{ border: "1px solid #000", padding: "4px" }}>{item.quantity}</td>
                      <td style={{ border: "1px solid #000", padding: "4px" }}>{item.quantity}.00</td>
                      <td style={{ border: "1px solid #000", padding: "4px" }}>{item.price.toFixed(2)}</td>
                      <td style={{ border: "1px solid #000", padding: "4px" }}>{itemValue.toFixed(2)}</td>
                      <td style={{ border: "1px solid #000", padding: "4px" }}>{itemDiscount.toFixed(2)}-</td>
                      <td style={{ border: "1px solid #000", padding: "4px", fontWeight: "bold" }}>{itemTaxable.toFixed(2)}</td>
                      <td style={{ border: "1px solid #000", padding: "4px" }}>{(itemTax / 2).toFixed(2)} x 2</td>
                      <td style={{ border: "1px solid #000", padding: "4px", fontWeight: "bold" }}>{formatCurrency(itemTotal)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="11" style={{ border: "1px solid #000", padding: "16px", textAlign: "center", color: "#666" }}>
                    No products added. Add products using the form on the left.
                  </td>
                </tr>
              )}
              {/* Total Row */}
              <tr style={{ fontWeight: "bold", backgroundColor: "#f1f5f9" }}>
                <td colSpan="3" style={{ border: "1px solid #000", padding: "4px", textAlign: "left" }}>Total</td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>{totalPacks}</td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>{totalPacks}.00</td>
                <td style={{ border: "1px solid #000", padding: "4px" }}>-</td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>{subtotal.toFixed(2)}</td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>{cashDiscount.toFixed(2)}-</td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>{assessableValue.toFixed(2)}</td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>{(cgst + sgst).toFixed(2)}</td>
                <td style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>{formatCurrency(grandTotal)}</td>
              </tr>
            </tbody>
          </table>

          {/* Package Summary & Commercial Value Breakdown Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", border: "1px solid #000", marginBottom: "8px" }}>
            {/* Left: Package Summary */}
            <div style={{ padding: "6px", borderRight: "1px solid #000" }}>
              <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "9.5px", marginBottom: "4px" }}>Package Summary</div>
              <div style={{ fontSize: "9px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px" }}>
                <div>Total Gross Weight: <strong>{(totalPacks * 1.2).toFixed(1)} KG</strong></div>
                <div>Total Qty (Ltr/KG): <strong>{totalPacks}.00</strong></div>
                <div>Total Packages: <strong>{invoiceItems.length}</strong></div>
              </div>
              <div style={{ borderTop: "1px solid #ccc", marginTop: "6px", paddingTop: "4px", fontSize: "9.5px" }}>
                <strong>Total Invoice value ( In Words ) :</strong><br />
                <span style={{ fontWeight: "bold", textTransform: "uppercase", color: "#000" }}>
                  {numberToWords(grandTotal)}
                </span>
              </div>
            </div>

            {/* Right: Commercial Value Breakdown */}
            <div style={{ padding: "4px 6px", fontSize: "9.5px" }}>
              <div style={{ fontWeight: "bold", textTransform: "uppercase", textAlign: "center", borderBottom: "1px solid #ddd", paddingBottom: "2px" }}>
                Summary Commercial Value
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
                <span>Value Of Sale</span>
                <span>{subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
                <span>Cash Discount 5 %</span>
                <span>{cashDiscount.toFixed(2)}-</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0", fontWeight: "bold" }}>
                <span>Assessable Value</span>
                <span>{assessableValue.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
                <span>Central GST (CGST 9%)</span>
                <span>{cgst.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
                <span>State GST (SGST 9%)</span>
                <span>{sgst.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderTop: "1.5px solid #000", fontWeight: "bold", fontSize: "11px" }}>
                <span>Total Invoice Value</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* HSN Tax Code Summary Grid */}
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", marginBottom: "8px", fontSize: "8.5px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f1f5f9", textAlign: "center", fontWeight: "bold" }}>
                <th style={{ border: "1px solid #000", padding: "2px" }}>HSN Code</th>
                <th style={{ border: "1px solid #000", padding: "2px" }}>Qty L/K</th>
                <th style={{ border: "1px solid #000", padding: "2px" }}>Gross Amount</th>
                <th style={{ border: "1px solid #000", padding: "2px" }}>Discount</th>
                <th style={{ border: "1px solid #000", padding: "2px" }}>Taxable Amount</th>
                <th style={{ border: "1px solid #000", padding: "2px" }}>SGST (9%)</th>
                <th style={{ border: "1px solid #000", padding: "2px" }}>CGST (9%)</th>
                <th style={{ border: "1px solid #000", padding: "2px" }}>IGST</th>
                <th style={{ border: "1px solid #000", padding: "2px" }}>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ textAlign: "center" }}>
                <td style={{ border: "1px solid #000", padding: "2px" }}>3214.10.00</td>
                <td style={{ border: "1px solid #000", padding: "2px" }}>{totalPacks}.0</td>
                <td style={{ border: "1px solid #000", padding: "2px" }}>{subtotal.toFixed(2)}</td>
                <td style={{ border: "1px solid #000", padding: "2px" }}>{cashDiscount.toFixed(2)}-</td>
                <td style={{ border: "1px solid #000", padding: "2px", fontWeight: "bold" }}>{assessableValue.toFixed(2)}</td>
                <td style={{ border: "1px solid #000", padding: "2px" }}>{sgst.toFixed(2)}</td>
                <td style={{ border: "1px solid #000", padding: "2px" }}>{cgst.toFixed(2)}</td>
                <td style={{ border: "1px solid #000", padding: "2px" }}>0.00</td>
                <td style={{ border: "1px solid #000", padding: "2px", fontWeight: "bold" }}>{formatCurrency(grandTotal)}</td>
              </tr>
            </tbody>
          </table>

          {/* Legal Terms Declaration & Signature Section */}
          <div style={{ border: "1px solid #000", fontSize: "8.5px" }}>
            <div style={{ padding: "4px", borderBottom: "1px solid #000", backgroundColor: "#f8fafc", textAlign: "center", fontWeight: "bold" }}>
              The products mentioned in the invoice are eligible for discount/scheme on satisfaction of terms and conditions mentioned in scheme circulars.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr" }}>
              <div style={{ padding: "4px", borderRight: "1px solid #000" }}>
                <strong>Declaration :</strong><br />
                1. Prices are as per our Terms & Conditions and/or dealers Price List.<br />
                2. No Receipt Valid except on our Official Form.<br />
                3. In case of any Complaint, please cite Batch No & Date of Mfg.<br />
                4. Any Dispute arising under this invoice shall be subject to Mumbai jurisdiction.
              </div>
              <div style={{ padding: "4px", borderRight: "1px solid #000" }}>
                <strong>Customer Acknowledgement :</strong><br />
                Receipt Date: _________________<br />
                Receipt Time: _________________<br />
                <strong>Customer Sign & Stamp:</strong>
              </div>
              <div style={{ padding: "4px", textAlign: "right", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div><strong>For PaintCorp Limited</strong></div>
                <div style={{ marginTop: "24px", fontWeight: "bold" }}>Authorised Signatory</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
