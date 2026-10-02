import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { formatCurrency } from "../utils/currencyFormatter";

export default function OrderDetails({ state }) {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const orders = state?.orders || [];
  const order = orders.find((o) => o.id === orderId);

  if (!order) {
    return (
      <div className="card" style={{ maxWidth: "500px", margin: "3rem auto", padding: "2.5rem", textAlign: "center" }} id="order-not-found">
        <div style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          backgroundColor: "var(--danger-bg)",
          color: "var(--danger)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.5rem",
          fontWeight: 700,
          margin: "0 auto 1.5rem auto"
        }}>
          !
        </div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>Order Not Found</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
          We couldn't find any dispatch record matching ID "{orderId}".
        </p>
        <button className="btn btn-primary" onClick={() => navigate("/orders")} id="order-not-found-back">
          Back to Orders
        </button>
      </div>
    );
  }

  const items =
    Array.isArray(order.items) && order.items.length > 0
      ? order.items
      : [
        {
          id: 1,
          paintId: order.paintId || "PNT001",
          paintName: order.paintName || "Paint Product",
          quantity: Number(order.quantity) || 1,
          price: Number(order.price) || 0,
          amount: (Number(order.quantity) || 1) * (Number(order.price) || 0)
        }
      ];

  const totalCost =
    order.totalAmount !== undefined && order.totalAmount !== null
      ? Number(order.totalAmount)
      : items.reduce((sum, item) => sum + item.quantity * item.price, 0);

  return (
    <div className="card" style={{ maxWidth: "750px", margin: "2rem auto", padding: "2.5rem" }} id="order-details-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "1.25rem" }}>
        <div>
          <span style={{ fontSize: "0.875rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 600 }}>Purchase Order Details</span>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, margin: "0.25rem 0" }}>{order.id}</h2>
          <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>Placed on: {order.date}</span>
        </div>
        <span
          className={`badge ${order.status === "Delivered"
              ? "badge-success"
              : order.status === "Pending"
                ? "badge-warning"
                : order.status === "Cancelled"
                  ? "badge-danger"
                  : "badge-info"
            }`}
          style={{ fontSize: "0.875rem", padding: "0.375rem 0.75rem" }}
        >
          {order.status}
        </span>
      </div>

      {/* Customer Information */}
      <div style={{ marginBottom: "2rem" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--text-main)" }}>Customer Info</h3>
        <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem" }}>
          <strong style={{ color: "var(--text-muted)" }}>Name:</strong> {order.customerName}
        </p>
        <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem" }}>
          <strong style={{ color: "var(--text-muted)" }}>Phone:</strong> {order.customerPhone}
        </p>
        {order.customerAddress && (
          <p style={{ margin: 0, fontSize: "0.95rem" }}>
            <strong style={{ color: "var(--text-muted)" }}>Address:</strong> {order.customerAddress}
          </p>
        )}
      </div>

      {/* Order Items */}
      <div style={{ marginBottom: "2rem" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.875rem", color: "var(--text-main)" }}>Order Items</h3>
        <div className="table-container" style={{ border: "1px solid var(--border-color)", borderRadius: "8px", overflow: "hidden" }}>
          <table className="erp-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Product</th>
                <th className="text-right">Quantity</th>
                <th className="text-right">Unit Price</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const itemAmount = item.amount !== undefined ? item.amount : item.quantity * item.price;
                return (
                  <tr key={item.id || idx}>
                    <td className="font-semibold">{item.paintName}</td>
                    <td className="text-right">{item.quantity} L</td>
                    <td className="text-right">{formatCurrency(item.price)}</td>
                    <td className="text-right font-medium">{formatCurrency(itemAmount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Total Cost Information */}
      <div style={{ backgroundColor: "var(--bg-app)", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--border-color)", marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, fontSize: "1.15rem" }}>
          <span>Total Cost:</span>
          <span style={{ color: "var(--success-text)" }}>{formatCurrency(totalCost)}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "1rem" }}>
        <button className="btn btn-secondary" onClick={() => navigate("/orders")} id="order-details-back-btn">
          Back to Orders
        </button>
      </div>
    </div>
  );
}

