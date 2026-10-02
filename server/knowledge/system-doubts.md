# PaintCorp System Doubts & Troubleshooting Guide

## 1. Why did my stock decrease after creating an order?
When an order is submitted through the Billing / POS page (`/billing`), PaintCorp immediately executes an atomic stock deduction transaction in MySQL. The quantity of each purchased paint item is subtracted from the corresponding warehouse stock (`warehouse_stock` table) and the total product stock (`products` table). This real-time deduction ensures that physical inventory matches system records and prevents other orders from claiming the same stock.

## 2. Why was stock restored after cancelling an order?
When an order's status is changed to `Cancelled` in the Orders page (`/orders`), the items from that order are considered returned or unfulfilled. PaintCorp's backend automatically loops through each item in the order (`order_items` table) and restores the exact quantities back into the warehouse inventory where they originally came from. Furthermore, PaintCorp implements strict double-cancellation safeguards so stock cannot be restored multiple times.

## 3. How does PaintCorp prevent negative stock?
PaintCorp enforces real-time stock validation at checkout. Before an invoice is finalized, the system queries current MySQL stock levels for each item. If the requested order quantity exceeds the available stock in the selected warehouse, the transaction is rejected with an error message: *"Insufficient stock for product. Available: X L, Requested: Y L"*. This prevents negative inventory and backorder overselling.

## 4. How does Sales Analysis calculate revenue?
The Sales Analysis dashboard (`/sales-analysis`) aggregates financial performance strictly from active transactions.
- **Revenue**: Sum of total amounts (`total_amount`) for all orders whose status is NOT `Cancelled` within the selected date range.
- **Quantity Sold**: Sum of liters (`quantity`) across all order items from non-cancelled orders.
- **Average Order Value (AOV)**: Total Revenue divided by the count of non-cancelled orders.
Cancelled orders are excluded from revenue to maintain financial accuracy.

## 5. Why can't I find a product in search?
If a paint product does not appear in the search results on the Paint List (`/paint-list`) or Billing (`/billing`):
1. Check the spelling of the paint name or brand (e.g., "Nippon", "Dulux", "Asian Paints").
2. Check the active Category or Finish filter dropdowns (e.g., Interior, Exterior, Matte, Gloss, Primer).
3. If looking in Billing, ensure the product has an active price and stock registered.

## 6. How do I create an order?
To create an order:
1. Navigate to the **Billing** page (`/billing`) from the sidebar.
2. Select or enter the customer details (Name, Phone, Email, Address).
3. Browse or search for the required paint products in the catalog.
4. Add items to the cart and specify the desired quantity in liters.
5. Review the invoice summary (subtotal, tax, discounts, total).
6. Click **Generate Bill / Checkout** to record the order and automatically deduct stock.

## 7. How does the low stock alert threshold work?
PaintCorp defines a standard safety reorder threshold of **15 Liters**. When any product's stock in a warehouse falls to 15 L or below, its status updates to `Low Stock` (amber warning). If the quantity reaches 0 L, the status updates to `Out of Stock` (red alert). These alerts appear on the Dashboard, Available Stock page, and are reported by Corp AI.

## 8. Why is my order showing cancelled?
An order displays as `Cancelled` if an authorized store manager or administrator marked the order as cancelled on the Orders page (`/orders`). When an order is cancelled:
- Its status cannot be reverted to Pending or Completed.
- The purchased quantities are immediately returned to warehouse stock.
- The order amount is omitted from sales analytics and revenue charts.

## 9. How does login and authentication work?
PaintCorp uses JSON Web Token (JWT) authentication:
- When a user logs in via the Login page (`/login`) with valid credentials, the backend generates a signed JWT token containing the user's role and session details.
- This token is securely stored in browser localStorage and attached to every API request via the `Authorization: Bearer <token>` header.
- If the token expires or is invalid, the user is redirected to the login screen.

## 10. How do multiple warehouses track paint stock?
PaintCorp organizes inventory across regional distribution centers (e.g., Madurai, Chennai, Coimbatore):
- The `warehouse_stock` table records the quantity of each specific paint in each warehouse location.
- The `products` table aggregates the total stock across all warehouses.
- When billing, the system verifies and deducts stock specifically from the supplying warehouse.
