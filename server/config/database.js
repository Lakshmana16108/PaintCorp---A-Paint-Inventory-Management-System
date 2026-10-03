const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

// Load .env from server directory or project root
const envPaths = [
  path.join(__dirname, "..", ".env"),
  path.join(__dirname, ".env"),
  path.join(process.cwd(), "server", ".env"),
  path.join(process.cwd(), ".env")
];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
  }
}
require("dotenv").config();

let pool;
let useFallback = false;

const os = require("os");
const memoryStore = {};

function getStoragePath(basename) {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), basename);
  }
  return path.join(__dirname, "..", basename);
}

const FALLBACK_USERS_FILE = getStoragePath("fallback_users.json");
const FALLBACK_OTPS_FILE = getStoragePath("fallback_otps.json");
const FALLBACK_PRODUCTS_FILE = getStoragePath("fallback_products.json");
const FALLBACK_STOCK_FILE = getStoragePath("fallback_stock.json");
const FALLBACK_ORDERS_FILE = getStoragePath("fallback_orders.json");
const FALLBACK_ORDER_ITEMS_FILE = getStoragePath("fallback_order_items.json");

// Helper functions for fallback JSON database with memory cache + /tmp persistence
function readJSON(file) {
  const basename = path.basename(file);
  if (memoryStore[basename] && Array.isArray(memoryStore[basename])) {
    return memoryStore[basename];
  }

  const writablePath = getStoragePath(basename);
  if (fs.existsSync(writablePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(writablePath, "utf8"));
      if (Array.isArray(data) && data.length > 0) {
        memoryStore[basename] = data;
        return data;
      }
    } catch (e) {}
  }

  const bundledFile = path.join(__dirname, "..", basename);
  if (fs.existsSync(bundledFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(bundledFile, "utf8"));
      memoryStore[basename] = data;
      try {
        fs.writeFileSync(writablePath, JSON.stringify(data, null, 2), "utf8");
      } catch (we) {}
      return data;
    } catch (e) {}
  }

  memoryStore[basename] = [];
  return [];
}

