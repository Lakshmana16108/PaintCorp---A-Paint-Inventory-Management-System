# PaintCorp ERP — Comprehensive System Documentation

## 1. Executive Summary & Overview

**PaintCorp ERP** is a full-stack, enterprise-grade Inventory & Distribution Management System designed specifically for paint manufacturers, regional distributors, and warehouse networks.

The application streamlines end-to-end inventory operations:
- Product specification cataloging (brand, category, finish, color, unit pricing).
- Multi-warehouse stock tracking across central and regional distribution depots.
- Automated low-stock thresholds and critical re-order alerts.
- Customer order dispatching, invoice generation, tax calculations, and printable receipts.
- Secure user authentication, 2-Factor authentication support, and OTP-based password recovery.
- Resilient dual-mode database system with automatic failover between MySQL and a local JSON persistent storage engine.

---

## 2. Technology Stack & Key Dependencies

### Frontend Architecture
- **Framework**: React 19 (`react` v19.2.8, `react-dom` v19.2.8)
- **Routing**: React Router DOM v7 (`react-router-dom` v7.18.2)
- **Build Tooling**: Vite 8 (`vite` v8.2.0) with `@vitejs/plugin-react` (Oxc/SWC fast compiler)
- **State Management**: React `useReducer` (`inventoryReducer.js`) combined with React Context API (`AuthContext`, `ThemeContext`, `ToastContext`)
- **Styling**: Modern Vanilla CSS with CSS Custom Properties, Dark Mode theme support, Glassmorphism, and responsive grid layouts (`src/styles/index.css`)

### Backend Architecture
- **Runtime & Framework**: Node.js with Express 4 (`express` v4.19.2)
- **Security & Protection**:
  - `express-rate-limit` (v7.2.0): IP-based rate limiting (100 requests per 15-minute window).
  - `cors` (v2.8.5): Cross-Origin Resource Sharing.
  - `bcryptjs` (v2.4.3): Password salt hashing.
  - `jsonwebtoken` (v9.0.2): JWT authentication with short-lived reset tokens.
- **Database Engine**:
  - `mysql2` (v3.9.7): Asynchronous MySQL connection pooling (`mysql2/promise`).
  - Native Fallback DB Engine: Custom JSON file pool (`fallback_users.json`, `fallback_products.json`, `fallback_stock.json`, `fallback_orders.json`, `fallback_otps.json`).
- **Communication & Mailing**:
  - `nodemailer` (v6.9.13): Gmail SMTP provider integration.
  - Simulated Outbox Fallback: Writes emails to `simulated_email.json` when SMTP credentials are not configured.

---

## 3. Database Schema & Data Models

The database schema (`paint_db.sql`) defines five primary tables with relational integrity and cascade rules:

```
                      +-------------------+
                      |       users       |
                      +-------------------+
                      | id (PK)           |
                      | name, email       |
                      | password, role    |
                      | mobile, username  |
                      +---------+---------+
                                |
                                | 1:N
                                v
                      +-------------------+
                      |password_reset_otps|
                      +-------------------+
                      | id (PK)           |
                      | user_id (FK)      |
                      | otp_hash          |
                      | expires_at        |
                      +-------------------+

+-------------------+                     +-------------------+
|     products      | 1:N                 |  warehouse_stock  |
+-------------------+-------------------->+-------------------+
| id (PK) [PNT001]  |                     | id (PK)           |
| name, brand       |                     | paint_id (FK)     |
| category, color   |                     | paint_name, brand |
| finish, price     |                     | warehouse         |
| quantity, status  |                     | quantity, min_qty |
+---------+---------+                     +-------------------+
          |
          | 1:N
          v
+-------------------+
|      orders       |
+-------------------+
| id (PK) [ORD101]  |
| customer_name     |
| customer_phone    |
| paint_id (FK)     |
| quantity, price   |
| order_date        |
| status            |
+-------------------+
```

### Table Specifications

1. **`users`**
   - Stores staff and administrative user details.
   - Key attributes: `id`, `name`, `email` (UNIQUE), `password` (bcrypt hash), `role` (`Administrator` / `Staff` / `Warehouse Manager`), `mobile`, `username`, `avatar` (Base64 longtext), `two_factor_enabled` (TINYINT).

2. **`password_reset_otps`**
   - Manages one-time password verification codes for password recovery.
   - Key attributes: `id`, `user_id` (FK -> `users.id` ON DELETE CASCADE), `otp_hash` (SHA256), `expires_at` (10-minute expiry), `attempts` (max 5), `used` (boolean).

