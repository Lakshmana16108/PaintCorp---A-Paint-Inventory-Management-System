const { initializeDatabase, getPool } = require("./config/database");
require("dotenv").config();

async function testConnection() {
  console.log("=========================================");
  console.log(" PaintCorp ERP - MySQL Diagnostic Check ");
  console.log("=========================================");
  console.log(` Target Host     : ${process.env.DB_HOST || "localhost"}`);
  console.log(` Target Port     : ${process.env.DB_PORT || 3306}`);
  console.log(` Target User     : ${process.env.DB_USER || "root"}`);
  console.log(` Database Name   : ${process.env.DB_NAME || "paint_inventory"}`);
  console.log("-----------------------------------------");

  try {
    console.log("[1/3] Initializing database pool...");
    await initializeDatabase();

    const pool = getPool();

    console.log("[2/3] Querying database tables...");
    const [users] = await pool.query("SELECT COUNT(*) AS count FROM users");
    const [products] = await pool.query("SELECT COUNT(*) AS count FROM products");
    const [stock] = await pool.query("SELECT COUNT(*) AS count FROM warehouse_stock");
    const [orders] = await pool.query("SELECT COUNT(*) AS count FROM orders");

    console.log("[3/3] Database Table Summary:");
    console.log(`  - Registered Users   : ${users[0].count}`);
    console.log(`  - Products Catalog   : ${products[0].count}`);
    console.log(`  - Warehouse Stock    : ${stock[0].count}`);
    console.log(`  - Customer Orders    : ${orders[0].count}`);

    console.log("-----------------------------------------");
    console.log(" RESULT: SUCCESS! MySQL connection established.");
    console.log("=========================================");
    process.exit(0);
  } catch (error) {
    console.error(" RESULT: FAILURE! Unable to complete MySQL test:", error.message);
    process.exit(1);
  }
}

testConnection();
