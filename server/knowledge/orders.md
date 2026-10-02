# Orders Management in PaintCorp

## Overview
The Orders module (`/orders` and `/orders/:orderId`) handles all customer sales orders placed through the Billing System.

## Order Fields
- **Order ID**: Formatted order identifier (e.g., `ORD101`, `ORD204`).
- **Customer Name**: Full name of the purchasing customer or contractor.
- **Customer Phone & Address**: Contact and delivery destination.
- **Order Date**: Date order was placed (YYYY-MM-DD).
- **Status**: Lifecycle status (Pending, Processing, Shipped, Delivered, Cancelled).
- **Total Amount**: Gross monetary value in Indian Rupees (₹).
- **Order Items**: Line items linked in `order_items` detailing paint formulations, quantities, and unit prices.

## Order Status Flow
1. **Pending**: Order placed; awaiting warehouse dispatch.
2. **Processing**: Order is being packed at the warehouse.
3. **Shipped**: Order is in transit with logistics.
4. **Delivered**: Order completed successfully.
5. **Cancelled**: Order revoked before delivery.

## Order Cancellation Policy
- Users can cancel an active order by clicking **Cancel Order** in the Orders table or on the Order Details page.
- Cancelling an order automatically marks its status as `Cancelled`.
- All paint quantities for that order are automatically returned to MySQL inventory.
- Cancelled orders are excluded from revenue and quantity calculations in Sales Analysis.
- Double-cancellation is strictly blocked.