3. **`products`**
   - The master catalog of manufactured or sold paint items.
   - Key attributes: `id` (e.g., `PNT001`), `name`, `brand` (e.g., Dulux, Asian Paints, Nippon, Berger), `category` (Interior, Exterior, Primer, Wood & Metal), `color`, `finish` (Matte, Satin, Gloss, Semi-Gloss), `price` (DECIMAL), `quantity` (total across all warehouses), `status` (`In Stock`, `Low Stock`, `Out of Stock`).

4. **`warehouse_stock`**
   - Location-specific inventory quantities.
   - Key attributes: `id`, `paint_id` (FK -> `products.id`), `paint_name`, `brand`, `warehouse` (e.g., Central Warehouse A, East Wing Depot, South Gate Facility), `quantity`, `min_quantity` (re-order threshold, default 15), `status`.

5. **`orders`**
   - Dispatch and customer sales invoices.
   - Key attributes: `id` (e.g., `ORD101`), `customer_name`, `customer_phone`, `customer_address`, `paint_name`, `paint_id`, `quantity`, `price`, `order_date`, `status` (`Pending`, `Processing`, `Packed`, `Shipped`, `Delivered`, `Cancelled`).

---

## 4. Full Application Architecture & File Map

```
EL2/
├── package.json                         # Root package configuration & run scripts
├── paint_db.sql                         # Database creation script & initial seeds
├── PROJECT_DOCUMENTATION.md             # Complete project technical documentation
├── README.md                            # Starter documentation template
├── index.html                           # HTML boilerplate & font imports
├── vite.config.js                       # Vite build configuration
│
├── server/                              # Node.js + Express Backend
│   ├── server.js                        # Express server entrypoint & middleware pipeline
│   ├── package.json                     # Server dependencies
│   ├── .env / .env.example              # Environment secrets & database settings
│   ├── config/
│   │   └── database.js                  # MySQL pool & JSON fallback pool engine
│   ├── controllers/
│   │   ├── authController.js            # Signup, login, OTP generation, verification & password reset
│   │   ├── productController.js         # Products catalog CRUD operations
│   │   ├── stockController.js           # Warehouse stock operations
│   │   └── orderController.js           # Orders creation & status updates
│   ├── middleware/
│   │   └── authMiddleware.js            # JWT verification middleware
│   ├── routes/
│   │   ├── authRoutes.js                # API endpoints for /api/auth
│   │   ├── productRoutes.js             # API endpoints for /api/paints
│   │   ├── stockRoutes.js               # API endpoints for /api/stock
│   │   └── orderRoutes.js               # API endpoints for /api/orders
│   ├── services/
│   │   └── emailService.js              # Gmail SMTP sender & JSON fallback logger
│   ├── utils/
│   │   ├── otp.js                       # 6-digit OTP code & SHA256 hashing
│   │   └── password.js                  # Bcrypt hashing & verification
│   ├── fallback_users.json              # Local JSON database for users
│   ├── fallback_otps.json               # Local JSON database for OTP reset codes
│   ├── fallback_products.json           # Local JSON database for products catalog
│   ├── fallback_stock.json              # Local JSON database for warehouse stock
│   ├── fallback_orders.json             # Local JSON database for customer orders
│   └── simulated_email.json             # Simulated email outbox
│
└── src/                                 # React Frontend Application
    ├── main.jsx                         # App mount, BrowserRouter & Context providers
    ├── App.jsx                          # Main routing tree, global data fetching & layout shell
    ├── components/
    │   ├── Layout.jsx                   # Master dashboard layout (Header + Sidebar + Content)
    │   ├── Navbar.jsx                   # Top navbar with search, notifications, theme toggle & profile menu
    │   ├── Sidebar.jsx                  # Navigation sidebar with dynamic active state highlighting
    │   ├── ProtectedRoute.jsx           # Guard restricting unauthenticated users
    │   ├── PublicRoute.jsx              # Guard redirecting authenticated users away from auth pages
    │   ├── Breadcrumbs.jsx              # Dynamic route breadcrumb trail
    │   ├── Pagination.jsx               # Reusable table pagination component
    │   ├── Spinner.jsx                  # Loading spinner overlay
    │   └── ConfirmationDialog.jsx       # Modal confirmation popup for action prompts
    ├── context/
    │   ├── AuthContext.jsx              # Authentication state provider (login/logout/user update)
    │   ├── ThemeContext.jsx             # Light/Dark theme provider & local persistence
    │   └── ToastContext.jsx             # Global toast alert notification system
    ├── pages/
    │   ├── Login.jsx                    # User login screen
    │   ├── SignUp.jsx                   # User signup screen
    │   ├── ForgotPassword.jsx           # Email submission page for password reset
    │   ├── VerifyOtp.jsx                # OTP code verification page
    │   ├── ResetPassword.jsx            # New password setup screen
    │   ├── Dashboard.jsx                # Main ERP dashboard with KPI metrics & activity logs
    │   ├── PaintList.jsx                # Product catalog page with search, filters & CRUD modals
    │   ├── AvailableStock.jsx           # Warehouse stock levels page with depot stock adjustments
    │   ├── Billing.jsx                  # Invoice generator page with real-time tax/discount calculator
    │   ├── Orders.jsx                   # Customer orders tracking page with status update capabilities
    │   ├── OrderDetails.jsx             # Detailed order timeline view & printable invoice
    │   ├── Profile.jsx                  # User profile editing & password change tab
    │   ├── Settings.jsx                 # System configuration, theme switcher & database sync status
    │   └── NotFound.jsx                 # Custom 404 page
    ├── reducers/
    │   └── inventoryReducer.js          # Central state reducer for products, stock & orders
    ├── services/
    │   └── api.js                       # Native fetch API wrapper with automatic JWT header injection
    ├── styles/
    │   └── index.css                    # Comprehensive CSS design system
    └── utils/
        ├── currencyFormatter.js         # Currency formatting utility (INR/USD)
        └── dummyData.js                 # Fallback seed dataset for client bootstrapping
```