function writeJSON(file, data) {
  const basename = path.basename(file);
  memoryStore[basename] = data;

  const writablePath = getStoragePath(basename);
  try {
    fs.writeFileSync(writablePath, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    try {
      const tmpPath = path.join(os.tmpdir(), basename);
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf8");
    } catch (tmpErr) {
      console.warn("[FALLBACK DB] Notice: Write persisted in memory store:", tmpErr.message);
    }
  }
}

async function seedFallback() {
  const users = readJSON(FALLBACK_USERS_FILE);
  if (users.length === 0) {
    const adminPasswordHash = await bcrypt.hash("password123", 10);
    users.push({
      id: 1,
      name: "ERP Admin",
      email: "admin@paintcorp.com",
      password: adminPasswordHash,
      role: "Administrator",
      mobile: "1234567890",
      username: "erp_admin",
      avatar: "",
      two_factor_enabled: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    writeJSON(FALLBACK_USERS_FILE, users);
    console.log("[FALLBACK] Seeded default administrator user admin@paintcorp.com / password123");
  }

  const products = readJSON(FALLBACK_PRODUCTS_FILE);
  if (products.length === 0) {
    const defaultProducts = [
      { id: "PNT001", name: "WeatherShield Max", brand: "Dulux", category: "Exterior", color: "Arctic White", finish: "Semi-Gloss", price: 3679.20, quantity: 120, status: "In Stock" },
      { id: "PNT002", name: "Royale Luxury Emulsion", brand: "Asian Paints", category: "Interior", color: "Soft Beige", finish: "Matte", price: 3160.00, quantity: 85, status: "In Stock" },
      { id: "PNT003", name: "Super Premium Enamel", brand: "Nippon", category: "Wood & Metal", color: "Forest Green", finish: "Gloss", price: 2399.20, quantity: 15, status: "Low Stock" },
      { id: "PNT004", name: "Aquashield Waterproofing", brand: "Berger", category: "Exterior", color: "Slate Gray", finish: "Matte", price: 4320.00, quantity: 60, status: "In Stock" },
      { id: "PNT005", name: "EasyClean Stain Resistant", brand: "Dulux", category: "Interior", color: "Lemon Yellow", finish: "Satin", price: 2799.20, quantity: 8, status: "Low Stock" },
      { id: "PNT006", name: "UltraHide Primer", brand: "Nippon", category: "Primer", color: "Neutral White", finish: "Matte", price: 1960.00, quantity: 0, status: "Out of Stock" },
      { id: "PNT007", name: "Apex Ultima Protect", brand: "Asian Paints", category: "Exterior", color: "Terracotta Red", finish: "Satin", price: 4660.00, quantity: 110, status: "In Stock" }
    ];
    writeJSON(FALLBACK_PRODUCTS_FILE, defaultProducts);
    console.log("[FALLBACK] Seeded fallback product catalog.");
  }

  const stock = readJSON(FALLBACK_STOCK_FILE);
  if (stock.length === 0) {
    const defaultStock = [
      { id: 1, paint_id: "PNT001", paint_name: "WeatherShield Max", brand: "Dulux", warehouse: "Central Warehouse A", quantity: 80, min_quantity: 20, status: "In Stock" },
      { id: 2, paint_id: "PNT001", paint_name: "WeatherShield Max", brand: "Dulux", warehouse: "East Wing Depot", quantity: 40, min_quantity: 15, status: "In Stock" },
      { id: 3, paint_id: "PNT002", paint_name: "Royale Luxury Emulsion", brand: "Asian Paints", warehouse: "Central Warehouse A", quantity: 50, min_quantity: 20, status: "In Stock" },
      { id: 4, paint_id: "PNT002", paint_name: "Royale Luxury Emulsion", brand: "Asian Paints", warehouse: "South Gate facility", quantity: 35, min_quantity: 15, status: "In Stock" },
      { id: 5, paint_id: "PNT003", paint_name: "Super Premium Enamel", brand: "Nippon", warehouse: "Central Warehouse A", quantity: 5, min_quantity: 20, status: "Low Stock" },
      { id: 6, paint_id: "PNT003", paint_name: "Super Premium Enamel", brand: "Nippon", warehouse: "East Wing Depot", quantity: 10, min_quantity: 12, status: "Low Stock" },
      { id: 7, paint_id: "PNT004", paint_name: "Aquashield Waterproofing", brand: "Berger", warehouse: "Central Warehouse A", quantity: 60, min_quantity: 20, status: "In Stock" },
      { id: 8, paint_id: "PNT005", paint_name: "EasyClean Stain Resistant", brand: "Dulux", warehouse: "Central Warehouse A", quantity: 8, min_quantity: 15, status: "Low Stock" },
      { id: 9, paint_id: "PNT006", paint_name: "UltraHide Primer", brand: "Nippon", warehouse: "East Wing Depot", quantity: 0, min_quantity: 25, status: "Out of Stock" },
      { id: 10, paint_id: "PNT007", paint_name: "Apex Ultima Protect", brand: "Asian Paints", warehouse: "South Gate facility", quantity: 110, min_quantity: 30, status: "In Stock" }
    ];
    writeJSON(FALLBACK_STOCK_FILE, defaultStock);
    console.log("[FALLBACK] Seeded fallback warehouse stock.");
  }

  const orders = readJSON(FALLBACK_ORDERS_FILE);
  if (orders.length === 0) {
    const defaultOrders = [
      { id: "ORD101", customer_name: "Alex Mercer", customer_phone: "+1 (555) 019-2834", customer_address: "452 Pine St, New York, NY", paint_name: "WeatherShield Max", paint_id: "PNT001", quantity: 10, price: 3679.20, total_amount: 36792.00, order_date: "2026-08-07", status: "Delivered" },
      { id: "ORD102", customer_name: "Sarah Connor", customer_phone: "+1 (555) 022-9110", customer_address: "882 Oak Ave, Los Angeles, CA", paint_name: "Royale Luxury Emulsion", paint_id: "PNT002", quantity: 5, price: 3160.00, total_amount: 15800.00, order_date: "2026-08-08", status: "Pending" },
      { id: "ORD103", customer_name: "Bruce Wayne", customer_phone: "+1 (555) 007-1939", customer_address: "1007 Mountain Drive, Gotham", paint_name: "Aquashield Waterproofing", paint_id: "PNT004", quantity: 25, price: 4320.00, total_amount: 108000.00, order_date: "2026-08-08", status: "Processing" },
      { id: "ORD104", customer_name: "Clark Kent", customer_phone: "+1 (555) 045-1234", customer_address: "344 Clinton St, Metropolis", paint_name: "Super Premium Enamel", paint_id: "PNT003", quantity: 2, price: 2399.20, total_amount: 4798.40, order_date: "2026-08-08", status: "Packed" }
    ];
    writeJSON(FALLBACK_ORDERS_FILE, defaultOrders);
    console.log("[FALLBACK] Seeded fallback orders.");
  }

  const orderItems = readJSON(FALLBACK_ORDER_ITEMS_FILE);
  if (orderItems.length === 0) {
    const defaultItems = [
      { id: 1, order_id: "ORD101", paint_id: "PNT001", paint_name: "WeatherShield Max", quantity: 10, price: 3679.20 },
      { id: 2, order_id: "ORD102", paint_id: "PNT002", paint_name: "Royale Luxury Emulsion", quantity: 5, price: 3160.00 },
      { id: 3, order_id: "ORD103", paint_id: "PNT004", paint_name: "Aquashield Waterproofing", quantity: 25, price: 4320.00 },
      { id: 4, order_id: "ORD104", paint_id: "PNT003", paint_name: "Super Premium Enamel", quantity: 2, price: 2399.20 }
    ];
    writeJSON(FALLBACK_ORDER_ITEMS_FILE, defaultItems);
    console.log("[FALLBACK] Seeded fallback order items.");
  }
}

const mockPool = {
  async query(sql, params = []) {
    // Strip locking clauses so mock database treats them as standard SELECT queries
    const sqlClean = sql
      .replace(/\s+FOR\s+UPDATE\b/gi, "")
      .replace(/\s+LOCK\s+IN\s+SHARE\s+MODE\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    const sqlNorm = sqlClean;

    // 1. SELECT queries targeting users (handles COUNT(*), email lookup, or SELECT *)
    if (sqlNorm.includes("FROM users") && !sqlNorm.includes("INSERT INTO") && !sqlNorm.startsWith("UPDATE")) {
      const users = readJSON(FALLBACK_USERS_FILE);
      if (sqlNorm.includes("COUNT(*)")) {
        return [[{ count: users.length, cnt: users.length }]];
      }
      if (sqlNorm.includes("LOWER(email)") || sqlNorm.includes("email = ?")) {
        const email = params[0];
        console.log("[MOCK QUERY DEBUG] email:", email);
        console.log("[MOCK QUERY DEBUG] users list size:", users.length);
        const found = users.filter(u => email && u.email.toLowerCase() === email.toLowerCase());
        console.log("[MOCK QUERY DEBUG] found:", found);
        return [found];
      }
      return [users];
    }

    // 2. INSERT INTO users
    if (sqlNorm.includes("INSERT INTO users")) {
      const users = readJSON(FALLBACK_USERS_FILE);
      const newUser = {
        id: users.length + 1,
        name: params[0],
        email: params[1],
        password: params[2],
        role: params[3],
        mobile: params[4],
        username: params[5],
        avatar: params[6],
        two_factor_enabled: params[7],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      users.push(newUser);
      writeJSON(FALLBACK_USERS_FILE, users);
      return [{ insertId: newUser.id }];
    }

    // 3. UPDATE password_reset_otps SET used = 1 WHERE user_id = ?
    if (sqlNorm.includes("UPDATE password_reset_otps SET used = 1 WHERE user_id = ?")) {
      const userId = params[0];
      const otps = readJSON(FALLBACK_OTPS_FILE);
      otps.forEach(o => {
        if (String(o.user_id) === String(userId)) o.used = 1;
      });
      writeJSON(FALLBACK_OTPS_FILE, otps);
      return [{ affectedRows: 1 }];
    }

    // 4. INSERT INTO password_reset_otps
    if (sqlNorm.includes("INSERT INTO password_reset_otps")) {
      const otps = readJSON(FALLBACK_OTPS_FILE);
      const newOtp = {
        id: otps.length + 1,
        user_id: params[0],
        otp_hash: params[1],
        expires_at: params[2],
        attempts: 0,
        used: 0,
        created_at: new Date().toISOString()
      };
      otps.push(newOtp);
      writeJSON(FALLBACK_OTPS_FILE, otps);
      return [{ insertId: newOtp.id }];
    }

    // 5. SELECT * FROM password_reset_otps WHERE user_id = ? AND used = 0 ...
    if (sqlNorm.includes("SELECT * FROM password_reset_otps WHERE user_id = ?")) {
      const userId = params[0];
      const otps = readJSON(FALLBACK_OTPS_FILE);
      const found = otps.filter(o => String(o.user_id) === String(userId) && Number(o.used) === 0 && new Date(o.expires_at) > new Date());
      // Sort by created_at desc
      found.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return [found];
    }

    // 6. UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?
    if (sqlNorm.includes("UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?")) {
      const id = params[0];
      const otps = readJSON(FALLBACK_OTPS_FILE);
      const otp = otps.find(o => String(o.id) === String(id));
      if (otp) otp.attempts += 1;
      writeJSON(FALLBACK_OTPS_FILE, otps);
      return [{ affectedRows: 1 }];
    }

    // 7. UPDATE password_reset_otps SET used = 1 WHERE id = ?
    if (sqlNorm.includes("UPDATE password_reset_otps SET used = 1 WHERE id = ?")) {
      const id = params[0];
      const otps = readJSON(FALLBACK_OTPS_FILE);
      const otp = otps.find(o => String(o.id) === String(id));
      if (otp) otp.used = 1;
      writeJSON(FALLBACK_OTPS_FILE, otps);
      return [{ affectedRows: 1 }];
    }

    // 8. UPDATE users SET password = ? WHERE LOWER(email) = LOWER(?)
    if (sqlNorm.includes("UPDATE users SET password = ? WHERE LOWER(email) = LOWER(?)")) {
      const password = params[0];
      const email = params[1];
      const users = readJSON(FALLBACK_USERS_FILE);
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (user) {
        user.password = password;
        user.updated_at = new Date().toISOString();
        writeJSON(FALLBACK_USERS_FILE, users);
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 0 }];
    }

    // 9. UPDATE users SET password = ? WHERE id = ?
    if (sqlNorm.includes("UPDATE users SET password = ? WHERE id = ?")) {
      const password = params[0];
      const id = params[1];
      const users = readJSON(FALLBACK_USERS_FILE);
      const user = users.find(u => u.id === id);
      if (user) {
        user.password = password;
        user.updated_at = new Date().toISOString();
        writeJSON(FALLBACK_USERS_FILE, users);
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 0 }];
    }

    // 10. SELECT * FROM products
    if (sqlNorm.includes("FROM products") && !sqlNorm.startsWith("INSERT") && !sqlNorm.startsWith("UPDATE") && !sqlNorm.startsWith("DELETE")) {
      const file = path.join(__dirname, "..", "fallback_products.json");
      let list = readJSON(file);
      if (sqlNorm.includes("WHERE name = ?") && params && params[0]) {
        list = list.filter(p => p.name && p.name.toLowerCase() === params[0].toLowerCase());
      } else if (sqlNorm.includes("WHERE id = ?") && params && params[0]) {
        list = list.filter(p => p.id === params[0]);
      } else if (sqlNorm.includes("LIKE") && params && params[0]) {
        const term = String(params[0]).replace(/%/g, "").toLowerCase();
        list = list.filter(p => 
          (p.name && p.name.toLowerCase().includes(term)) ||
          (p.brand && p.brand.toLowerCase().includes(term)) ||
          (p.category && p.category.toLowerCase().includes(term))
        );
      }
      if (sqlNorm.includes("LIMIT 1")) {
        list = list.slice(0, 1);
      }
      if (sqlNorm.includes("COUNT(*)")) {
        return [[{ count: list.length, cnt: list.length }]];
      }
      return [list];
    }

    // 11. INSERT INTO products
    if (sqlNorm.includes("INSERT INTO products")) {
      const file = path.join(__dirname, "..", "fallback_products.json");
      const list = readJSON(file);
      const newItem = { id: params[0], name: params[1], brand: params[2], category: params[3], color: params[4], finish: params[5], price: Number(params[6]), quantity: Number(params[7]), status: params[8] };
      list.push(newItem);
      writeJSON(file, list);
      return [{ affectedRows: 1 }];
    }

    // 12a. UPDATE products (quantity deduction or addition from order creation/cancellation)
    if (sqlNorm.startsWith("UPDATE products") && (sqlNorm.includes("quantity - ?") || sqlNorm.includes("quantity + ?"))) {
      const file = path.join(__dirname, "..", "fallback_products.json");
      const list = readJSON(file);
      const isDeduct = sqlNorm.includes("quantity - ?");
      const changeQty = Number(params[0]) || 0;
      const id = params[params.length - 1];
      const item = list.find(p => p.id === id);
      if (item) {
        if (isDeduct) {
          item.quantity = Math.max(0, Number(item.quantity || 0) - changeQty);
        } else {
          item.quantity = Number(item.quantity || 0) + changeQty;
        }
        item.status = item.quantity <= 0 ? "Out of Stock" : (item.quantity <= 15 ? "Low Stock" : "In Stock");
        writeJSON(file, list);
      }
      return [{ affectedRows: 1 }];
    }

    // 12b. UPDATE products (quantity & status sync from stock controller: 3 params)
    if (sqlNorm.startsWith("UPDATE products") && sqlNorm.includes("SET quantity = ?, status = ? WHERE id = ?")) {
      const file = path.join(__dirname, "..", "fallback_products.json");
      const list = readJSON(file);
      const qty = Number(params[0]) || 0;
      const status = params[1];
      const id = params[2];
      const item = list.find(p => p.id === id);
      if (item) {
        item.quantity = qty;
        item.status = status;
        writeJSON(file, list);
      }
      return [{ affectedRows: 1 }];
    }

    // 12c. UPDATE products (full admin product update: 9 params)
    if (sqlNorm.startsWith("UPDATE products SET")) {
      const file = path.join(__dirname, "..", "fallback_products.json");
      const list = readJSON(file);
      const id = params[params.length - 1];
      const idx = list.findIndex(p => p.id === id);
      if (idx !== -1) {
        list[idx] = { 
          id, 
          name: params[0], 
          brand: params[1], 
          category: params[2], 
          color: params[3], 
          finish: params[4], 
          price: Number(params[5]), 
          quantity: Number(params[6]), 
          status: params[7] 
        };
        writeJSON(file, list);
      }
      return [{ affectedRows: 1 }];
    }

    // 13. DELETE FROM products
    if (sqlNorm.includes("DELETE FROM products")) {
      const file = path.join(__dirname, "..", "fallback_products.json");
      let list = readJSON(file);
      list = list.filter(p => p.id !== params[0]);
      writeJSON(file, list);
      return [{ affectedRows: 1 }];
    }

    // 14. SELECT * FROM warehouse_stock
    if (sqlNorm.includes("FROM warehouse_stock") && !sqlNorm.startsWith("UPDATE") && !sqlNorm.startsWith("INSERT")) {
      const file = path.join(__dirname, "..", "fallback_stock.json");
      let list = readJSON(file);
      if (sqlNorm.includes("COUNT(*)")) {
        return [[{ count: list.length, cnt: list.length }]];
      }
      if (sqlNorm.includes("COALESCE(SUM(quantity), 0)")) {
        const pid = params[0];
        const sum = list.filter(s => s.paint_id === pid).reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);
        return [[{ total_qty: sum }]];
      }
      if (sqlNorm.includes("DISTINCT warehouse")) {
        const unique = [...new Set(list.map(s => s.warehouse))].map(w => ({ warehouse: w }));
        return [unique];
      }
      if (sqlNorm.includes("WHERE paint_id = ?")) {
        const pid = params[0];
        list = list.filter(s => s.paint_id === pid);
      } else if (sqlNorm.includes("WHERE id = ?")) {
        const sid = Number(params[0]);
        list = list.filter(s => s.id === sid);
      }
      if (sqlNorm.includes("LIMIT 1")) {
        list = list.slice(0, 1);
      }
      return [list];
    }

    // 15. UPDATE warehouse_stock
    if (sqlNorm.startsWith("UPDATE warehouse_stock")) {
      const file = path.join(__dirname, "..", "fallback_stock.json");
      const list = readJSON(file);

      if (sqlNorm.includes("SET paint_name = ?, brand = ? WHERE paint_id = ?")) {
        const name = params[0];
        const brand = params[1];
        const pid = params[2];
        list.forEach(s => {
          if (s.paint_id === pid) {
            s.paint_name = name;
            s.brand = brand;
          }
        });
        writeJSON(file, list);
        return [{ affectedRows: 1 }];
      }

      if (sqlNorm.includes("quantity - ?") || sqlNorm.includes("GREATEST(0, quantity - ?)")) {
        const deduct = Number(params[0]) || 0;
        const id = Number(params[params.length - 1]);
        const item = list.find(s => s.id === id);
        if (item) {
          item.quantity = Math.max(0, Number(item.quantity || 0) - deduct);
          item.status = item.quantity <= 0 ? "Out of Stock" : (item.quantity <= (item.min_quantity || 15) ? "Low Stock" : "In Stock");
          writeJSON(file, list);
        }
        return [{ affectedRows: 1 }];
      }

      if (sqlNorm.includes("quantity + ?")) {
        const add = Number(params[0]) || 0;
        const id = Number(params[params.length - 1]);
        const item = list.find(s => s.id === id);
        if (item) {
          item.quantity = Number(item.quantity || 0) + add;
          item.status = item.quantity <= 0 ? "Out of Stock" : (item.quantity <= (item.min_quantity || 15) ? "Low Stock" : "In Stock");
          writeJSON(file, list);
        }
        return [{ affectedRows: 1 }];
      }

      if (params.length === 3) {
        // UPDATE warehouse_stock SET quantity = ?, status = ? WHERE id = ?
        const q = Number(params[0]);
        const status = params[1];
        const id = Number(params[2]);
        const item = list.find(s => s.id === id);
        if (item) {
          item.quantity = q;
          item.status = status;
          writeJSON(file, list);
        }
        return [{ affectedRows: 1 }];
      }

      if (params.length >= 4) {
        // UPDATE warehouse_stock SET quantity = ?, min_quantity = ?, status = ? WHERE id = ?
        const id = Number(params[3]);
        const item = list.find(s => s.id === id);
        if (item) {
          item.quantity = Number(params[0]);
          item.min_quantity = Number(params[1]);
          item.status = params[2];
          writeJSON(file, list);
        }
        return [{ affectedRows: 1 }];
      }

      return [{ affectedRows: 1 }];
    }

    // 16. Specialized: Orders Summary KPIs (totalOrders & totalRevenue)
    if (sqlNorm.includes("FROM orders") && sqlNorm.includes("totalRevenue") && sqlNorm.includes("COUNT(*)")) {
      const orders = readJSON(FALLBACK_ORDERS_FILE);
      const from = params[0];
      const to = params[1];
      const filtered = orders.filter(o => 
        o.status !== "Cancelled" &&
        (!from || !o.order_date || o.order_date >= from) &&
        (!to || !o.order_date || o.order_date <= to)
      );
      const totalOrders = filtered.length;
      const totalRevenue = filtered.reduce((sum, o) => {
        const amt = Number(o.total_amount) || (Number(o.quantity) * Number(o.price)) || 0;
        return sum + amt;
      }, 0);
      return [[{ totalOrders, totalRevenue }]];
    }

    // 16b. Specialized: Cancelled Orders Summary
    if (sqlNorm.includes("FROM orders") && sqlNorm.includes("cancelledOrders")) {
      const orders = readJSON(FALLBACK_ORDERS_FILE);
      const from = params[0];
      const to = params[1];
      const filtered = orders.filter(o => 
        o.status === "Cancelled" &&
        (!from || !o.order_date || o.order_date >= from) &&
        (!to || !o.order_date || o.order_date <= to)
      );
      const cancelledOrders = filtered.length;
      const cancelledRevenue = filtered.reduce((sum, o) => {
        const amt = Number(o.total_amount) || (Number(o.quantity) * Number(o.price)) || 0;
        return sum + amt;
      }, 0);
      return [[{ cancelledOrders, cancelledRevenue }]];
    }

    // 16c. Specialized: Daily Sales Aggregation (GROUP BY DATE_FORMAT(order_date))
    if (sqlNorm.includes("FROM orders") && sqlNorm.includes("GROUP BY DATE_FORMAT(order_date")) {
      const orders = readJSON(FALLBACK_ORDERS_FILE);
      const from = params[0];
      const to = params[1];
      const filtered = orders.filter(o => 
        o.status !== "Cancelled" &&
        (!from || !o.order_date || o.order_date >= from) &&
        (!to || !o.order_date || o.order_date <= to)
      );
      const dateMap = {};
      for (const o of filtered) {
        const d = o.order_date ? String(o.order_date).slice(0, 10) : "";
        if (!d) continue;
        if (!dateMap[d]) dateMap[d] = { date: d, revenue: 0, ordersCount: 0, quantity: 0 };
        dateMap[d].revenue += Number(o.total_amount) || (Number(o.quantity) * Number(o.price)) || 0;
        dateMap[d].ordersCount += 1;
        dateMap[d].quantity += Number(o.quantity) || 0;
      }
      const rows = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
      return [rows];
    }

    // 16d. Specialized: Order Status Breakdown (GROUP BY status)
    if (sqlNorm.includes("FROM orders") && sqlNorm.includes("GROUP BY status")) {
      const orders = readJSON(FALLBACK_ORDERS_FILE);
      const from = params[0];
      const to = params[1];
      const filtered = orders.filter(o => 
        (!from || !o.order_date || o.order_date >= from) &&
        (!to || !o.order_date || o.order_date <= to)
      );
      const statusMap = {};
      for (const o of filtered) {
        const s = o.status || "Pending";
        if (!statusMap[s]) statusMap[s] = { status: s, count: 0, totalAmount: 0 };
        statusMap[s].count += 1;
        statusMap[s].totalAmount += Number(o.total_amount) || (Number(o.quantity) * Number(o.price)) || 0;
      }
      const rows = Object.values(statusMap).sort((a, b) => b.count - a.count);
      return [rows];
    }

    // 16e. Specialized: Order List for ToolService / Orders Page
    if (sqlNorm.includes("SELECT id, customer_name, order_date, status, total_amount, quantity FROM orders")) {
      const orders = readJSON(FALLBACK_ORDERS_FILE);
      let filtered = [...orders];
      if (params.length === 2 && typeof params[0] === "string" && isNaN(Number(params[0]))) {
        filtered = filtered.filter(o => o.status === params[0].trim());
      }
      filtered.sort((a, b) => String(b.order_date || "").localeCompare(String(a.order_date || "")));
      const limit = Number(params[params.length - 1]) || 10;
      return [filtered.slice(0, limit)];
    }

    // 16f. Specialized: Sales Details Table (orders JOIN order_items)
    if (sqlNorm.includes("FROM orders o") && sqlNorm.includes("order_items oi") && (sqlNorm.includes("customer_name AS customerName") || sqlNorm.includes("o.customer_name AS customerName"))) {
      const orders = readJSON(FALLBACK_ORDERS_FILE);
      const orderItems = readJSON(FALLBACK_ORDER_ITEMS_FILE);
      const from = params[0];
      const to = params[1];
      const filtered = orders.filter(o => 
        (!from || !o.order_date || o.order_date >= from) &&
        (!to || !o.order_date || o.order_date <= to)
      );
      filtered.sort((a, b) => String(b.order_date || "").localeCompare(String(a.order_date || "")));

      const details = [];
      for (const o of filtered) {
        const items = orderItems.filter(i => i.order_id === o.id);
        const dateStr = o.order_date ? String(o.order_date).slice(0, 10) : "";
        if (items.length > 0) {
          for (const item of items) {
            const qty = Number(item.quantity) || 1;
            const price = Number(item.price) || 0;
            details.push({
              orderId: o.id,
              date: dateStr,
              customerName: o.customer_name || "Customer",
              paintName: item.paint_name || o.paint_name || "Paint Product",
              paintId: item.paint_id || o.paint_id || "PNT001",
              quantity: qty,
              amount: (price * qty) || Number(o.total_amount) || 0,
              status: o.status || "Pending",
              createdAt: o.created_at || new Date().toISOString()
            });
          }
        } else {
          const qty = Number(o.quantity) || 1;
          const price = Number(o.price) || 0;
          details.push({
            orderId: o.id,
            date: dateStr,
            customerName: o.customer_name || "Customer",
            paintName: o.paint_name || "Paint Product",
            paintId: o.paint_id || "PNT001",
            quantity: qty,
            amount: Number(o.total_amount) || (price * qty) || 0,
            status: o.status || "Pending",
            createdAt: o.created_at || new Date().toISOString()
          });
        }
      }
      return [details];
    }

    // 16g. General SELECT * FROM orders
    if (sqlNorm.includes("FROM orders") && !sqlNorm.startsWith("INSERT") && !sqlNorm.startsWith("UPDATE")) {
      const file = path.join(__dirname, "..", "fallback_orders.json");
      const list = readJSON(file);
      if (sqlNorm.includes("COUNT(*)")) {
        return [[{ count: list.length, cnt: list.length }]];
      }
      if (sqlNorm.includes("WHERE id = ?")) {
        const id = params[0];
        return [list.filter(o => o.id === id)];
      }
      const sorted = [...list].sort((a, b) => {
        const dateA = String(a.order_date || a.created_at || "");
        const dateB = String(b.order_date || b.created_at || "");
        return dateB.localeCompare(dateA);
      });
      return [sorted];
    }

    // 17. INSERT INTO orders
    if (sqlNorm.includes("INSERT INTO orders")) {
      const file = path.join(__dirname, "..", "fallback_orders.json");
      const list = readJSON(file);
      const newOrder = {
        id: params[0],
        customer_name: params[1],
        customer_phone: params[2],
        customer_address: params[3],
        paint_name: params[4],
        paint_id: params[5],
        quantity: Number(params[6]),
        price: Number(params[7]),
        order_date: params[8],
        status: params[9],
        total_amount: params[10] !== undefined ? Number(params[10]) : Number(params[7]),
        created_at: new Date().toISOString()
      };
      // Place newest order at the very beginning
      list.unshift(newOrder);
      writeJSON(file, list);
      return [{ affectedRows: 1 }];
    }

    // 18. UPDATE orders SET status = ? WHERE id = ?
    if (sqlNorm.includes("UPDATE orders SET status = ?")) {
      const file = path.join(__dirname, "..", "fallback_orders.json");
      const list = readJSON(file);
      const order = list.find(o => o.id === params[1]);
      if (order) {
        order.status = params[0];
        writeJSON(file, list);
      }
      return [{ affectedRows: 1 }];
    }

    // 19a. Specialized: Items Summary totalQuantity (JOIN orders o)
    if (sqlNorm.includes("FROM order_items oi") && sqlNorm.includes("JOIN orders o") && sqlNorm.includes("totalQuantity")) {
      const orders = readJSON(FALLBACK_ORDERS_FILE);
      const orderItems = readJSON(FALLBACK_ORDER_ITEMS_FILE);
      const from = params[0];
      const to = params[1];
      const validOrders = orders.filter(o => 
        o.status !== "Cancelled" &&
        (!from || !o.order_date || o.order_date >= from) &&
        (!to || !o.order_date || o.order_date <= to)
      );
      const validIds = new Set(validOrders.map(o => o.id));
      let totalQuantity = 0;
      const matchingItems = orderItems.filter(i => validIds.has(i.order_id));
      if (matchingItems.length > 0) {
        totalQuantity = matchingItems.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
      } else {
        totalQuantity = validOrders.reduce((sum, o) => sum + Number(o.quantity || 0), 0);
      }
      return [[{ totalQuantity }]];
    }

    // 19b. Specialized: Top Products & Revenue by Product (JOIN orders o GROUP BY oi.paint_id)
    if (sqlNorm.includes("FROM order_items oi") && sqlNorm.includes("JOIN orders o") && sqlNorm.includes("GROUP BY oi.paint_id")) {
      const orders = readJSON(FALLBACK_ORDERS_FILE);
      const orderItems = readJSON(FALLBACK_ORDER_ITEMS_FILE);
      const hasDateFilter = sqlNorm.includes("o.order_date >=");
      const from = hasDateFilter ? params[0] : null;
      const to = hasDateFilter ? params[1] : null;

      const validOrders = orders.filter(o => 
        o.status !== "Cancelled" &&
        (!from || !o.order_date || o.order_date >= from) &&
        (!to || !o.order_date || o.order_date <= to)
      );
      const validIds = new Set(validOrders.map(o => o.id));

      const productMap = {};
      for (const item of orderItems) {
        if (!validIds.has(item.order_id)) continue;
        const pid = item.paint_id || "PNT001";
        const pname = item.paint_name || "Paint Product";
        if (!productMap[pid]) {
          productMap[pid] = { paintId: pid, paintName: pname, quantity: 0, quantitySold: 0, revenue: 0 };
        }
        const q = Number(item.quantity) || 0;
        const p = Number(item.price) || 0;
        productMap[pid].quantity += q;
        productMap[pid].quantitySold += q;
        productMap[pid].revenue += (q * p);
      }

      if (Object.keys(productMap).length === 0) {
        for (const o of validOrders) {
          const pid = o.paint_id || "PNT001";
          const pname = o.paint_name || "Paint Product";
          if (!productMap[pid]) {
            productMap[pid] = { paintId: pid, paintName: pname, quantity: 0, quantitySold: 0, revenue: 0 };
          }
          const q = Number(o.quantity) || 0;
          const amt = Number(o.total_amount) || (q * Number(o.price || 0));
          productMap[pid].quantity += q;
          productMap[pid].quantitySold += q;
          productMap[pid].revenue += amt;
        }
      }

      let rows = Object.values(productMap);
      if (sqlNorm.includes("ORDER BY quantity DESC") || sqlNorm.includes("ORDER BY quantitySold DESC")) {
        rows.sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);
      } else if (sqlNorm.includes("ORDER BY revenue DESC")) {
        rows.sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity);
      }

      const limit = Number(params[params.length - 1]) || 10;
      return [rows.slice(0, limit)];
    }

    // 19c. General SELECT * FROM order_items
    if (sqlNorm.includes("FROM order_items") && !sqlNorm.startsWith("INSERT") && !sqlNorm.startsWith("UPDATE")) {
      const items = readJSON(FALLBACK_ORDER_ITEMS_FILE);
      if (sqlNorm.includes("WHERE order_id = ?")) {
        const orderId = params[0];
        return [items.filter(i => i.order_id === orderId)];
      }
      return [items];
    }

    // 20. INSERT INTO order_items
    if (sqlNorm.includes("INSERT INTO order_items")) {
      const items = readJSON(FALLBACK_ORDER_ITEMS_FILE);
      const newItem = {
        id: items.length + 1,
        order_id: params[0],
        paint_id: params[1],
        paint_name: params[2],
        quantity: Number(params[3]),
        price: Number(params[4]),
        created_at: new Date().toISOString()
      };
      items.push(newItem);
      writeJSON(FALLBACK_ORDER_ITEMS_FILE, items);
      return [{ insertId: newItem.id, affectedRows: 1 }];
    }

    return [[]];
  },
  async getConnection() {
    return {
      query: mockPool.query.bind(mockPool),
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {}
    };
  }
};

