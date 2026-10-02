# Inventory Management & Stock Consistency

## Single Source of Truth
In PaintCorp ERP, the MySQL relational database is the sole, authoritative source of truth for all inventory quantities.
The frontend and browser storage (such as localStorage) never maintain permanent stock quantities.

## Database Tables
- `products`: Holds catalog information and total aggregated stock quantities (`quantity`).
- `warehouse_stock`: Holds physical stock distribution across warehouses (`quantity`, `min_quantity`, `warehouse`).

## Stock Thresholds
- **Normal / In Stock**: When quantity is greater than the safety minimum (typically > 15 liters).
- **Low Stock**: When quantity is between 1 and 15 liters. Triggers alerts on the Dashboard and in Available Stock.
- **Out of Stock**: When quantity drops to 0 liters. The system blocks checkout for out-of-stock items.

## Concurrency and Stock Deductions
- When an order is placed in the Billing System, the backend opens a database transaction and executes `SELECT quantity FROM warehouse_stock WHERE ... FOR UPDATE`.
- This row-level lock guarantees that simultaneous orders cannot oversell stock.
- If available stock is less than the requested amount, the transaction is rejected with HTTP 400 ("Insufficient stock for [Product Name]").
- If stock is sufficient, the quantity is deducted immediately in both `warehouse_stock` and `products`.

## Stock Restoration
- If a customer order is marked as `Cancelled`, the backend automatically restores the exact line-item quantities back to the warehouse stock in MySQL.
- Double-cancellation is strictly blocked: attempting to cancel an already cancelled order returns an error and does not restore duplicate stock.