---

## 5. Key Modules & Feature Explanations

### 1. Central State Reducer (`inventoryReducer.js`)
The application relies on a unified state tree managed via React's `useReducer`:
- **`LOAD_DATA`**: Hydrates state from live backend API queries.
- **`ADD_PAINT` / `UPDATE_PAINT` / `DELETE_PAINT`**: Modifies the product catalog while maintaining automatic inventory consistency across associated warehouse depots (e.g., automatically provisioning a default stock record in Central Warehouse A upon creation).
- **`UPDATE_STOCK`**: Adjusts specific depot quantities, recalculates total paint quantities across all warehouses, and automatically computes stock status (`In Stock`, `Low Stock`, `Out of Stock`).
- **`ADD_ORDER`**: Creates customer orders, deducts purchased quantities from warehouse inventory, and updates global stock levels.
- **`UPDATE_ORDER_STATUS`**: Updates delivery states (`Pending` -> `Processing` -> `Packed` -> `Shipped` -> `Delivered`). If an order is marked `Cancelled`, stock quantities are automatically restored to inventory.

### 2. Dual-Database Resilient Data Engine (`server/config/database.js`)
- **Primary Mode**: Connects to MySQL using `mysql2/promise` connection pooling. Auto-creates tables and seeds standard admin user on startup.
- **Automatic Fallback Mode**: If MySQL server is unreachable, backend gracefully transitions to `mockPool`, which reads/writes directly to local JSON files (`fallback_products.json`, `fallback_stock.json`, `fallback_orders.json`, `fallback_users.json`). Operations execute seamlessly without crashing the server or UI.

### 3. Secure Multi-Step Authentication & Password Recovery
- **Token Authorization**: Uses standard Bearer JWT tokens sent in request headers via `api.js`.
- **Password Reset Flow**:
  1. User enters registered email at `/forgot-password`.
  2. Server generates a cryptographically secure 6-digit OTP code (expires in 10 mins).
  3. OTP email is sent via Gmail SMTP or written to `simulated_email.json`.
  4. User enters code at `/verify-otp`. Upon verification, backend returns a short-lived `resetToken` (valid for 10 minutes).
  5. User submits new password at `/reset-password` authenticated by the `resetToken`.

### 4. Enterprise ERP Pages Overview

- **Dashboard (`/dashboard`)**:
  - Displays 6 dynamic KPI metric cards: Total Paint Types, Total Stock Quantity, Low Stock Items count, Today's Orders, Pending Orders, and Total Revenue.
  - Generates live Activity Logs for recent stock warnings and status changes.
  - Lists top recent dispatch orders with color-coded status badges.

