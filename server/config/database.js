const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

let pool;
let useFallback = false;

const FALLBACK_USERS_FILE = path.join(__dirname, "..", "fallback_users.json");
const FALLBACK_OTPS_FILE = path.join(__dirname, "..", "fallback_otps.json");

// Helper functions for fallback JSON database
function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
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
}

const mockPool = {
  async query(sql, params = []) {
    const sqlNorm = sql.replace(/\s+/g, " ").trim();

    // 1. SELECT queries targeting users (handles COUNT(*), email lookup, or SELECT *)
    if (sqlNorm.includes("FROM users") && !sqlNorm.includes("INSERT INTO") && !sqlNorm.includes("UPDATE")) {
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
        if (o.user_id === userId) o.used = 1;
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
      const found = otps.filter(o => o.user_id === userId && o.used === 0 && new Date(o.expires_at) > new Date());
      // Sort by created_at desc
      found.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return [found];
    }

    // 6. UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?
    if (sqlNorm.includes("UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?")) {
      const id = params[0];
      const otps = readJSON(FALLBACK_OTPS_FILE);
      const otp = otps.find(o => o.id === id);
      if (otp) otp.attempts += 1;
      writeJSON(FALLBACK_OTPS_FILE, otps);
      return [{ affectedRows: 1 }];
    }

    // 7. UPDATE password_reset_otps SET used = 1 WHERE id = ?
    if (sqlNorm.includes("UPDATE password_reset_otps SET used = 1 WHERE id = ?")) {
      const id = params[0];
      const otps = readJSON(FALLBACK_OTPS_FILE);
      const otp = otps.find(o => o.id === id);
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
    if (sqlNorm.includes("FROM products") && !sqlNorm.includes("INSERT") && !sqlNorm.includes("UPDATE") && !sqlNorm.includes("DELETE")) {
      const file = path.join(__dirname, "..", "fallback_products.json");
      const list = readJSON(file);
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

    // 12. UPDATE products
    if (sqlNorm.includes("UPDATE products SET")) {
      const file = path.join(__dirname, "..", "fallback_products.json");
      const list = readJSON(file);
      const id = params[8];
      const idx = list.findIndex(p => p.id === id);
      if (idx !== -1) {
        list[idx] = { id, name: params[0], brand: params[1], category: params[2], color: params[3], finish: params[4], price: Number(params[5]), quantity: Number(params[6]), status: params[7] };
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
    if (sqlNorm.includes("FROM warehouse_stock") && !sqlNorm.includes("UPDATE")) {
      const file = path.join(__dirname, "..", "fallback_stock.json");
      const list = readJSON(file);
      if (sqlNorm.includes("COUNT(*)")) {
        return [[{ count: list.length, cnt: list.length }]];
      }
      return [list];
    }

    // 15. UPDATE warehouse_stock
    if (sqlNorm.includes("UPDATE warehouse_stock")) {
      const file = path.join(__dirname, "..", "fallback_stock.json");
      const list = readJSON(file);
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

    // 16. SELECT * FROM orders
    if (sqlNorm.includes("FROM orders") && !sqlNorm.includes("INSERT") && !sqlNorm.includes("UPDATE")) {
      const file = path.join(__dirname, "..", "fallback_orders.json");
      const list = readJSON(file);
      if (sqlNorm.includes("COUNT(*)")) {
        return [[{ count: list.length, cnt: list.length }]];
      }
      return [list];
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
        status: params[9]
      };
      list.push(newOrder);
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

    return [[]];
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

  try {
    // First connection to establish database if not exists
    const connectionConfig = { host, port, user, password };
    if (ssl) connectionConfig.ssl = ssl;

    const connection = await mysql.createConnection(connectionConfig);

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    await connection.end();

    // Create the pool with the specific database
    const poolConfig = {
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };
    if (ssl) poolConfig.ssl = ssl;

    pool = mysql.createPool(poolConfig);

    console.log(`Connected to MySQL database: ${database}`);

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
        paint_name VARCHAR(180) NOT NULL,
        paint_id VARCHAR(50),
        quantity INT NOT NULL DEFAULT 1,
        price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        order_date VARCHAR(30),
        status VARCHAR(30) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

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


