# Warehouse Stock Management

## Overview
The Available Stock module (`/available-stock`) manages physical inventory distributed across PaintCorp warehouses.

## Warehouse Locations
- **Central Warehouse - Tirunelveli**: Primary distribution hub where newly created paint products are stocked by default.
- Regional storage facilities and branch depots.

## Warehouse Stock Schema
Each record in `warehouse_stock` consists of:
- `id`: Internal primary key.
- `paint_id`: Link to the product in the `products` table.
- `paint_name`: Complete product title.
- `brand`: Paint manufacturer.
- `warehouse`: Storage location name.
- `quantity`: Current inventory in liters.
- `min_quantity`: Safety threshold (default: 15 L).
- `status`: "In Stock", "Low Stock", or "Out of Stock".

## Updating Warehouse Stock
1. Navigate to **Available Stock** (`/available-stock`).
2. Search for the paint product or filter by status.
3. Click the **Edit Stock** button on the row.
4. Enter the new stock quantity and/or new minimum safety quantity.
5. Click **Save**.
6. The backend updates `warehouse_stock` and immediately synchronizes the new total quantity into the `products` catalog within an atomic transaction.
