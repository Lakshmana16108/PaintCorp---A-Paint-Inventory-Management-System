# Billing System & Invoicing

## Overview
The Billing module (`/billing`) is PaintCorp's point-of-sale checkout system for creating customer orders and invoices.

## How to Create a Bill / Place an Order
1. Navigate to **Billing System** (`/billing`).
2. Select paint items from the catalog dropdown.
3. Enter the requested quantity in liters (L).
4. System automatically fetches unit price and calculates line-item subtotal.
5. Add additional items if needed.
6. Enter customer information:
   - Full Name
   - Phone Number
   - Delivery Address
7. The system computes the gross total amount (₹).
8. Click **Generate Bill / Place Order**.
9. The backend performs atomic stock verification with database row locking:
   - If stock is sufficient: inventory is deducted, the order record is inserted into `orders`, line items are inserted into `order_items`, and an order ID is assigned.
   - If stock is insufficient for any item: transaction rolls back and displays an error message.
10. Once placed, an invoice modal appears with print and download capabilities.
