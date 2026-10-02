# Sales Analysis & Revenue Reporting

## Overview
The Sales Analysis module (`/sales-analysis`) provides real-time business intelligence calculated directly from historical MySQL order records.

## Date Range Selection
- Users can filter sales by **From Date** and **To Date** (defaults to the past 30 days).
- Supports dynamic querying across any custom date interval.

## Key Performance Indicators (KPIs)
1. **Total Revenue**: Sum of `total_amount` for all non-cancelled orders within the selected date interval.
2. **Total Orders**: Count of non-cancelled orders placed within the interval.
3. **Quantity Sold**: Sum of all liters sold across non-cancelled order items.
4. **Average Order Value (AOV)**: Computed as `Total Revenue / Total Orders`.

## Visual Charts
1. **Daily Sales Revenue**: Chronological line chart tracking revenue day-by-day. Inactive trading days are zero-filled so no dates are missing.
2. **Top Selling Paints**: Horizontal bar chart ranking paint formulations by liters sold with an expanded 180px Y-axis and rich hover tooltips displaying complete name, quantity, and revenue.
3. **Revenue by Paint**: Horizontal bar chart ranking formulations by gross revenue contribution with an expanded 180px Y-axis and rich hover tooltips.
4. **Order Status Breakdown**: Summary cards showing counts and total value across order statuses (Delivered, Pending, Processing, Shipped, Cancelled).

## Sales Details Table
- Paginated table showing individual order line items with Date, Order ID, Customer Name, Paint Formulation, Quantity (L), Amount (₹), and Status.
