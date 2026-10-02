# Frequently Asked Questions (FAQ)

## 1. What is PaintCorp?
PaintCorp is an integrated enterprise resource planning (ERP) system for paint inventory, warehouse stock control, customer order processing, retail billing, and real-time sales reporting.

## 2. How do I check low stock products?
You can:
- Look at the low-stock alert counters on the Dashboard.
- Navigate to Available Stock (`/available-stock`) and filter by "Low Stock".
- Ask Corp AI directly: *"Which paints are low in stock?"*

## 3. What happens when an order is cancelled?
When an order is marked as Cancelled:
- Its status becomes `Cancelled`.
- Its revenue is excluded from sales reports.
- All paint quantities in that order are automatically restored back to the MySQL warehouse inventory.
- Double-cancellation is strictly blocked to avoid duplicate stock restorations.

## 4. How are sales calculated in Sales Analysis?
Sales metrics include all orders that are **not** Cancelled within the selected date range. Revenue is computed as the sum of order amounts; quantity sold is the sum of liters across non-cancelled order items.

## 5. Can Corp AI create or delete products or orders?
No. Corp AI is strictly **read-only**. It cannot create, edit, or delete products, change warehouse stock, or place or cancel orders. It is designed to safely retrieve information and explain system features.

## 6. Where does Corp AI get its data?
Corp AI queries live, verified PaintCorp backend endpoints connected directly to the MySQL database. It never fabricates or invents business data.

## 7. How do I change between Light and Dark mode?
Click on **Settings** in the sidebar, locate the Theme selector, and choose either Light, Dark, or System mode.

## 8. Can I modify or edit an order once submitted?
No. Once an order is placed and finalized, it cannot be modified directly. This ensures strict inventory and financial auditing integrity. If changes are necessary:
1. Cancel the existing order on the **Orders** page (`/orders`). This immediately and automatically restores all items back to warehouse stock.
2. Create a fresh order with the correct items, quantities, or customer details on the **Billing System** (`/billing`).

## 9. Why can't I find an order by invoice number?
In PaintCorp:
- Orders are tracked primarily by **Order ID** (e.g. `ORD1001`), customer name, or status.
- Invoices are generated at point-of-sale checkout and reference the corresponding Order ID.
- When searching on the **Orders** page (`/orders`), enter the Order ID (e.g. `ORD1001`) or customer name in the search bar.

## 10. Can warehouse stock become negative?
No. PaintCorp enforces strict transactional validation with row-level database locking (`SELECT ... FOR UPDATE`). If an order requests more stock than currently available in MySQL, the transaction fails and rolls back, preventing negative quantities.

## 11. How do I add a new paint product to the catalog?
1. Navigate to **Paint Catalog** (`/paint-list`).
2. Click the **+ Add Paint** button in the top action bar.
3. Fill in product details: Name, Brand (e.g. Asian Paints, Berger, Nerolac, Dulux), Category/Finish (Interior, Exterior, Primer, Enamel), Price per Liter (₹), Description, and Initial Stock.
4. Save the product to commit it directly to the database.

## 12. What database and architecture does PaintCorp use?
PaintCorp is built on:
- **Backend**: Node.js & Express RESTful API server.
- **Database**: MySQL relational database storing paints, inventory, orders, order items, and audit records.
- **Frontend**: Modern SPA with responsive sidebar, dashboard KPIs, and responsive data tables.
- **AI Engine**: Corp AI powered by Google Gemini with native database tools and local deterministic fallback.
