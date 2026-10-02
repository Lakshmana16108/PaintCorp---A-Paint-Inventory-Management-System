import React, { useState, useEffect, useContext } from "react";
import { ThemeContext } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";

// Define sensible defaults for settings
const DEFAULT_SETTINGS = {
  general: {
    companyName: "ABC Paint Distributors",
    businessAddress: "123 Paint Street, Industrial Area, Phase-1",
    phoneNumber: "+91 98765 43210",
    businessEmail: "example@email.com",
    gstNumber: "27AAAAA1111A1Z1",
    currency: "INR",
    dateFormat: "DD/MM/YYYY"
  },
  billing: {
    invoicePrefix: "INV",
    startingInvoiceNumber: "1001",
    gstRate: "18",
    defaultPaymentMethod: "UPI",
    invoiceFormat: "Standard",
    autoGenerateInvoiceNumber: true,
    autoUpdateStockAfterBilling: true,
    autoPrintInvoice: false,
    requireConfirmationBeforeFinalBilling: true
  },
  inventory: {
    lowStockThreshold: "20",
    criticalStockThreshold: "5",
    defaultWarehouse: "Central Warehouse A",
    enableLowStockAlerts: true,
    enableOutOfStockWarnings: true,
    autoDeductStockAfterBilling: true,
    enableReorderRecommendations: true
  },
  notifications: {
    lowStockNotifications: true,
    outOfStockNotifications: true,
    newOrderNotifications: true,
    orderDispatchedNotifications: true,
    paymentConfirmation: true,
    invoiceGenerated: true,
    dailySalesSummary: true,
    weeklyInventorySummary: false
  },
  appearance: {
    theme: "light",
    compactLayout: false,
    showAnimations: true,
    sidebarExpanded: true
  },
  security: {
    twoFactorEnabled: false
  }
};