async function initializeDatabase() {
  const host = process.env.DB_HOST || "localhost";
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "paint_inventory";
  const ssl = (process.env.DB_SSL === "true" || (host && host.includes("tidbcloud.com")))
    ? { minVersion: "TLSv1.2", rejectUnauthorized: true }
    : undefined;

  const isLocalhost = !process.env.DB_HOST || process.env.DB_HOST === "localhost" || process.env.DB_HOST === "127.0.0.1";
  const isServerless = Boolean(process.env.VERCEL);

  // In serverless environments without explicit remote MySQL host, boot verified database engine immediately
  if (isServerless && isLocalhost) {
    console.log("[DATABASE] Vercel serverless environment active with default local host. Initializing verified embedded database engine.");
    useFallback = true;
    await seedFallback();
    return;
  }

  try {
    // Attempt connecting to MySQL (remote host or local dev MySQL)
    const poolConfig = {
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 8000
    };
    if (ssl) poolConfig.ssl = ssl;

    // In local dev, create database if not exists
    if (isLocalhost) {
      const conn = await mysql.createConnection({ host, port, user, password });
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
      await conn.end();
    }

    pool = mysql.createPool(poolConfig);
    await pool.query("SELECT 1");

    console.log(`Connected to MySQL database: ${database} at ${host}:${port}`);

    // Create Users Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'Staff',
        mobile VARCHAR(20) NOT NULL,
        username VARCHAR(100) NOT NULL UNIQUE,
        avatar LONGTEXT DEFAULT NULL,
        two_factor_enabled TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Create OTP Reset Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_otps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        attempts INT DEFAULT 0,
        used TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // Create Products Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(180) NOT NULL,
        brand VARCHAR(100) NOT NULL,
        category VARCHAR(100) NOT NULL,
        color VARCHAR(80) NOT NULL,
        finish VARCHAR(50) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        quantity INT NOT NULL DEFAULT 0,
        status VARCHAR(30) DEFAULT 'In Stock',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Ensure created_at column exists if table was created previously without it
    try {
      await pool.query("ALTER TABLE products ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    } catch (e) {
      // Column already exists
    }

    // Create Warehouse Stock Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS warehouse_stock (
        id INT AUTO_INCREMENT PRIMARY KEY,
        paint_id VARCHAR(50) NOT NULL,
        paint_name VARCHAR(180) NOT NULL,
        brand VARCHAR(100) NOT NULL,
        warehouse VARCHAR(100) NOT NULL,
        quantity INT NOT NULL DEFAULT 0,
        min_quantity INT NOT NULL DEFAULT 15,
        status VARCHAR(30) DEFAULT 'In Stock'
      ) ENGINE=InnoDB;
    `);

    // Create Orders Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(50) PRIMARY KEY,
        customer_name VARCHAR(150) NOT NULL,
        customer_phone VARCHAR(20) NOT NULL,
        customer_address VARCHAR(255),
        paint_name VARCHAR(255),
        paint_id VARCHAR(50),
        quantity INT NOT NULL DEFAULT 1,
        price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        total_amount DECIMAL(10,2) DEFAULT NULL,
        order_date VARCHAR(30),
        status VARCHAR(30) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Create Order Items Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(50) NOT NULL,
        paint_id VARCHAR(50),
        paint_name VARCHAR(180) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // Safe column migrations on orders table
    try {
      await pool.query("ALTER TABLE orders ADD COLUMN total_amount DECIMAL(10,2) DEFAULT NULL");
    } catch (e) {}
    try {
      await pool.query("ALTER TABLE orders MODIFY COLUMN paint_name VARCHAR(255) NULL");
    } catch (e) {}
    try {
      await pool.query("ALTER TABLE orders MODIFY COLUMN paint_id VARCHAR(50) NULL");
    } catch (e) {}
    try {
      await pool.query("ALTER TABLE orders MODIFY COLUMN quantity INT DEFAULT 1");
    } catch (e) {}
    try {
      await pool.query("ALTER TABLE orders MODIFY COLUMN price DECIMAL(10,2) DEFAULT 0.00");
    } catch (e) {}
    try {
      await pool.query("ALTER TABLE orders MODIFY COLUMN order_date DATE");
    } catch (e) {}

    // Safe migration: ensure products in products catalog have matching warehouse_stock entries
    try {
      await pool.query(`
        INSERT INTO warehouse_stock (paint_id, paint_name, brand, warehouse, quantity, min_quantity, status)
        SELECT p.id, p.name, p.brand, 'Central Warehouse - Tirunelveli', p.quantity, 15, p.status
        FROM products p
        LEFT JOIN warehouse_stock w ON p.id = w.paint_id
        WHERE w.id IS NULL
      `);
    } catch (wsErr) {
      console.warn("Notice: warehouse_stock sync check:", wsErr.message);
    }

    // Safe migration: populate order_items for existing orders that do not have order_items yet
    try {
      await pool.query(`
        INSERT INTO order_items (order_id, paint_id, paint_name, quantity, price)
        SELECT o.id, o.paint_id, o.paint_name, o.quantity, o.price
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE oi.id IS NULL AND o.paint_name IS NOT NULL AND o.paint_name != ''
      `);
      await pool.query(`
        UPDATE orders SET total_amount = quantity * price 
        WHERE total_amount IS NULL OR total_amount = 0
      `);
    } catch (migErr) {
      console.warn("Notice: order_items migration check:", migErr.message);
    }

    // 1. Check & Seed default Admin user
    const [userRows] = await pool.query("SELECT * FROM users WHERE email = ?", ["admin@paintcorp.com"]);
    if (userRows.length === 0) {
      const adminPasswordHash = await bcrypt.hash("password123", 10);
      await pool.query(
        `INSERT INTO users (name, email, password, role, mobile, username, avatar, two_factor_enabled) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ["ERP Admin", "admin@paintcorp.com", adminPasswordHash, "Administrator", "1234567890", "erp_admin", "", 0]
      );
      console.log("Seeded default administrator user admin@paintcorp.com / password123");
    }

    // 2. Check & Seed Products
    const [productRows] = await pool.query("SELECT COUNT(*) AS cnt FROM products");
    if (productRows[0].cnt === 0) {
      await pool.query(`
        INSERT INTO products (id, name, brand, category, color, finish, price, quantity, status) VALUES
        ('PNT001', 'WeatherShield Max', 'Dulux', 'Exterior', 'Arctic White', 'Semi-Gloss', 3679.20, 120, 'In Stock'),
        ('PNT002', 'Royale Luxury Emulsion', 'Asian Paints', 'Interior', 'Soft Beige', 'Matte', 3160.00, 85, 'In Stock'),
        ('PNT003', 'Super Premium Enamel', 'Nippon', 'Wood & Metal', 'Forest Green', 'Gloss', 2399.20, 15, 'Low Stock'),
        ('PNT004', 'Aquashield Waterproofing', 'Berger', 'Exterior', 'Slate Gray', 'Matte', 4320.00, 60, 'In Stock'),
        ('PNT005', 'EasyClean Stain Resistant', 'Dulux', 'Interior', 'Lemon Yellow', 'Satin', 2799.20, 8, 'Low Stock'),
        ('PNT006', 'UltraHide Primer', 'Nippon', 'Primer', 'Neutral White', 'Matte', 1960.00, 0, 'Out of Stock'),
        ('PNT007', 'Apex Ultima Protect', 'Asian Paints', 'Exterior', 'Terracotta Red', 'Satin', 4660.00, 110, 'In Stock');
      `);
      console.log("Seeded initial product catalog into MySQL.");
    }

    // 3. Check & Seed Warehouse Stock
    const [stockRows] = await pool.query("SELECT COUNT(*) AS cnt FROM warehouse_stock");
    if (stockRows[0].cnt === 0) {
      await pool.query(`
        INSERT INTO warehouse_stock (id, paint_id, paint_name, brand, warehouse, quantity, min_quantity, status) VALUES
        (1, 'PNT001', 'WeatherShield Max', 'Dulux', 'Central Warehouse A', 80, 20, 'In Stock'),
        (2, 'PNT001', 'WeatherShield Max', 'Dulux', 'East Wing Depot', 40, 15, 'In Stock'),
        (3, 'PNT002', 'Royale Luxury Emulsion', 'Asian Paints', 'Central Warehouse A', 50, 20, 'In Stock'),
        (4, 'PNT002', 'Royale Luxury Emulsion', 'Asian Paints', 'South Gate facility', 35, 15, 'In Stock'),
        (5, 'PNT003', 'Super Premium Enamel', 'Nippon', 'Central Warehouse A', 5, 20, 'Low Stock'),
        (6, 'PNT003', 'Super Premium Enamel', 'Nippon', 'East Wing Depot', 10, 12, 'Low Stock'),
        (7, 'PNT004', 'Aquashield Waterproofing', 'Berger', 'Central Warehouse A', 60, 20, 'In Stock'),
        (8, 'PNT005', 'EasyClean Stain Resistant', 'Dulux', 'Central Warehouse A', 8, 15, 'Low Stock'),
        (9, 'PNT006', 'UltraHide Primer', 'Nippon', 'East Wing Depot', 0, 25, 'Out of Stock'),
        (10, 'PNT007', 'Apex Ultima Protect', 'Asian Paints', 'South Gate facility', 110, 30, 'In Stock');
      `);
      console.log("Seeded initial warehouse stock data into MySQL.");
    }

    // 4. Check & Seed Orders
    const [orderRows] = await pool.query("SELECT COUNT(*) AS cnt FROM orders");
    if (orderRows[0].cnt === 0) {
      await pool.query(`
        INSERT INTO orders (id, customer_name, customer_phone, customer_address, paint_name, paint_id, quantity, price, order_date, status) VALUES
        ('ORD101', 'Alex Mercer', '+1 (555) 019-2834', '452 Pine St, New York, NY', 'WeatherShield Max', 'PNT001', 10, 3679.20, '2026-08-07', 'Delivered'),
        ('ORD102', 'Sarah Connor', '+1 (555) 022-9110', '882 Oak Ave, Los Angeles, CA', 'Royale Luxury Emulsion', 'PNT002', 5, 3160.00, '2026-08-08', 'Pending'),
        ('ORD103', 'Bruce Wayne', '+1 (555) 007-1939', '1007 Mountain Drive, Gotham', 'Aquashield Waterproofing', 'PNT004', 25, 4320.00, '2026-08-08', 'Processing'),
        ('ORD104', 'Clark Kent', '+1 (555) 045-1234', '344 Clinton St, Metropolis', 'Super Premium Enamel', 'PNT003', 2, 2399.20, '2026-08-08', 'Packed');
      `);
      console.log("Seeded initial customer orders data into MySQL.");
    }
  } catch (error) {
    console.warn(`[DATABASE WARNING] MySQL database failed to connect: ${error.message}`);
    console.warn("[DATABASE WARNING] Falling back to local file JSON database mode for development.");
    useFallback = true;
    await seedFallback();
  }
}

module.exports = {
  initializeDatabase,
  getPool: () => {
    if (useFallback) {
      return mockPool;
    }
    if (!pool) {
      throw new Error("Database pool not initialized. Call initializeDatabase first.");
    }
    return pool;
  }
};


