import React, { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ACTIONS } from "../reducers/inventoryReducer";
import { useToast } from "../context/ToastContext";
import { formatCurrency } from "../utils/currencyFormatter";
import { api } from "../services/api";
import { refreshInventoryData } from "../utils/syncInventory";

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
  const navigate = useNavigate();
  const { paints = [] } = state || {};
  const { showToast } = useToast();

  const initialDraft = useMemo(() => getInitialDraft(), []);

  // -------------------------------------------------------------
  // 1. Company Brand & Header States (Optional)
  // -------------------------------------------------------------
  const [companyName, setCompanyName] = useState(initialDraft?.companyName || "PaintCorp");
  const [companySubtitle, setCompanySubtitle] = useState(initialDraft?.companySubtitle || "PVT LTD");
  const [companyLogoLetter, setCompanyLogoLetter] = useState(initialDraft?.companyLogoLetter || "P");
  const [companyRegOffice, setCompanyRegOffice] = useState(
    initialDraft?.companyRegOffice ||
      "28th Floor, A-Wing, Marathon Futurex, N. M. Joshi Marg, Lower Parel, Mumbai - 400013"
  );
  const [companyTel, setCompanyTel] = useState(initialDraft?.companyTel || "022 4060 2500");
  const [companyWebsite, setCompanyWebsite] = useState(initialDraft?.companyWebsite || "www.PaintCorp.com");
  const [companyTollFree, setCompanyTollFree] = useState(initialDraft?.companyTollFree || "1800 209 2092");
  const [companyCin, setCompanyCin] = useState(initialDraft?.companyCin || "L24202MH1920PLC000825");
  const [invoiceTitle, setInvoiceTitle] = useState(initialDraft?.invoiceTitle || "TAX INVOICE");
  const [invoiceSubtitle, setInvoiceSubtitle] = useState(initialDraft?.invoiceSubtitle || "ORIGINAL FOR RECIPIENT");

  // -------------------------------------------------------------
  // 2. Supplying Location (Dispatch From) States (Optional)
  // -------------------------------------------------------------
  const [supplyingName, setSupplyingName] = useState(initialDraft?.supplyingName || "PaintCorp LTD (D989)");
  const [supplyingWarehouse, setSupplyingWarehouse] = useState(
    initialDraft?.supplyingWarehouse || "TAMILNADU WAREHOUSING CORP GODOWN NO 5, NO 6"
  );
  const [supplyingAddress, setSupplyingAddress] = useState(
    initialDraft?.supplyingAddress || "STC COLLEGE ROAD, TIRUNELVELI-627007"
  );
  const [supplyingState, setSupplyingState] = useState(initialDraft?.supplyingState || "Tamil Nadu");
  const [supplyingPhone, setSupplyingPhone] = useState(initialDraft?.supplyingPhone || "1234567890 / 2589631478");
  const [supplyingGstin, setSupplyingGstin] = useState(initialDraft?.supplyingGstin || "33ABCDE1234F1Z5");

  // -------------------------------------------------------------
  // 3. Bill To Party (Customer Profile) States
  // -------------------------------------------------------------
  const [partyCode, setPartyCode] = useState(initialDraft?.partyCode || "113715");
  const [customerName, setCustomerName] = useState(initialDraft?.customerName || "");
  const [customerPhone, setCustomerPhone] = useState(initialDraft?.customerPhone || "");
  const [customerGst, setCustomerGst] = useState(initialDraft?.customerGst || "");
  const [customerAddress, setCustomerAddress] = useState(initialDraft?.customerAddress || "");
  const [placeOfSupply, setPlaceOfSupply] = useState(initialDraft?.placeOfSupply || "Tamil Nadu-33");

  // -------------------------------------------------------------
  // 4. e-Invoice & IRN / QR States (Optional)
  // -------------------------------------------------------------
  const [irnNumber, setIrnNumber] = useState(
    initialDraft?.irnNumber || "6bfe80a8545c427cb60cb8525dd6ec0c5c65c68d3e0fcb52987bc2170d4d6fee"
  );
  const [ackNo, setAckNo] = useState(initialDraft?.ackNo || "152626535708505");
  const [ackTime, setAckTime] = useState(initialDraft?.ackTime || "17:23:00");

  // -------------------------------------------------------------
  // 5. Invoice, Order & Transport Details States (Optional)
  // -------------------------------------------------------------
  const [invoiceNumber, setInvoiceNumber] = useState(initialDraft?.invoiceNumber || "");
  const [invoiceDate, setInvoiceDate] = useState(
    initialDraft?.invoiceDate || new Date().toISOString().split("T")[0]
  );
  const [invoiceTime, setInvoiceTime] = useState(initialDraft?.invoiceTime || "17:23:02");
  const [ewayBillNo, setEwayBillNo] = useState(initialDraft?.ewayBillNo || "502042422106");

  const [orderNumber, setOrderNumber] = useState(initialDraft?.orderNumber || "223035242");
  const [orderDate, setOrderDate] = useState(initialDraft?.orderDate || "");
  const [orderTime, setOrderTime] = useState(initialDraft?.orderTime || "17:21:09");
  const [poSchemeNo, setPoSchemeNo] = useState(initialDraft?.poSchemeNo || "RAJAN.S");

  const [deliveryNo, setDeliveryNo] = useState(initialDraft?.deliveryNo || "143957860");
  const [lrNo, setLrNo] = useState(initialDraft?.lrNo || "LOCAL");
  const [vehicleNo, setVehicleNo] = useState(initialDraft?.vehicleNo || "TN72BF9777");
  const [dispatchedDate, setDispatchedDate] = useState(initialDraft?.dispatchedDate || "");
  const [dispatchedTime, setDispatchedTime] = useState(initialDraft?.dispatchedTime || "17:25:00");

  // -------------------------------------------------------------
  // 6. Tax Rates, HSN & Pricing Defaults (Optional)
  // -------------------------------------------------------------
  const [defaultHsn, setDefaultHsn] = useState(initialDraft?.defaultHsn || "3214.10.00");
  const [discountPercent, setDiscountPercent] = useState(
    initialDraft?.discountPercent !== undefined ? initialDraft.discountPercent : 5
  );
  const [cgstRate, setCgstRate] = useState(
    initialDraft?.cgstRate !== undefined ? initialDraft.cgstRate : 9
  );
  const [sgstRate, setSgstRate] = useState(
    initialDraft?.sgstRate !== undefined ? initialDraft.sgstRate : 9
  );

  // -------------------------------------------------------------
  // 7. Terms, Declarations & Signatures (Optional)
  // -------------------------------------------------------------
  const [schemeTerms, setSchemeTerms] = useState(
    initialDraft?.schemeTerms ||
      "The products mentioned in the invoice are eligible for discount/scheme on satisfaction of terms and conditions mentioned in scheme circulars."
  );
  const [declarationText, setDeclarationText] = useState(
    initialDraft?.declarationText ||
      "1. Prices are as per our Terms & Conditions and/or dealers Price List.\n2. No Receipt Valid except on our Official Form.\n3. In case of any Complaint, please cite Batch No & Date of Mfg.\n4. Any Dispute arising under this invoice shall be subject to Mumbai jurisdiction."
  );
  const [customerReceiptDate, setCustomerReceiptDate] = useState(
    initialDraft?.customerReceiptDate || "_________________"
  );
  const [customerReceiptTime, setCustomerReceiptTime] = useState(
    initialDraft?.customerReceiptTime || "_________________"
  );
  const [signatoryCompany, setSignatoryCompany] = useState(
    initialDraft?.signatoryCompany || "For PaintCorp Limited"
  );
  const [signatoryDesignation, setSignatoryDesignation] = useState(
    initialDraft?.signatoryDesignation || "Authorised Signatory"
  );

  // -------------------------------------------------------------
  // Seed dynamic invoice number if not already present
  // -------------------------------------------------------------
  useEffect(() => {
    if (!invoiceNumber) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      setInvoiceNumber(`INV-20260808-${randomSuffix}`);
    }
  }, [invoiceNumber]);

  // -------------------------------------------------------------
  // Item Selection & Cart States
  // -------------------------------------------------------------
  const [selectedPaintId, setSelectedPaintId] = useState(initialDraft?.selectedPaintId || "");
  const [paintSearchQuery, setPaintSearchQuery] = useState("");
  const [isPaintDropdownOpen, setIsPaintDropdownOpen] = useState(false);
  const comboboxRef = useRef(null);

  const [itemQuantity, setItemQuantity] = useState(initialDraft?.itemQuantity || "1");
  const [invoiceItems, setInvoiceItems] = useState(initialDraft?.invoiceItems || []);
  const [lastSaved, setLastSaved] = useState(initialDraft?.lastSaved || null);
  const [formErrors, setFormErrors] = useState({});
  const printAreaRef = useRef(null);

  // -------------------------------------------------------------
  // Section Accordion Visibility Controls
  // -------------------------------------------------------------
  const [expandedSections, setExpandedSections] = useState({
    header: false,
    supplying: false,
    customer: true, // open by default for convenient billing
    irn: false,
    logistics: false,
    products: true, // open by default for product selection
    terms: false
  });

  const toggleSection = (key) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isAllExpanded = useMemo(() => {
    return Object.values(expandedSections).every(Boolean);
  }, [expandedSections]);

  const handleToggleAllSections = () => {
    const nextState = !isAllExpanded;
    setExpandedSections({
      header: nextState,
      supplying: nextState,
      customer: true,
      irn: nextState,
      logistics: nextState,
      products: true,
      terms: nextState
    });
  };

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

  // Autosave effect: Persist all state values whenever any field or cart item changes
  useEffect(() => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const draftData = {
      companyName,
      companySubtitle,
      companyLogoLetter,
      companyRegOffice,
      companyTel,
      companyWebsite,
      companyTollFree,
      companyCin,
      invoiceTitle,
      invoiceSubtitle,

      supplyingName,
      supplyingWarehouse,
      supplyingAddress,
      supplyingState,
      supplyingPhone,
      supplyingGstin,

      partyCode,
      customerName,
      customerPhone,
      customerGst,
      customerAddress,
      placeOfSupply,

      irnNumber,
      ackNo,
      ackTime,

      invoiceNumber,
      invoiceDate,
      invoiceTime,
      ewayBillNo,
      orderNumber,
      orderDate,
      orderTime,
      poSchemeNo,
      deliveryNo,
      lrNo,
      vehicleNo,
      dispatchedDate,
      dispatchedTime,

      defaultHsn,
      discountPercent,
      cgstRate,
      sgstRate,

      schemeTerms,
      declarationText,
      customerReceiptDate,
      customerReceiptTime,
      signatoryCompany,
      signatoryDesignation,

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
  }, [
    companyName,
    companySubtitle,
    companyLogoLetter,
    companyRegOffice,
    companyTel,
    companyWebsite,
    companyTollFree,
    companyCin,
    invoiceTitle,
    invoiceSubtitle,
    supplyingName,
    supplyingWarehouse,
    supplyingAddress,
    supplyingState,
    supplyingPhone,
    supplyingGstin,
    partyCode,
    customerName,
    customerPhone,
    customerGst,
    customerAddress,
    placeOfSupply,
    irnNumber,
    ackNo,
    ackTime,
    invoiceNumber,
    invoiceDate,
    invoiceTime,
    ewayBillNo,
    orderNumber,
    orderDate,
    orderTime,
    poSchemeNo,
    deliveryNo,
    lrNo,
    vehicleNo,
    dispatchedDate,
    dispatchedTime,
    defaultHsn,
    discountPercent,
    cgstRate,
    sgstRate,
    schemeTerms,
    declarationText,
    customerReceiptDate,
    customerReceiptTime,
    signatoryCompany,
    signatoryDesignation,
    selectedPaintId,
    itemQuantity,
    invoiceItems
  ]);

  // Computed Totals & Discretionary Discounts matching Enterprise Tax Invoice math
  const discountRateNum = Number(discountPercent) >= 0 ? Number(discountPercent) / 100 : 0.05;
  const cgstRateNum = Number(cgstRate) >= 0 ? Number(cgstRate) / 100 : 0.09;
  const sgstRateNum = Number(sgstRate) >= 0 ? Number(sgstRate) / 100 : 0.09;

  const subtotal = useMemo(() => {
    return invoiceItems.reduce((acc, item) => acc + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
  }, [invoiceItems]);

  const cashDiscount = useMemo(() => subtotal * discountRateNum, [subtotal, discountRateNum]);
  const assessableValue = useMemo(() => Math.max(0, subtotal - cashDiscount), [subtotal, cashDiscount]);
  const cgst = useMemo(() => assessableValue * cgstRateNum, [assessableValue, cgstRateNum]);
  const sgst = useMemo(() => assessableValue * sgstRateNum, [assessableValue, sgstRateNum]);
  const grandTotal = useMemo(() => assessableValue + cgst + sgst, [assessableValue, cgst, sgst]);

  const totalPacks = useMemo(() => {
    return invoiceItems.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
  }, [invoiceItems]);

  // Selected Paint details memoized
  const currentSelectedPaint = useMemo(() => {
    if (selectedPaintId) {
      return paints.find((p) => p.id === selectedPaintId) || null;
    }
    if (paintSearchQuery.trim()) {
      const q = paintSearchQuery.trim().toLowerCase();
      return (
        paints.find(
          (p) =>
            p.id.toLowerCase() === q ||
            p.name.toLowerCase() === q ||
            `${p.id} - ${p.name}`.toLowerCase() === q
        ) || null
      );
    }
    return null;
  }, [paints, selectedPaintId, paintSearchQuery]);

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

    const existingIndex = invoiceItems.findIndex(
      (item) => item.paintId === currentSelectedPaint.id
    );

    if (existingIndex !== -1) {
      const updated = [...invoiceItems];
      const newQty = (Number(updated[existingIndex].quantity) || 0) + qty;

      if (newQty > currentSelectedPaint.quantity) {
        showToast(
          `Cannot exceed available inventory count of ${currentSelectedPaint.quantity}.`,
          "danger"
        );
        return;
      }

      updated[existingIndex].quantity = newQty;
      updated[existingIndex].price = Number(currentSelectedPaint.price) || 0;
      setInvoiceItems(updated);
    } else {
      setInvoiceItems((prev) => [
        ...prev,
        {
          paintId: currentSelectedPaint.id,
          paintName: currentSelectedPaint.name || "Paint Item",
          brand: currentSelectedPaint.brand || "",
          price: Number(currentSelectedPaint.price) || 0,
          quantity: qty,
          hsn: defaultHsn || "3214.10.00"
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

  // Reset all optional template fields back to enterprise standard defaults
  const handleResetToDefaults = () => {
    setCompanyName("PaintCorp");
    setCompanySubtitle("PVT LTD");
    setCompanyLogoLetter("P");
    setCompanyRegOffice(
      "28th Floor, A-Wing, Marathon Futurex, N. M. Joshi Marg, Lower Parel, Mumbai - 400013"
    );
    setCompanyTel("022 4060 2500");
    setCompanyWebsite("www.PaintCorp.com");
    setCompanyTollFree("1800 209 2092");
    setCompanyCin("L24202MH1920PLC000825");
    setInvoiceTitle("TAX INVOICE");
    setInvoiceSubtitle("ORIGINAL FOR RECIPIENT");

    setSupplyingName("PaintCorp LTD (D989)");
    setSupplyingWarehouse("TAMILNADU WAREHOUSING CORP GODOWN NO 5, NO 6");
    setSupplyingAddress("STC COLLEGE ROAD, TIRUNELVELI-627007");
    setSupplyingState("Tamil Nadu");
    setSupplyingPhone("1234567890 / 2589631478");
    setSupplyingGstin("33ABCDE1234F1Z5");

    setPartyCode("113715");
    setPlaceOfSupply("Tamil Nadu-33");

    setIrnNumber("6bfe80a8545c427cb60cb8525dd6ec0c5c65c68d3e0fcb52987bc2170d4d6fee");
    setAckNo("152626535708505");
    setAckTime("17:23:00");

    setInvoiceTime("17:23:02");
    setEwayBillNo("502042422106");
    setOrderNumber("223035242");
    setOrderDate("");
    setOrderTime("17:21:09");
    setPoSchemeNo("RAJAN.S");
    setDeliveryNo("143957860");
    setLrNo("LOCAL");
    setVehicleNo("TN72BF9777");
    setDispatchedDate("");
    setDispatchedTime("17:25:00");

    setDefaultHsn("3214.10.00");
    setDiscountPercent(5);
    setCgstRate(9);
    setSgstRate(9);

    setSchemeTerms(
      "The products mentioned in the invoice are eligible for discount/scheme on satisfaction of terms and conditions mentioned in scheme circulars."
    );
    setDeclarationText(
      "1. Prices are as per our Terms & Conditions and/or dealers Price List.\n2. No Receipt Valid except on our Official Form.\n3. In case of any Complaint, please cite Batch No & Date of Mfg.\n4. Any Dispute arising under this invoice shall be subject to Mumbai jurisdiction."
    );
    setCustomerReceiptDate("_________________");
    setCustomerReceiptTime("_________________");
    setSignatoryCompany("For PaintCorp Limited");
    setSignatoryDesignation("Authorised Signatory");

    showToast("Bill template options reset to standard defaults.", "info");
  };

  // Form Validation for Billing Checkout (All bill fields are optional; only items are required)
  const validateBillingForm = () => {
    const errors = {};
    if (invoiceItems.length === 0) {
      errors.items = "Add at least 1 paint product to generate invoice.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Generate & Save Order Invoice
  const handleGenerateInvoice = async (e) => {
    e.preventDefault();
    if (!validateBillingForm()) {
      showToast("Cannot generate empty invoice. Please add products first.", "danger");
      return;
    }

    const effectiveCustomerName = customerName.trim() || "KRISHNA PAINTS";
    const effectiveCustomerPhone = customerPhone.trim() || "+91 9366701553";
    const effectiveCustomerAddress =
      customerAddress.trim() || "182-E/22-F, S.N. HIGH ROAD, TIRUNELVELI-627007";
    const effectiveGst = customerGst.trim() ? customerGst.toUpperCase() : "33AHRPK6118P1ZR";

    const orderId = `ORD${Math.floor(200 + Math.random() * 800)}`;

    const items = invoiceItems.map((item) => ({
      paintId: item.paintId,
      paintName: item.paintName,
      quantity: Number(item.quantity),
      price: Number(item.price),
      amount: Number(item.quantity) * Number(item.price),
      hsn: item.hsn || defaultHsn || "3214.10.00"
    }));

    const totalAmount = grandTotal;
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const allPaintNames = items.map((item) => item.paintName).join(", ");
    const primaryPaintId = items[0]?.paintId || "PNT001";

    const orderPayload = {
      id: orderId,
      customerName: effectiveCustomerName,
      customerPhone: effectiveCustomerPhone,
      customerGst: effectiveGst,
      customerAddress: effectiveCustomerAddress,
      partyCode: partyCode || "113715",
      placeOfSupply: placeOfSupply || "Tamil Nadu-33",

      invoiceNumber,
      invoiceDate,
      invoiceTime: invoiceTime || "17:23:02",
      ewayBillNo: ewayBillNo || "502042422106",

      orderNumber: orderNumber || "223035242",
      orderDate: orderDate || invoiceDate,
      orderTime: orderTime || "17:21:09",
      poSchemeNo: poSchemeNo || "RAJAN.S",

      deliveryNo: deliveryNo || "143957860",
      lrNo: lrNo || "LOCAL",
      vehicleNo: vehicleNo || "TN72BF9777",
      dispatchedDate: dispatchedDate || invoiceDate,
      dispatchedTime: dispatchedTime || "17:25:00",

      supplierName: supplyingName || "PaintCorp LTD (D989)",
      supplierGstin: supplyingGstin || "33ABCDE1234F1Z5",
      irnNumber: irnNumber || "6bfe80a8545c427cb60cb8525dd6ec0c5c65c68d3e0fcb52987bc2170d4d6fee",

      items,
      paintId: primaryPaintId,
      paintName: allPaintNames,
      quantity: items.length > 1 ? 1 : totalQuantity,
      totalQuantity,
      price: totalAmount,
      totalAmount,
      subtotal,
      cashDiscount,
      assessableValue,
      cgst,
      sgst,
      date: invoiceDate,
      status: "Pending"
    };

    try {
      const res = await api.post("/api/orders", orderPayload);
      const createdOrder = res && res.id ? { ...orderPayload, ...res } : orderPayload;

      dispatch({
        type: ACTIONS.ADD_ORDER,
        payload: createdOrder
      });

      await refreshInventoryData(dispatch);
      showToast(`Invoice ${invoiceNumber} generated! Order ${createdOrder.id} recorded in Dispatch Orders.`, "success");

      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setLastSaved(null);

      setTimeout(() => {
        handlePrintInvoice();
      }, 500);
    } catch (err) {
      console.error("API post order error:", err);
      dispatch({
        type: ACTIONS.ADD_ORDER,
        payload: orderPayload
      });
      showToast(`Invoice generated & saved to local dispatch orders.`, "warning");
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setLastSaved(null);

      setTimeout(() => {
        handlePrintInvoice();
      }, 500);
    }
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
    showToast("Billing form reset for new invoice.", "info");
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
          <p>Generate official GST Tax Invoices — all bill fields are editable & optional with enterprise defaults</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => navigate("/orders")} id="billing-view-orders-btn">
            View Dispatch Orders
          </button>
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
        {/* Left Side: Fully Editable Bill Options Form */}
        <div className="card" id="billing-form-card" style={{ padding: "1.25rem" }}>
          {/* Quick Header Controls for Expanding All Sections or Resetting Defaults */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--text-main)" }}>
                Edit Bill Information
              </h3>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                All fields are editable in the bill format. Additional details are optional.
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem", height: "auto" }}
                onClick={handleToggleAllSections}
                id="billing-expand-all-btn"
              >
                {isAllExpanded ? "Collapse Optional" : "Expand All Fields"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem", height: "auto" }}
                onClick={handleResetToDefaults}
                title="Reset optional bill fields to standard enterprise defaults"
                id="billing-reset-defaults-btn"
              >
                Reset Defaults
              </button>
            </div>
          </div>

          <form onSubmit={handleGenerateInvoice}>
            {/* ============================================================== */}
            {/* Section 1: Company & Tax Invoice Header (Optional)              */}
            {/* ============================================================== */}
            <div className="billing-section-accordion" id="accordion-section-header">
              <button
                type="button"
                className="billing-section-header"
                onClick={() => toggleSection("header")}
                aria-expanded={expandedSections.header}
              >
                <div className="billing-section-header-left">
                  <span className="billing-section-icon">🏢</span>
                  <span>Company Header & Registered Office</span>
                </div>
                <div className="billing-section-header-right">
                  <span className="badge-optional">Optional</span>
                  <svg
                    className={`billing-section-chevron ${expandedSections.header ? "expanded" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expandedSections.header && (
                <div className="billing-section-body">
                  <div className="form-group row" style={{ marginBottom: "0.875rem" }}>
                    <div>
                      <label className="form-label" htmlFor="company-name">Company Brand Name</label>
                      <input
                        type="text"
                        id="company-name"
                        className="form-input"
                        placeholder="e.g. PaintCorp"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="company-subtitle">Company Suffix / Subtitle</label>
                      <input
                        type="text"
                        id="company-subtitle"
                        className="form-input"
                        placeholder="e.g. PVT LTD"
                        value={companySubtitle}
                        onChange={(e) => setCompanySubtitle(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group row" style={{ marginBottom: "0.875rem" }}>
                    <div>
                      <label className="form-label" htmlFor="company-cin">Corporate Identity (CIN)</label>
                      <input
                        type="text"
                        id="company-cin"
                        className="form-input"
                        placeholder="e.g. L24202MH1920PLC000825"
                        value={companyCin}
                        onChange={(e) => setCompanyCin(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="company-logo-letter">Logo Letter Mark</label>
                      <input
                        type="text"
                        id="company-logo-letter"
                        className="form-input"
                        placeholder="P"
                        maxLength={2}
                        value={companyLogoLetter}
                        onChange={(e) => setCompanyLogoLetter(e.target.value.toUpperCase())}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: "0.875rem" }}>
                    <label className="form-label" htmlFor="company-reg-office">Registered Office Address</label>
                    <textarea
                      id="company-reg-office"
                      className="form-input"
                      rows="2"
                      value={companyRegOffice}
                      onChange={(e) => setCompanyRegOffice(e.target.value)}
                      style={{ resize: "none", fontFamily: "inherit" }}
                    />
                  </div>

                  <div className="form-group row" style={{ marginBottom: "0.875rem" }}>
                    <div>
                      <label className="form-label" htmlFor="company-tel">Telephone</label>
                      <input
                        type="text"
                        id="company-tel"
                        className="form-input"
                        placeholder="e.g. 022 4060 2500"
                        value={companyTel}
                        onChange={(e) => setCompanyTel(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="company-website">Website</label>
                      <input
                        type="text"
                        id="company-website"
                        className="form-input"
                        placeholder="e.g. www.PaintCorp.com"
                        value={companyWebsite}
                        onChange={(e) => setCompanyWebsite(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group row" style={{ marginBottom: 0 }}>
                    <div>
                      <label className="form-label" htmlFor="company-tollfree">Toll Free Contact</label>
                      <input
                        type="text"
                        id="company-tollfree"
                        className="form-input"
                        placeholder="e.g. 1800 209 2092"
                        value={companyTollFree}
                        onChange={(e) => setCompanyTollFree(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="invoice-title">Invoice Heading Title</label>
                      <input
                        type="text"
                        id="invoice-title"
                        className="form-input"
                        placeholder="TAX INVOICE"
                        value={invoiceTitle}
                        onChange={(e) => setInvoiceTitle(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ============================================================== */}
            {/* Section 2: Supplying Location Address (Optional)                */}
            {/* ============================================================== */}
            <div className="billing-section-accordion" id="accordion-section-supplying">
              <button
                type="button"
                className="billing-section-header"
                onClick={() => toggleSection("supplying")}
                aria-expanded={expandedSections.supplying}
              >
                <div className="billing-section-header-left">
                  <span className="billing-section-icon">🏭</span>
                  <span>Supplying Location (Dispatch From)</span>
                </div>
                <div className="billing-section-header-right">
                  <span className="badge-optional">Optional</span>
                  <svg
                    className={`billing-section-chevron ${expandedSections.supplying ? "expanded" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expandedSections.supplying && (
                <div className="billing-section-body">
                  <div className="form-group row" style={{ marginBottom: "0.875rem" }}>
                    <div>
                      <label className="form-label" htmlFor="supplying-name">Supplier Branch / Plant Name</label>
                      <input
                        type="text"
                        id="supplying-name"
                        className="form-input"
                        placeholder="e.g. PaintCorp LTD (D989)"
                        value={supplyingName}
                        onChange={(e) => setSupplyingName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="supplying-gstin">Supplier GSTIN</label>
                      <input
                        type="text"
                        id="supplying-gstin"
                        className="form-input"
                        placeholder="e.g. 33ABCDE1234F1Z5"
                        value={supplyingGstin}
                        onChange={(e) => setSupplyingGstin(e.target.value.toUpperCase())}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: "0.875rem" }}>
                    <label className="form-label" htmlFor="supplying-warehouse">Godown / Warehouse Line</label>
                    <input
                      type="text"
                      id="supplying-warehouse"
                      className="form-input"
                      placeholder="e.g. TAMILNADU WAREHOUSING CORP GODOWN NO 5, NO 6"
                      value={supplyingWarehouse}
                      onChange={(e) => setSupplyingWarehouse(e.target.value)}
                    />
                  </div>

                  <div className="form-group row" style={{ marginBottom: "0.875rem" }}>
                    <div style={{ flex: 1.5 }}>
                      <label className="form-label" htmlFor="supplying-address">Supplier Address</label>
                      <input
                        type="text"
                        id="supplying-address"
                        className="form-input"
                        placeholder="e.g. STC COLLEGE ROAD, TIRUNELVELI-627007"
                        value={supplyingAddress}
                        onChange={(e) => setSupplyingAddress(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="supplying-state">State</label>
                      <input
                        type="text"
                        id="supplying-state"
                        className="form-input"
                        placeholder="e.g. Tamil Nadu"
                        value={supplyingState}
                        onChange={(e) => setSupplyingState(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="supplying-phone">Supplier Contact Phone</label>
                    <input
                      type="text"
                      id="supplying-phone"
                      className="form-input"
                      placeholder="e.g. 1234567890 / 2589631478"
                      value={supplyingPhone}
                      onChange={(e) => setSupplyingPhone(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ============================================================== */}
            {/* Section 3: Bill To Party (Customer Details) (Editable)          */}
            {/* ============================================================== */}
            <div className="billing-section-accordion" id="accordion-section-customer">
              <button
                type="button"
                className="billing-section-header"
                onClick={() => toggleSection("customer")}
                aria-expanded={expandedSections.customer}
              >
                <div className="billing-section-header-left">
                  <span className="billing-section-icon">👤</span>
                  <span>Bill To Party (Customer & Delivery Recipient)</span>
                </div>
                <div className="billing-section-header-right">
                  <span className="badge-required">Editable</span>
                  <svg
                    className={`billing-section-chevron ${expandedSections.customer ? "expanded" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expandedSections.customer && (
                <div className="billing-section-body">
                  <div className="form-group row" style={{ marginBottom: "0.875rem" }}>
                    <div>
                      <label className="form-label" htmlFor="customer-name">
                        Customer Full Name <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>(Optional: defaults to KRISHNA PAINTS)</span>
                      </label>
                      <input
                        type="text"
                        id="customer-name"
                        className="form-input"
                        placeholder="e.g. KRISHNA PAINTS"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="customer-phone">
                        Contact Phone Number <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>(Optional)</span>
                      </label>
                      <input
                        type="text"
                        id="customer-phone"
                        className="form-input"
                        placeholder="e.g. +91 9366701553"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group row" style={{ marginBottom: "0.875rem" }}>
                    <div>
                      <label className="form-label" htmlFor="customer-gst" style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Customer GSTIN</span>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Optional for Retail</span>
                      </label>
                      <input
                        type="text"
                        id="customer-gst"
                        className="form-input"
                        placeholder="e.g. 33AHRPK6118P1ZR"
                        value={customerGst}
                        onChange={(e) => setCustomerGst(e.target.value.toUpperCase())}
                        maxLength={15}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="party-code">
                        Party Code / Account ID <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>(Optional)</span>
                      </label>
                      <input
                        type="text"
                        id="party-code"
                        className="form-input"
                        placeholder="e.g. 113715"
                        value={partyCode}
                        onChange={(e) => setPartyCode(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group row" style={{ marginBottom: "0.875rem" }}>
                    <div style={{ flex: 1.5 }}>
                      <label className="form-label" htmlFor="customer-address">
                        Billing / Shipping Address <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>(Optional: defaults to registered address)</span>
                      </label>
                      <textarea
                        id="customer-address"
                        className="form-input"
                        placeholder="e.g. 182-E/22-F, S.N. HIGH ROAD, TIRUNELVELI-627007"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        rows="2"
                        style={{ resize: "none", fontFamily: "inherit" }}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="place-of-supply">
                        Place Of Supply <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>(Optional)</span>
                      </label>
                      <input
                        type="text"
                        id="place-of-supply"
                        className="form-input"
                        placeholder="e.g. Tamil Nadu-33"
                        value={placeOfSupply}
                        onChange={(e) => setPlaceOfSupply(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ============================================================== */}
            {/* Section 4: e-Invoice & IRN Details (Optional)                   */}
            {/* ============================================================== */}
            <div className="billing-section-accordion" id="accordion-section-irn">
              <button
                type="button"
                className="billing-section-header"
                onClick={() => toggleSection("irn")}
                aria-expanded={expandedSections.irn}
              >
                <div className="billing-section-header-left">
                  <span className="billing-section-icon">🔐</span>
                  <span>e-Invoice & IRN Acknowledgement Details</span>
                </div>
                <div className="billing-section-header-right">
                  <span className="badge-optional">Optional</span>
                  <svg
                    className={`billing-section-chevron ${expandedSections.irn ? "expanded" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expandedSections.irn && (
                <div className="billing-section-body">
                  <div className="form-group" style={{ marginBottom: "0.875rem" }}>
                    <label className="form-label" htmlFor="irn-number">IRN Number (64-character Hash)</label>
                    <input
                      type="text"
                      id="irn-number"
                      className="form-input"
                      placeholder="e.g. 6bfe80a8545c427cb60cb8525dd6ec0c5c65c68d3e0fcb52987bc2170d4d6fee"
                      value={irnNumber}
                      onChange={(e) => setIrnNumber(e.target.value)}
                    />
                  </div>

                  <div className="form-group row" style={{ marginBottom: 0 }}>
                    <div>
                      <label className="form-label" htmlFor="ack-no">Ack No.</label>
                      <input
                        type="text"
                        id="ack-no"
                        className="form-input"
                        placeholder="e.g. 152626535708505"
                        value={ackNo}
                        onChange={(e) => setAckNo(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="ack-time">Ack Time (HH:MM:SS)</label>
                      <input
                        type="text"
                        id="ack-time"
                        className="form-input"
                        placeholder="e.g. 17:23:00"
                        value={ackTime}
                        onChange={(e) => setAckTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ============================================================== */}
            {/* Section 5: Invoice, Order & Transport Details (Optional)        */}
            {/* ============================================================== */}
            <div className="billing-section-accordion" id="accordion-section-logistics">
              <button
                type="button"
                className="billing-section-header"
                onClick={() => toggleSection("logistics")}
                aria-expanded={expandedSections.logistics}
              >
                <div className="billing-section-header-left">
                  <span className="billing-section-icon">🚚</span>
                  <span>Invoice, Order & Logistics Details</span>
                </div>
                <div className="billing-section-header-right">
                  <span className="badge-optional">Optional</span>
                  <svg
                    className={`billing-section-chevron ${expandedSections.logistics ? "expanded" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expandedSections.logistics && (
                <div className="billing-section-body">
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                    Invoice Metadata
                  </div>
                  <div className="form-group row" style={{ marginBottom: "0.875rem" }}>
                    <div>
                      <label className="form-label" htmlFor="invoice-number">Invoice Number</label>
                      <input
                        type="text"
                        id="invoice-number"
                        className="form-input"
                        placeholder="e.g. INV-20260808-6529"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                      />
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

                  <div className="form-group row" style={{ marginBottom: "0.875rem" }}>
                    <div>
                      <label className="form-label" htmlFor="invoice-time">Invoice Time</label>
                      <input
                        type="text"
                        id="invoice-time"
                        className="form-input"
                        placeholder="e.g. 17:23:02"
                        value={invoiceTime}
                        onChange={(e) => setInvoiceTime(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="eway-bill-no">E-way Bill No.</label>
                      <input
                        type="text"
                        id="eway-bill-no"
                        className="form-input"
                        placeholder="e.g. 502042422106"
                        value={ewayBillNo}
                        onChange={(e) => setEwayBillNo(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", margin: "1rem 0 0.5rem 0" }}>
                    Order Details
                  </div>
                  <div className="form-group row" style={{ marginBottom: "0.875rem" }}>
                    <div>
                      <label className="form-label" htmlFor="order-number">Order No.</label>
                      <input
                        type="text"
                        id="order-number"
                        className="form-input"
                        placeholder="e.g. 223035242"
                        value={orderNumber}
                        onChange={(e) => setOrderNumber(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="order-time">Order Time</label>
                      <input
                        type="text"
                        id="order-time"
                        className="form-input"
                        placeholder="e.g. 17:21:09"
                        value={orderTime}
                        onChange={(e) => setOrderTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: "0.875rem" }}>
                    <label className="form-label" htmlFor="po-scheme-no">PO / Scheme No.</label>
                    <input
                      type="text"
                      id="po-scheme-no"
                      className="form-input"
                      placeholder="e.g. RAJAN.S"
                      value={poSchemeNo}
                      onChange={(e) => setPoSchemeNo(e.target.value)}
                    />
                  </div>

                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", margin: "1rem 0 0.5rem 0" }}>
                    Delivery & Vehicle Transport
                  </div>
                  <div className="form-group row" style={{ marginBottom: "0.875rem" }}>
                    <div>
                      <label className="form-label" htmlFor="delivery-no">Delivery No.</label>
                      <input
                        type="text"
                        id="delivery-no"
                        className="form-input"
                        placeholder="e.g. 143957860"
                        value={deliveryNo}
                        onChange={(e) => setDeliveryNo(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="lr-no">LR No.</label>
                      <input
                        type="text"
                        id="lr-no"
                        className="form-input"
                        placeholder="e.g. LOCAL"
                        value={lrNo}
                        onChange={(e) => setLrNo(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group row" style={{ marginBottom: 0 }}>
                    <div>
                      <label className="form-label" htmlFor="vehicle-no">Vehicle Registration No.</label>
                      <input
                        type="text"
                        id="vehicle-no"
                        className="form-input"
                        placeholder="e.g. TN72BF9777"
                        value={vehicleNo}
                        onChange={(e) => setVehicleNo(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="dispatched-time">Dispatched Time</label>
                      <input
                        type="text"
                        id="dispatched-time"
                        className="form-input"
                        placeholder="e.g. 17:25:00"
                        value={dispatchedTime}
                        onChange={(e) => setDispatchedTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ============================================================== */}
            {/* Section 6: Add Products to Invoice (Cart)                       */}
            {/* ============================================================== */}
            <div className="billing-section-accordion" id="accordion-section-products">
              <button
                type="button"
                className="billing-section-header"
                onClick={() => toggleSection("products")}
                aria-expanded={expandedSections.products}
              >
                <div className="billing-section-header-left">
                  <span className="billing-section-icon">🎨</span>
                  <span>
                    Add Products to Invoice{" "}
                    {invoiceItems.length > 0 && (
                      <span style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 700 }}>
                        ({invoiceItems.length} item{invoiceItems.length > 1 ? "s" : ""})
                      </span>
                    )}
                  </span>
                </div>
                <div className="billing-section-header-right">
                  <span className="badge-required">Products</span>
                  <svg
                    className={`billing-section-chevron ${expandedSections.products ? "expanded" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expandedSections.products && (
                <div className="billing-section-body">
                  {/* Full-width Search Combobox */}
                  <div className="form-group" style={{ position: "relative", marginBottom: "1rem" }} ref={comboboxRef}>
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

                    {/* Wide Dropdown Popover List */}
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
                          maxHeight: "300px",
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
                          <span>Click to select</span>
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
                                  padding: "0.75rem 1rem",
                                  cursor: "pointer",
                                  borderBottom: "1px solid var(--border-color)",
                                  backgroundColor: isSelected
                                    ? "rgba(37, 99, 235, 0.08)"
                                    : "transparent",
                                  transition: "all 0.15s ease",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.25rem"
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = "var(--bg-sidebar)";
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <span
                                      style={{
                                        fontFamily: "monospace",
                                        fontWeight: 700,
                                        fontSize: "0.75rem",
                                        padding: "0.1rem 0.4rem",
                                        borderRadius: "4px",
                                        backgroundColor: "rgba(37, 99, 235, 0.12)",
                                        color: "var(--primary)"
                                      }}
                                    >
                                      {paint.id}
                                    </span>
                                    <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-main)" }}>
                                      {paint.name}
                                    </span>
                                  </div>
                                  <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--primary)" }}>
                                    {formatCurrency(paint.price)}
                                  </span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                  <span>Brand: {paint.brand} &bull; Finish: {paint.finish} &bull; Shade: {paint.color}</span>
                                  <span style={{ fontWeight: 600, color: isOut ? "var(--danger)" : isLow ? "var(--warning)" : "var(--success)" }}>
                                    {paint.quantity} L in stock
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ padding: "1.5rem", textAlign: "center", fontSize: "0.875rem", color: "var(--text-muted)" }}>
                            No paint products matched "<strong>{paintSearchQuery}</strong>"
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quantity and Action Buttons Row */}
                  <div className="form-group row" style={{ alignItems: "flex-end", marginBottom: "0.875rem" }}>
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

                  {/* Selected Paint Preview Card */}
                  {currentSelectedPaint && (
                    <div
                      style={{
                        backgroundColor: "var(--bg-sidebar)",
                        border: "1px solid var(--border-color)",
                        padding: "0.625rem 0.875rem",
                        borderRadius: "var(--radius-md)",
                        fontSize: "0.813rem",
                        marginBottom: "0.875rem"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong style={{ marginRight: "0.5rem" }}>{currentSelectedPaint.name}</strong>
                          <span style={{ color: "var(--text-muted)" }}>({currentSelectedPaint.brand})</span>
                        </div>
                        <span style={{ fontWeight: 700, color: "var(--primary)" }}>
                          {formatCurrency(currentSelectedPaint.price)} / L
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Added Items Mini Cart Table */}
                  {invoiceItems.length > 0 && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                        Items Currently in Invoice Draft ({invoiceItems.length})
                      </div>
                      <table className="billing-mini-cart-table">
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th style={{ textAlign: "center" }}>Qty</th>
                            <th style={{ textAlign: "right" }}>Rate</th>
                            <th style={{ textAlign: "right" }}>Total</th>
                            <th style={{ textAlign: "center" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceItems.map((item) => (
                            <tr key={item.paintId}>
                              <td>
                                <strong style={{ display: "block" }}>{item.paintName}</strong>
                                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{item.paintId}</span>
                              </td>
                              <td style={{ textAlign: "center", fontWeight: 600 }}>{item.quantity} L</td>
                              <td style={{ textAlign: "right" }}>{formatCurrency(item.price)}</td>
                              <td style={{ textAlign: "right", fontWeight: 600 }}>{formatCurrency(item.quantity * item.price)}</td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.paintId)}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "var(--danger)",
                                    cursor: "pointer",
                                    padding: "0.2rem 0.4rem",
                                    fontSize: "0.875rem",
                                    fontWeight: 700
                                  }}
                                  title="Remove item"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ============================================================== */}
            {/* Section 7: Tax, Terms & Signatory (Optional)                    */}
            {/* ============================================================== */}
            <div className="billing-section-accordion" id="accordion-section-terms">
              <button
                type="button"
                className="billing-section-header"
                onClick={() => toggleSection("terms")}
                aria-expanded={expandedSections.terms}
              >
                <div className="billing-section-header-left">
                  <span className="billing-section-icon">⚖️</span>
                  <span>HSN, Discount, Terms & Signatory</span>
                </div>
                <div className="billing-section-header-right">
                  <span className="badge-optional">Optional</span>
                  <svg
                    className={`billing-section-chevron ${expandedSections.terms ? "expanded" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expandedSections.terms && (
                <div className="billing-section-body">
                  <div className="form-group row" style={{ marginBottom: "0.875rem" }}>
                    <div>
                      <label className="form-label" htmlFor="default-hsn">Default HSN Code</label>
                      <input
                        type="text"
                        id="default-hsn"
                        className="form-input"
                        placeholder="e.g. 3214.10.00"
                        value={defaultHsn}
                        onChange={(e) => setDefaultHsn(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="discount-percent">Cash Discount Rate (%)</label>
                      <input
                        type="number"
                        id="discount-percent"
                        className="form-input"
                        placeholder="5"
                        min="0"
                        max="100"
                        step="0.5"
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group row" style={{ marginBottom: "0.875rem" }}>
                    <div>
                      <label className="form-label" htmlFor="cgst-rate">CGST Rate (%)</label>
                      <input
                        type="number"
                        id="cgst-rate"
                        className="form-input"
                        placeholder="9"
                        min="0"
                        max="28"
                        step="0.5"
                        value={cgstRate}
                        onChange={(e) => setCgstRate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="sgst-rate">SGST Rate (%)</label>
                      <input
                        type="number"
                        id="sgst-rate"
                        className="form-input"
                        placeholder="9"
                        min="0"
                        max="28"
                        step="0.5"
                        value={sgstRate}
                        onChange={(e) => setSgstRate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: "0.875rem" }}>
                    <label className="form-label" htmlFor="scheme-terms">Scheme Eligibility Header</label>
                    <input
                      type="text"
                      id="scheme-terms"
                      className="form-input"
                      value={schemeTerms}
                      onChange={(e) => setSchemeTerms(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: "0.875rem" }}>
                    <label className="form-label" htmlFor="declaration-text">Legal Declaration Text</label>
                    <textarea
                      id="declaration-text"
                      className="form-input"
                      rows="3"
                      value={declarationText}
                      onChange={(e) => setDeclarationText(e.target.value)}
                      style={{ resize: "none", fontFamily: "inherit" }}
                    />
                  </div>

                  <div className="form-group row" style={{ marginBottom: 0 }}>
                    <div>
                      <label className="form-label" htmlFor="signatory-company">Company Signing Authority</label>
                      <input
                        type="text"
                        id="signatory-company"
                        className="form-input"
                        placeholder="For PaintCorp Limited"
                        value={signatoryCompany}
                        onChange={(e) => setSignatoryCompany(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="signatory-designation">Signatory Title</label>
                      <input
                        type="text"
                        id="signatory-designation"
                        className="form-input"
                        placeholder="Authorised Signatory"
                        value={signatoryDesignation}
                        onChange={(e) => setSignatoryDesignation(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {formErrors.items && (
              <div className="form-error" style={{ margin: "0.875rem 0", fontSize: "0.875rem", textAlign: "center" }}>
                {formErrors.items}
              </div>
            )}

            <div className="dropdown-divider" style={{ margin: "1.25rem 0" }}></div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              style={{ padding: "0.75rem", fontSize: "0.938rem", fontWeight: 700 }}
              id="billing-generate-invoice-btn"
            >
              Generate Sales Invoice
            </button>
          </form>
        </div>

        {/* Right Side: OFFICIAL ENTERPRISE TAX INVOICE PREVIEW */}
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
                  {companyLogoLetter || "P"}
                </div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: "14px", letterSpacing: "0.5px" }}>{companyName || "PaintCorp"}</div>
                  <div style={{ fontWeight: 900, fontSize: "16px", letterSpacing: "1px", lineHeight: "1" }}>{companySubtitle || "PVT LTD"}</div>
                </div>
              </div>
              <div style={{ fontSize: "9px", marginTop: "6px", color: "#333" }}>
                <strong>Registered Office:</strong> {companyRegOffice || "28th Floor, A-Wing, Marathon Futurex, N. M. Joshi Marg, Lower Parel, Mumbai - 400013"}<br />
                Tel: {companyTel || "022 4060 2500"} &bull; Website: {companyWebsite || "www.PaintCorp.com"} &bull; Toll Free: {companyTollFree || "1800 209 2092"}
              </div>
            </div>
            <div style={{ flex: 1, textAlign: "right", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <span style={{ border: "1.5px solid #000", padding: "2px 8px", fontWeight: "bold", fontSize: "12px", textTransform: "uppercase" }}>
                  {invoiceTitle || "TAX INVOICE"}
                </span>
                <div style={{ fontSize: "9px", fontWeight: "bold", marginTop: "4px" }}>{invoiceSubtitle || "ORIGINAL FOR RECIPIENT"}</div>
              </div>
              <div style={{ fontSize: "9px" }}>
                <strong>CIN:</strong> {companyCin || "L24202MH1920PLC000825"}
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
              <div style={{ fontWeight: "bold" }}>{supplyingName || "PaintCorp LTD (D989)"}</div>
              <div>{supplyingWarehouse || "TAMILNADU WAREHOUSING CORP GODOWN NO 5, NO 6"}</div>
              <div>{supplyingAddress || "STC COLLEGE ROAD, TIRUNELVELI-627007"}</div>
              <div>{supplyingState || "Tamil Nadu"}</div>
              <div>Tel - {supplyingPhone || "1234567890 / 2589631478"}</div>
              <div style={{ fontWeight: "bold", marginTop: "2px" }}>GSTIN- {supplyingGstin || "33ABCDE1234F1Z5"}</div>
            </div>

            {/* Box 2: Bill To Party */}
            <div style={{ padding: "6px", borderRight: "1px solid #000" }}>
              <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "10px", borderBottom: "1px solid #ddd", paddingBottom: "2px", marginBottom: "4px" }}>
                Bill To Party : <span style={{ fontWeight: "normal" }}>{partyCode || "113715"}</span>
              </div>
              <div style={{ fontWeight: "bold", fontSize: "12px" }}>{customerName || "KRISHNA PAINTS"}</div>
              <div>{customerAddress || "182-E/22-F, S.N. HIGH ROAD, TIRUNELVELI-627007"}</div>
              <div>Place Of Supply: {placeOfSupply || "Tamil Nadu-33"}</div>
              <div style={{ fontWeight: "bold", color: "#000", marginTop: "2px" }}>
                GSTIN- {customerGst ? customerGst.toUpperCase() : "33AHRPK6118P1ZR"}
              </div>
              <div>Tel - {customerPhone || "9366701553"}</div>
            </div>

            {/* Box 3: IRN Number & QR Code */}
            <div style={{ padding: "6px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ fontSize: "8.5px", wordBreak: "break-all" }}>
                <strong>IRN Number:</strong><br />
                {irnNumber || "6bfe80a8545c427cb60cb8525dd6ec0c5c65c68d3e0fcb52987bc2170d4d6fee"}<br />
                <strong>Ack No.:</strong> {ackNo || "152626535708505"}<br />
                <strong>Ack Date:</strong> {invoiceDate} {ackTime || "17:23:00"}
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
              Invoice Date/Time: {invoiceDate} {invoiceTime || "17:23:02"}<br />
              E-way Bill No: {ewayBillNo || "502042422106"}
            </div>
            <div style={{ borderLeft: "1px solid #ccc", borderRight: "1px solid #ccc", paddingLeft: "6px", paddingRight: "6px" }}>
              <strong>Order Details :</strong><br />
              Order No: {orderNumber || "223035242"}<br />
              Order Date/Time: {orderDate || invoiceDate} {orderTime || "17:21:09"}<br />
              PO/Scheme No: {poSchemeNo || "RAJAN.S"}
            </div>
            <div style={{ paddingLeft: "6px" }}>
              <strong>Delivery & Vehicle Details :</strong><br />
              Delivery No: {deliveryNo || "143957860"} &bull; LR No: {lrNo || "LOCAL"}<br />
              Vehicle No: <strong>{vehicleNo || "TN72BF9777"}</strong><br />
              Dispatched Date: {dispatchedDate || invoiceDate} {dispatchedTime || "17:25:00"}
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
                <th style={{ border: "1px solid #000", padding: "4px" }}>Discount ({discountPercent}%)</th>
                <th style={{ border: "1px solid #000", padding: "4px" }}>Taxable Amount</th>
                <th style={{ border: "1px solid #000", padding: "4px" }}>Tax Amount (CGST+SGST)</th>
                <th style={{ border: "1px solid #000", padding: "4px" }}>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoiceItems.length > 0 ? (
                invoiceItems.map((item, idx) => {
                  const numPrice = Number(item.price) || 0;
                  const numQty = Number(item.quantity) || 0;
                  const itemValue = numPrice * numQty;
                  const itemDiscount = itemValue * discountRateNum;
                  const itemTaxable = itemValue - itemDiscount;
                  const itemTax = itemTaxable * (cgstRateNum + sgstRateNum);
                  const itemTotal = itemTaxable + itemTax;

                  return (
                    <tr key={item.paintId || idx} style={{ textAlign: "center" }}>
                      <td style={{ border: "1px solid #000", padding: "4px", fontWeight: "bold" }}>{item.paintId}</td>
                      <td style={{ border: "1px solid #000", padding: "4px", textAlign: "left" }}>
                        <strong>{(item.paintName || "").toUpperCase()}</strong><br />
                        <span style={{ fontSize: "8px", color: "#444" }}>
                          GST: CGST {cgstRate}% + SGST {sgstRate}% | Brand: {item.brand || ""}
                        </span>
                      </td>
                      <td style={{ border: "1px solid #000", padding: "4px" }}>{item.hsn || defaultHsn || "3214.10.00"}</td>
                      <td style={{ border: "1px solid #000", padding: "4px" }}>{numQty}</td>
                      <td style={{ border: "1px solid #000", padding: "4px" }}>{numQty}.00</td>
                      <td style={{ border: "1px solid #000", padding: "4px" }}>{numPrice.toFixed(2)}</td>
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
                <span>Cash Discount {discountPercent} %</span>
                <span>{cashDiscount.toFixed(2)}-</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0", fontWeight: "bold" }}>
                <span>Assessable Value</span>
                <span>{assessableValue.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
                <span>Central GST (CGST {cgstRate}%)</span>
                <span>{cgst.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
                <span>State GST (SGST {sgstRate}%)</span>
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
                <th style={{ border: "1px solid #000", padding: "2px" }}>SGST ({sgstRate}%)</th>
                <th style={{ border: "1px solid #000", padding: "2px" }}>CGST ({cgstRate}%)</th>
                <th style={{ border: "1px solid #000", padding: "2px" }}>IGST</th>
                <th style={{ border: "1px solid #000", padding: "2px" }}>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ textAlign: "center" }}>
                <td style={{ border: "1px solid #000", padding: "2px" }}>{defaultHsn || "3214.10.00"}</td>
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
              {schemeTerms || "The products mentioned in the invoice are eligible for discount/scheme on satisfaction of terms and conditions mentioned in scheme circulars."}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr" }}>
              <div style={{ padding: "4px", borderRight: "1px solid #000", whiteSpace: "pre-line" }}>
                <strong>Declaration :</strong><br />
                {declarationText || "1. Prices are as per our Terms & Conditions and/or dealers Price List.\n2. No Receipt Valid except on our Official Form.\n3. In case of any Complaint, please cite Batch No & Date of Mfg.\n4. Any Dispute arising under this invoice shall be subject to Mumbai jurisdiction."}
              </div>
              <div style={{ padding: "4px", borderRight: "1px solid #000" }}>
                <strong>Customer Acknowledgement :</strong><br />
                Receipt Date: {customerReceiptDate || "_________________"}<br />
                Receipt Time: {customerReceiptTime || "_________________"}<br />
                <strong>Customer Sign & Stamp:</strong>
              </div>
              <div style={{ padding: "4px", textAlign: "right", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div><strong>{signatoryCompany || "For PaintCorp Limited"}</strong></div>
                <div style={{ marginTop: "24px", fontWeight: "bold" }}>{signatoryDesignation || "Authorised Signatory"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