- **Paint List Catalog (`/paint-list`)**:
  - Full product management catalog.
  - Multi-attribute search (Product ID, Name, Brand, Category, Color).
  - Filter by Finish (Matte, Satin, Gloss, Semi-Gloss) and Category.
  - Add Paint modal and Edit/Delete paint drawer.

- **Available Stock (`/available-stock`)**:
  - Multi-warehouse inventory depot view (Central Warehouse A, East Wing Depot, South Gate Facility).
  - Quick-edit inline stock quantity controls.
  - Critical low-stock warning banners when quantity falls below `minQuantity` threshold.

- **Billing & Invoice Generator (`/billing`)**:
  - Interactive invoice creator.
  - Customer information input (Name, Phone, Delivery Address).
  - Item selection with price lookup, quantity selection, dynamic Tax/GST (18%) computation, and Discount percentages.
  - Instant order dispatch and printable paper receipt view.

- **Orders & Logistics (`/orders` & `/orders/:orderId`)**:
  - Complete list of customer orders.
  - Status filter tabs (All, Pending, Processing, Packed, Shipped, Delivered, Cancelled).
  - Dropdown menu to instantly update dispatch status.
  - Deep-dive Order Details view with progress timeline stepper and line-item invoice breakdown.

- **User Profile (`/profile`) & Settings (`/settings`)**:
  - Profile photo avatar preview and upload (Base64 encoding).
  - Name, username, email, phone number, and role updates.
  - Password change tab with current password verification.
  - Theme mode toggling (Light / Dark mode), currency configuration, 2FA toggle, and manual database sync triggers.

---

## 6. Setup, Configuration & Running Guide

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)
- (Optional) MySQL Server v8.0+

### Installation & Execution Steps

1. **Clone & Install Dependencies**:
   ```bash
   # Install root / frontend dependencies
   npm install

   # Install server backend dependencies
   npm run dev --prefix server # Or cd server && npm install
   ```

2. **Environment Configuration**:
   Create a `.env` file inside the `server/` directory:
   ```env
   PORT=5000
   JWT_SECRET=paintcorp_super_secret_jwt_key_2026
   FRONTEND_URL=http://localhost:5173
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=paint_inventory
   EMAIL_USER=
   EMAIL_APP_PASSWORD=
   ```

3. **Database Initialization (Optional MySQL setup)**:
   Import `paint_db.sql` into MySQL if running a local MySQL server:
   ```bash
   mysql -u root -p < paint_db.sql
   ```
   *Note: If MySQL is not running, the application automatically boots in local JSON fallback mode without requiring any manual setup!*

4. **Launch Application**:
   Run the frontend and backend concurrently from the root directory:
   ```bash
   npm run dev
   ```
   - **Frontend URL**: `http://localhost:5173`
   - **Backend API**: `http://localhost:5000`

5. **Default Credentials**:
   - **Email**: `admin@paintcorp.com`
   - **Password**: `password123`

---

## 7. Summary of API Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/signup` | Register new user account | No |
| `POST` | `/api/auth/login` | Authenticate user & return JWT token | No |
| `POST` | `/api/auth/forgot-password` | Generate & send 6-digit OTP code | No |
| `POST` | `/api/auth/verify-otp` | Verify OTP code & return resetToken | No |
| `POST` | `/api/auth/reset-password` | Reset user password using resetToken | No |
| `GET`  | `/api/auth/me` | Fetch authenticated user profile | Yes (JWT) |
| `PUT`  | `/api/auth/change-password` | Update account password | Yes (JWT) |
| `GET`  | `/api/paints` | Fetch product catalog list | Yes (JWT) |
| `POST` | `/api/paints` | Add new product to catalog | Yes (JWT) |
| `PUT`  | `/api/paints/:id` | Update product catalog details | Yes (JWT) |
| `DELETE`| `/api/paints/:id` | Delete product from catalog | Yes (JWT) |
| `GET`  | `/api/stock` | Fetch warehouse stock levels | Yes (JWT) |
| `PUT`  | `/api/stock/:id` | Update warehouse stock quantity | Yes (JWT) |
| `GET`  | `/api/orders` | Fetch customer dispatch orders | Yes (JWT) |
| `POST` | `/api/orders` | Create new sales order / invoice | Yes (JWT) |
| `PUT`  | `/api/orders/:id/status`| Update order logistics status | Yes (JWT) |

---
*Documentation generated for PaintCorp ERP (EL2 codebase).*
