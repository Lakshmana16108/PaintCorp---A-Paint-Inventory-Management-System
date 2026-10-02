# PaintCorp ERP - System Overview

## Introduction
PaintCorp is a full-featured Paint Inventory Management System designed to handle paint manufacturing, warehouse distribution, retail billing, order processing, and business analytics.

## Core Modules
1. **Dashboard (`/dashboard`)**:
   - High-level overview of enterprise paint operations.
   - Real-time stock counters, low-stock warnings, and quick activity feeds.

2. **Paint List (`/paint-list`)**:
   - Product catalog of paint formulations (emulsions, primers, enamels, waterproofing, wood finishes).
   - Formulation details: Brand, Category, Color, Finish, Unit Price (₹/L), Available Quantity (L), and Stock Status.
   - Create, edit, and delete paint products.

3. **Available Stock (`/available-stock`)**:
   - Detailed warehouse-level stock management.
   - Tracks stock across Central Warehouse (Tirunelveli) and regional hubs.
   - Safety thresholds: Minimum reorder quantity (default: 15 L).
   - Allows warehouse managers to adjust stock levels directly, which automatically synchronizes with the product catalog.

4. **Billing System (`/billing`)**:
   - Point-of-sale checkout and invoicing module.
   - Add line items with live stock validation to prevent overselling.
   - Enter customer billing info (Name, Phone, Address).
   - Calculates totals, generates orders, and creates printable/downloadable invoices.

5. **Orders Management (`/orders`, `/orders/:orderId`)**:
   - Tracks all customer orders from placement to fulfillment.
   - Lifecycle stages: Pending, Processing, Shipped, Delivered, Cancelled.
   - Allows status updates and order cancellation with automatic stock restoration.

6. **Sales Analysis Dashboard (`/sales-analysis`)**:
   - Comprehensive business intelligence derived directly from MySQL transactions.
   - Date range selector (From Date to To Date).
   - Key Performance Indicators: Total Revenue, Total Orders, Quantity Sold (L), Average Order Value (AOV).
   - Visual charts: Daily Sales Revenue trend line, Top Selling Paints bar chart, Revenue by Paint bar chart, and Order Status breakdown.
   - Paginated sales ledger table.

7. **Corp AI (`/corp-ai`)**:
   - Intelligent AI assistant specifically for PaintCorp.
   - Answers live business questions (stock, orders, sales, revenue) and system usage documentation.
   - Read-only, safe, and backed by verified MySQL data.

8. **Settings & Profile (`/settings`, `/profile`)**:
   - User account management, password changes, light/dark theme preference, and security controls.