export default function Settings() {
  const { theme, setTheme } = useContext(ThemeContext);
  const { showToast } = useToast();

  const [activeCategory, setActiveCategory] = useState("general");
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("paint_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Sync with ThemeContext state on load
        if (parsed.appearance && parsed.appearance.theme) {
          // ensure theme is set correctly if it differs
          if (parsed.appearance.theme !== theme) {
            setTheme(parsed.appearance.theme);
          }
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Local Form state for security passwords (not persisted in general settings)
  const [securityForm, setSecurityForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  // Keep local settings state updated if external Theme changes
  useEffect(() => {
    if (settings.appearance.theme !== theme) {
      setSettings((prev) => ({
        ...prev,
        appearance: {
          ...prev.appearance,
          theme
        }
      }));
    }
  }, [theme]);

  // General handler for nested state fields
  const handleToggleChange = (category, field) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: !prev[category][field]
      }
    }));
  };

  const handleInputChange = (category, field, value) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  const saveSection = (category) => {
    // Validation
    if (category === "general") {
      const { companyName, businessEmail, phoneNumber, gstNumber } = settings.general;
      if (!companyName.trim()) {
        showToast("Company Name is required.", "danger");
        return;
      }
      if (!businessEmail.trim() || !businessEmail.includes("@")) {
        showToast("Please enter a valid business email.", "danger");
        return;
      }
      if (!phoneNumber.trim()) {
        showToast("Phone Number is required.", "danger");
        return;
      }
      if (!gstNumber.trim()) {
        showToast("GST Number is required.", "danger");
        return;
      }
    }

    if (category === "billing") {
      const { invoicePrefix, startingInvoiceNumber, gstRate } = settings.billing;
      if (!invoicePrefix.trim()) {
        showToast("Invoice prefix is required.", "danger");
        return;
      }
      if (isNaN(parseInt(startingInvoiceNumber, 10)) || parseInt(startingInvoiceNumber, 10) < 0) {
        showToast("Starting invoice number must be a valid positive number.", "danger");
        return;
      }
      const gstVal = parseFloat(gstRate);
      if (isNaN(gstVal) || gstVal < 0 || gstVal > 100) {
        showToast("GST Rate must be a valid percentage between 0 and 100.", "danger");
        return;
      }
    }

    if (category === "inventory") {
      const { lowStockThreshold, criticalStockThreshold } = settings.inventory;
      const low = parseInt(lowStockThreshold, 10);
      const crit = parseInt(criticalStockThreshold, 10);
      if (isNaN(low) || low < 0) {
        showToast("Low Stock Threshold must be a positive number.", "danger");
        return;
      }
      if (isNaN(crit) || crit < 0) {
        showToast("Critical Stock Threshold must be a positive number.", "danger");
        return;
      }
      if (crit >= low) {
        showToast("Critical threshold should be lower than Low stock threshold.", "warning");
      }
    }

    // Apply specific side effects
    if (category === "appearance") {
      // Sync ThemeContext with selection
      setTheme(settings.appearance.theme);
    }

    // Persist
    localStorage.setItem("paint_settings", JSON.stringify(settings));
    showToast("Settings saved successfully.", "success");
  };

  const handlePasswordChangeSubmit = (e) => {
    e.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = securityForm;
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast("All password fields are required.", "danger");
      return;
    }
    if (newPassword.length < 6) {
      showToast("New password must be at least 6 characters.", "danger");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("New password and confirmation do not match.", "danger");
      return;
    }
    // Simulate successful password change
    showToast("Password updated successfully.", "success");
    setSecurityForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
  };

  return (
    <div id="settings-page" style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <div className="page-header">
        <div className="page-title">
          <h1>System Settings</h1>
          <p>Configure and manage business variables, alerts, and system appearance.</p>
        </div>
      </div>

      <div className="settings-container">
        {/* LEFT COLUMN: Settings Navigation */}
        <aside className="settings-nav">
          <button 
            className={`settings-nav-item ${activeCategory === "general" ? "active" : ""}`}
            onClick={() => setActiveCategory("general")}
            id="settings-nav-general"
          >
            <span className="icon" style={{ display: "flex", alignItems: "center" }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </span>
            <span>General</span>
          </button>

          <button 
            className={`settings-nav-item ${activeCategory === "billing" ? "active" : ""}`}
            onClick={() => setActiveCategory("billing")}
            id="settings-nav-billing"
          >
            <span className="icon" style={{ display: "flex", alignItems: "center" }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </span>
            <span>Billing</span>
          </button>

          <button 
            className={`settings-nav-item ${activeCategory === "inventory" ? "active" : ""}`}
            onClick={() => setActiveCategory("inventory")}
            id="settings-nav-inventory"
          >
            <span className="icon" style={{ display: "flex", alignItems: "center" }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </span>
            <span>Inventory</span>
          </button>

          <button 
            className={`settings-nav-item ${activeCategory === "notifications" ? "active" : ""}`}
            onClick={() => setActiveCategory("notifications")}
            id="settings-nav-notifications"
          >
            <span className="icon" style={{ display: "flex", alignItems: "center" }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </span>
            <span>Notifications</span>
          </button>

          <button 
            className={`settings-nav-item ${activeCategory === "appearance" ? "active" : ""}`}
            onClick={() => setActiveCategory("appearance")}
            id="settings-nav-appearance"
          >
            <span className="icon" style={{ display: "flex", alignItems: "center" }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </span>
            <span>Appearance</span>
          </button>

          <button 
            className={`settings-nav-item ${activeCategory === "security" ? "active" : ""}`}
            onClick={() => setActiveCategory("security")}
            id="settings-nav-security"
          >
            <span className="icon" style={{ display: "flex", alignItems: "center" }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </span>
            <span>Security</span>
          </button>
        </aside>

        {/* RIGHT COLUMN: Settings Content Area */}
        <section className="settings-content-card">
          {/* GENERAL SETTINGS */}
          {activeCategory === "general" && (
            <div id="settings-section-general">
              <h2 className="settings-section-title">General Settings</h2>
              <p className="settings-section-desc">Manage your business address, contact profiles, and display variables.</p>
              
              <div className="settings-group">
                <h3 className="settings-group-title">Business Information</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="company-name">Company Name</label>
                    <input 
                      type="text" 
                      id="company-name" 
                      className="form-input" 
                      value={settings.general.companyName}
                      onChange={(e) => handleInputChange("general", "companyName", e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="business-address">Business Address</label>
                    <textarea 
                      id="business-address" 
                      className="form-input" 
                      rows={3} 
                      style={{ resize: "vertical", fontFamily: "inherit" }}
                      value={settings.general.businessAddress}
                      onChange={(e) => handleInputChange("general", "businessAddress", e.target.value)}
                    />
                  </div>

                  <div className="form-group row">
                    <div>
                      <label className="form-label" htmlFor="phone-number">Phone Number</label>
                      <input 
                        type="text" 
                        id="phone-number" 
                        className="form-input" 
                        value={settings.general.phoneNumber}
                        onChange={(e) => handleInputChange("general", "phoneNumber", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="business-email">Business Email</label>
                      <input 
                        type="email" 
                        id="business-email" 
                        className="form-input" 
                        value={settings.general.businessEmail}
                        onChange={(e) => handleInputChange("general", "businessEmail", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="gst-number">GST Number</label>
                    <input 
                      type="text" 
                      id="gst-number" 
                      className="form-input" 
                      value={settings.general.gstNumber}
                      onChange={(e) => handleInputChange("general", "gstNumber", e.target.value)}
                    />
                  </div>

                  <div className="form-group row">
                    <div>
                      <label className="form-label" htmlFor="currency">Currency</label>
                      <select 
                        id="currency" 
                        className="select-input" 
                        style={{ width: "100%" }}
                        value={settings.general.currency}
                        onChange={(e) => handleInputChange("general", "currency", e.target.value)}
                      >
                        <option value="INR">₹ INR</option>
                        <option value="USD">$ USD</option>
                        <option value="EUR">€ EUR</option>
                        <option value="GBP">£ GBP</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label" htmlFor="date-format">Date Format</label>
                      <select 
                        id="date-format" 
                        className="select-input" 
                        style={{ width: "100%" }}
                        value={settings.general.dateFormat}
                        onChange={(e) => handleInputChange("general", "dateFormat", e.target.value)}
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "2rem", display: "flex", justifyContent: "flex-end" }}>
                <button 
                  className="btn btn-primary" 
                  onClick={() => saveSection("general")}
                  id="save-general-settings-btn"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {/* BILLING SETTINGS */}
          {activeCategory === "billing" && (
            <div id="settings-section-billing">
              <h2 className="settings-section-title">Billing Settings</h2>
              <p className="settings-section-desc">Adjust invoice prefix settings, Tax rates, and operational defaults.</p>
              
              <div className="settings-group">
                <h3 className="settings-group-title">Invoice Settings</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <div className="form-group row">
                    <div>
                      <label className="form-label" htmlFor="invoice-prefix">Invoice Prefix</label>
                      <input 
                        type="text" 
                        id="invoice-prefix" 
                        className="form-input" 
                        value={settings.billing.invoicePrefix}
                        onChange={(e) => handleInputChange("billing", "invoicePrefix", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="starting-invoice-number">Starting Invoice Number</label>
                      <input 
                        type="number" 
                        id="starting-invoice-number" 
                        className="form-input" 
                        value={settings.billing.startingInvoiceNumber}
                        onChange={(e) => handleInputChange("billing", "startingInvoiceNumber", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group row">
                    <div>
                      <label className="form-label" htmlFor="gst-rate">GST Rate (%)</label>
                      <input 
                        type="number" 
                        id="gst-rate" 
                        className="form-input" 
                        value={settings.billing.gstRate}
                        onChange={(e) => handleInputChange("billing", "gstRate", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="default-payment-method">Default Payment Method</label>
                      <select 
                        id="default-payment-method" 
                        className="select-input" 
                        style={{ width: "100%" }}
                        value={settings.billing.defaultPaymentMethod}
                        onChange={(e) => handleInputChange("billing", "defaultPaymentMethod", e.target.value)}
                      >
                        <option value="UPI">UPI</option>
                        <option value="Card">Credit/Debit Card</option>
                        <option value="Net Banking">Net Banking</option>
                        <option value="Cash">Cash</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="invoice-format">Invoice Format</label>
                    <select 
                      id="invoice-format" 
                      className="select-input" 
                      style={{ width: "100%" }}
                      value={settings.billing.invoiceFormat}
                      onChange={(e) => handleInputChange("billing", "invoiceFormat", e.target.value)}
                    >
                      <option value="Standard">Standard Layout</option>
                      <option value="Compact">Compact Layout</option>
                      <option value="Detailed">Detailed Layout</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: "1.5rem" }}>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <span className="settings-row-title">Automatically generate invoice number</span>
                      <span className="settings-row-desc">Let system assign structured serial keys to invoices.</span>
                    </div>
                    <div className="settings-row-control">
                      <label className="toggle-switch">
                        <input 
                          type="checkbox" 
                          checked={settings.billing.autoGenerateInvoiceNumber}
                          onChange={() => handleToggleChange("billing", "autoGenerateInvoiceNumber")}
                          id="billing-toggle-auto-invoice"
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="settings-row">
                    <div className="settings-row-info">
                      <span className="settings-row-title">Automatically update stock after billing</span>
                      <span className="settings-row-desc">Deduct items from warehouse inventory once receipt is finalized.</span>
                    </div>
                    <div className="settings-row-control">
                      <label className="toggle-switch">
                        <input 
                          type="checkbox" 
                          checked={settings.billing.autoUpdateStockAfterBilling}
                          onChange={() => handleToggleChange("billing", "autoUpdateStockAfterBilling")}
                          id="billing-toggle-auto-update-stock"
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="settings-row">
                    <div className="settings-row-info">
                      <span className="settings-row-title">Automatically print invoice</span>
                      <span className="settings-row-desc">Trigger standard printer dialog right after invoice creation.</span>
                    </div>
                    <div className="settings-row-control">
                      <label className="toggle-switch">
                        <input 
                          type="checkbox" 
                          checked={settings.billing.autoPrintInvoice}
                          onChange={() => handleToggleChange("billing", "autoPrintInvoice")}
                          id="billing-toggle-auto-print"
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="settings-row">
                    <div className="settings-row-info">
                      <span className="settings-row-title">Require confirmation before final billing</span>
                      <span className="settings-row-desc">Display approval prompt prior to locking invoice drafts.</span>
                    </div>
                    <div className="settings-row-control">
                      <label className="toggle-switch">
                        <input 
                          type="checkbox" 
                          checked={settings.billing.requireConfirmationBeforeFinalBilling}
                          onChange={() => handleToggleChange("billing", "requireConfirmationBeforeFinalBilling")}
                          id="billing-toggle-require-confirm"
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "2rem", display: "flex", justifyContent: "flex-end" }}>
                <button 
                  className="btn btn-primary" 
                  onClick={() => saveSection("billing")}
                  id="save-billing-settings-btn"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {/* INVENTORY SETTINGS */}
          {activeCategory === "inventory" && (
            <div id="settings-section-inventory">
              <h2 className="settings-section-title">Inventory Settings</h2>
              <p className="settings-section-desc">Manage warehouse variables, threshold alerts, and auto deductions.</p>
              
              <div className="settings-group">
                <h3 className="settings-group-title">Stock Management</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <div className="form-group row">
                    <div>
                      <label className="form-label" htmlFor="low-stock-threshold">Low Stock Threshold</label>
                      <input 
                        type="number" 
                        id="low-stock-threshold" 
                        className="form-input" 
                        value={settings.inventory.lowStockThreshold}
                        onChange={(e) => handleInputChange("inventory", "lowStockThreshold", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="critical-stock-threshold">Critical Stock Threshold</label>
                      <input 
                        type="number" 
                        id="critical-stock-threshold" 
                        className="form-input" 
                        value={settings.inventory.criticalStockThreshold}
                        onChange={(e) => handleInputChange("inventory", "criticalStockThreshold", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="default-warehouse">Default Warehouse</label>
                    <select 
                      id="default-warehouse" 
                      className="select-input" 
                      style={{ width: "100%" }}
                      value={settings.inventory.defaultWarehouse}
                      onChange={(e) => handleInputChange("inventory", "defaultWarehouse", e.target.value)}
                    >
                      <option value="Central Warehouse A">Central Warehouse A</option>
                      <option value="North Depot">North Depot</option>
                      <option value="South Depot">South Depot</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: "1.5rem" }}>
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <span className="settings-row-title">Enable low-stock alerts</span>
                      <span className="settings-row-desc">Show dashboard warnings and header highlights when stock goes below threshold.</span>
                    </div>
                    <div className="settings-row-control">
                      <label className="toggle-switch">
                        <input 
                          type="checkbox" 
                          checked={settings.inventory.enableLowStockAlerts}
                          onChange={() => handleToggleChange("inventory", "enableLowStockAlerts")}
                          id="inventory-toggle-low-stock-alert"
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="settings-row">
                    <div className="settings-row-info">
                      <span className="settings-row-title">Enable out-of-stock warnings</span>
                      <span className="settings-row-desc">Restrict orders and dispatches when physical quantities reach zero.</span>
                    </div>
                    <div className="settings-row-control">
                      <label className="toggle-switch">
                        <input 
                          type="checkbox" 
                          checked={settings.inventory.enableOutOfStockWarnings}
                          onChange={() => handleToggleChange("inventory", "enableOutOfStockWarnings")}
                          id="inventory-toggle-out-stock-warning"
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="settings-row">
                    <div className="settings-row-info">
                      <span className="settings-row-title">Automatically deduct stock after billing</span>
                      <span className="settings-row-desc">Link billing invoices directly to inventory counts.</span>
                    </div>
                    <div className="settings-row-control">
                      <label className="toggle-switch">
                        <input 
                          type="checkbox" 
                          checked={settings.inventory.autoDeductStockAfterBilling}
                          onChange={() => handleToggleChange("inventory", "autoDeductStockAfterBilling")}
                          id="inventory-toggle-auto-deduct"
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="settings-row">
                    <div className="settings-row-info">
                      <span className="settings-row-title">Enable reorder recommendations</span>
                      <span className="settings-row-desc">Display suggestions for paint stock replenishment in inventory grids.</span>
                    </div>
                    <div className="settings-row-control">
                      <label className="toggle-switch">
                        <input 
                          type="checkbox" 
                          checked={settings.inventory.enableReorderRecommendations}
                          onChange={() => handleToggleChange("inventory", "enableReorderRecommendations")}
                          id="inventory-toggle-reorder-recommend"
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "2rem", display: "flex", justifyContent: "flex-end" }}>
                <button 
                  className="btn btn-primary" 
                  onClick={() => saveSection("inventory")}
                  id="save-inventory-settings-btn"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {/* NOTIFICATION SETTINGS */}
          {activeCategory === "notifications" && (
            <div id="settings-section-notifications">
              <h2 className="settings-section-title">Notification Settings</h2>
              <p className="settings-section-desc">Manage system-wide alerts, payments, and summarized email updates.</p>
              
              <div className="settings-group">
                <h3 className="settings-group-title">Inventory Alerts</h3>
                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-title">Low Stock Notifications</span>
                    <span className="settings-row-desc">Alert system operators when warehouse batches run low.</span>
                  </div>
                  <div className="settings-row-control">
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={settings.notifications.lowStockNotifications}
                        onChange={() => handleToggleChange("notifications", "lowStockNotifications")}
                        id="notify-toggle-low-stock"
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-title">Out-of-Stock Notifications</span>
                    <span className="settings-row-desc">Urgent warning triggers when materials run out.</span>
                  </div>
                  <div className="settings-row-control">
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={settings.notifications.outOfStockNotifications}
                        onChange={() => handleToggleChange("notifications", "outOfStockNotifications")}
                        id="notify-toggle-out-stock"
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="settings-group">
                <h3 className="settings-group-title">Order Alerts</h3>
                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-title">New Order Notifications</span>
                    <span className="settings-row-desc">Prompt dispatcher teams immediately when buyers submit a request.</span>
                  </div>
                  <div className="settings-row-control">
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={settings.notifications.newOrderNotifications}
                        onChange={() => handleToggleChange("notifications", "newOrderNotifications")}
                        id="notify-toggle-new-order"
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-title">Order Dispatched Notifications</span>
                    <span className="settings-row-desc">Send dispatch alerts once shipping vehicles leave warehousing docks.</span>
                  </div>
                  <div className="settings-row-control">
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={settings.notifications.orderDispatchedNotifications}
                        onChange={() => handleToggleChange("notifications", "orderDispatchedNotifications")}
                        id="notify-toggle-dispatch-order"
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="settings-group">
                <h3 className="settings-group-title">Billing Notifications</h3>
                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-title">Payment Confirmation</span>
                    <span className="settings-row-desc">Show dynamic toast confirmations for successful payment receipts.</span>
                  </div>
                  <div className="settings-row-control">
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={settings.notifications.paymentConfirmation}
                        onChange={() => handleToggleChange("notifications", "paymentConfirmation")}
                        id="notify-toggle-payment-confirm"
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-title">Invoice Generated</span>
                    <span className="settings-row-desc">Push notifications when invoice document prints compile.</span>
                  </div>
                  <div className="settings-row-control">
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={settings.notifications.invoiceGenerated}
                        onChange={() => handleToggleChange("notifications", "invoiceGenerated")}
                        id="notify-toggle-invoice-gen"
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="settings-group">
                <h3 className="settings-group-title">Reports</h3>
                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-title">Daily Sales Summary</span>
                    <span className="settings-row-desc">Compile evening transactions into dispatch status reports.</span>
                  </div>
                  <div className="settings-row-control">
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={settings.notifications.dailySalesSummary}
                        onChange={() => handleToggleChange("notifications", "dailySalesSummary")}
                        id="notify-toggle-daily-report"
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-title">Weekly Inventory Summary</span>
                    <span className="settings-row-desc">Email extensive stock valuations and delta counts to managers.</span>
                  </div>
                  <div className="settings-row-control">
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={settings.notifications.weeklyInventorySummary}
                        onChange={() => handleToggleChange("notifications", "weeklyInventorySummary")}
                        id="notify-toggle-weekly-report"
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "2rem", display: "flex", justifyContent: "flex-end" }}>
                <button 
                  className="btn btn-primary" 
                  onClick={() => saveSection("notifications")}
                  id="save-notifications-settings-btn"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {/* APPEARANCE SETTINGS */}
          {activeCategory === "appearance" && (
            <div id="settings-section-appearance">
              <h2 className="settings-section-title">Appearance Settings</h2>
              <p className="settings-section-desc">Customize layout themes, animation states, and navigation modes.</p>
              
              <div className="settings-group">
                <h3 className="settings-group-title">Theme</h3>
                <div className="form-group">
                  <label className="form-label" htmlFor="app-theme-select">Application Theme</label>
                  <select 
                    id="app-theme-select" 
                    className="select-input" 
                    style={{ width: "100%" }}
                    value={settings.appearance.theme}
                    onChange={(e) => handleInputChange("appearance", "theme", e.target.value)}
                  >
                    <option value="light">Light Mode</option>
                    <option value="dark">Dark Mode</option>
                    <option value="system">System Default</option>
                  </select>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                    Select "System Default" to automatically match your operating system theme settings.
                  </span>
                </div>
              </div>

              <div className="settings-group">
                <h3 className="settings-group-title">Interface</h3>
                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-title">Compact Layout</span>
                    <span className="settings-row-desc">Compress padding grids to show more paint entries on screen.</span>
                  </div>
                  <div className="settings-row-control">
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={settings.appearance.compactLayout}
                        onChange={() => handleToggleChange("appearance", "compactLayout")}
                        id="appearance-toggle-compact"
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-title">Show Animations</span>
                    <span className="settings-row-desc">Use micro-transitions for page loading, sidebar expands, and modals.</span>
                  </div>
                  <div className="settings-row-control">
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={settings.appearance.showAnimations}
                        onChange={() => handleToggleChange("appearance", "showAnimations")}
                        id="appearance-toggle-animations"
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="settings-group">
                <h3 className="settings-group-title">Sidebar</h3>
                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-title">Expanded Sidebar</span>
                    <span className="settings-row-desc">Keep sidebar navigation expanded showing full labels by default.</span>
                  </div>
                  <div className="settings-row-control">
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={settings.appearance.sidebarExpanded}
                        onChange={() => handleToggleChange("appearance", "sidebarExpanded")}
                        id="appearance-toggle-sidebar"
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "2rem", display: "flex", justifyContent: "flex-end" }}>
                <button 
                  className="btn btn-primary" 
                  onClick={() => saveSection("appearance")}
                  id="save-appearance-settings-btn"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {/* SECURITY SETTINGS */}
          {activeCategory === "security" && (
            <div id="settings-section-security">
              <h2 className="settings-section-title">Security Settings</h2>
              <p className="settings-section-desc">Manage account password credentials, sessions, and verification methods.</p>
              
              <div className="settings-group">
                <h3 className="settings-group-title">Account Security</h3>
                
                <form onSubmit={handlePasswordChangeSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginBottom: "2rem" }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="current-password">Current Password</label>
                    <input 
                      type="password" 
                      id="current-password" 
                      className="form-input" 
                      placeholder="••••••••"
                      value={securityForm.currentPassword}
                      onChange={(e) => setSecurityForm({ ...securityForm, currentPassword: e.target.value })}
                    />
                  </div>

                  <div className="form-group row">
                    <div>
                      <label className="form-label" htmlFor="new-password">New Password</label>
                      <input 
                        type="password" 
                        id="new-password" 
                        className="form-input" 
                        placeholder="Min 6 characters"
                        value={securityForm.newPassword}
                        onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
                      <input 
                        type="password" 
                        id="confirm-password" 
                        className="form-input" 
                        placeholder="Re-type new password"
                        value={securityForm.confirmPassword}
                        onChange={(e) => setSecurityForm({ ...securityForm, confirmPassword: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <button 
                      type="submit" 
                      className="btn btn-secondary" 
                      id="change-password-submit-btn"
                    >
                      Update Password
                    </button>
                  </div>
                </form>

                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-title">Two-Factor Authentication</span>
                    <span className="settings-row-desc">Secure account with standard OTP tokens sent via authenticator app.</span>
                  </div>
                  <div className="settings-row-control">
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={settings.security.twoFactorEnabled}
                        onChange={() => handleToggleChange("security", "twoFactorEnabled")}
                        id="security-toggle-2fa"
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="settings-group">
                <h3 className="settings-group-title">Session Management</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
                  Active tokens protect current warehouse connections. Terminate sessions if security compromises occur.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
                  <button 
                    className="btn btn-danger" 
                    type="button" 
                    onClick={() => showToast("Terminated all external active sessions successfully.", "success")}
                    id="logout-all-devices-btn"
                  >
                    Logout from All Devices
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    type="button" 
                    onClick={() => showToast("Login activity log is clean. Last entry: C:\\Users\\HP (Windows/Chrome) - Just now.", "info")}
                    id="view-login-activity-btn"
                  >
                    View Login Activity
                  </button>
                </div>
              </div>

              <div style={{ marginTop: "2rem", display: "flex", justifyContent: "flex-end" }}>
                <button 
                  className="btn btn-primary" 
                  onClick={() => saveSection("security")}
                  id="save-security-settings-btn"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
