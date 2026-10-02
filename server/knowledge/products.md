# Product and Paint Management in PaintCorp

## Overview
The Paint List module (`/paint-list`) manages all paint formulations stored in the MySQL `products` table.

## Product Fields
Each product record includes:
- **Product ID**: Unique alphanumeric code (e.g., `PNT101`, `PNT204`).
- **Paint Name**: Full official formulation name (e.g., `WeatherShield Exterior Emulsion`, `Nippon Spot-less Plus`, `Apex Ultima`).
- **Brand**: The paint manufacturer (e.g., Asian Paints, Berger, Dulux, Nippon Paint, Nerolac).
- **Category**: Primary application classification (Exterior, Interior, Primer, Waterproofing, Enamel, Wood Finish).
- **Color**: Paint shade (e.g., Pure White, Brilliant Blue, Golden Yellow, Slate Grey).
- **Finish**: Surface sheen (Matte, Gloss, Satin, Silk, High Gloss).
- **Price**: Unit price per liter in Indian Rupees (₹).
- **Quantity**: Total available inventory across warehouses in liters.
- **Status**: Computed stock availability:
  - `In Stock`: Quantity > 15 L.
  - `Low Stock`: 0 < Quantity <= 15 L.
  - `Out of Stock`: Quantity = 0 L.

## Workflows
### How to Add a New Paint Product
1. Open the **Paint List** page from the sidebar navigation.
2. Click the **"+ Add Paint"** button in the header.
3. Fill in the modal form:
   - Product Name (required)
   - Brand (required)
   - Category (Exterior, Interior, etc.)
   - Color and Finish
   - Unit Price (₹)
   - Initial Quantity (liters)
4. Click **Save Paint Product**.
5. The system saves the product in MySQL and automatically creates an initial warehouse stock record in the default warehouse within an atomic transaction.

### How to Edit or Delete a Product
- Click the **Edit** icon on any product row to modify price, brand, or specifications.
- Click the **Delete** icon to remove obsolete formulations (requires confirmation).
