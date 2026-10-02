const http = require("http");
const jwt = require("jsonwebtoken");
const { initializeDatabase, getPool } = require("./config/database");
const { app } = require("./server");
require("dotenv").config();

const TEST_PORT = 5055;
const BASE_URL = `http://localhost:${TEST_PORT}`;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = {
      "Content-Type": "application/json"
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      headers["Content-Length"] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: method,
        headers: headers
      },
      (res) => {
        let resData = "";
        res.on("data", (chunk) => (resData += chunk));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(resData);
          } catch (e) {
            parsed = resData;
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTestSuite() {
  console.log("=====================================================");
  console.log(" PaintCorp ERP - Comprehensive Inventory Test Suite ");
  console.log("=====================================================\n");

  await initializeDatabase();
  const pool = getPool();

  const server = app.listen(TEST_PORT, () => {
    console.log(`[TEST SERVER] Running on port ${TEST_PORT} for testing.\n`);
  });

  const adminToken = jwt.sign(
    { id: 1, email: "admin@paintcorp.com", role: "Administrator" },
    process.env.JWT_SECRET || "your_jwt_secret_key_here",
    { expiresIn: "1h" }
  );

  let passedTests = 0;
  let totalTests = 8;

  try {
    // Setup test products in MySQL
    await pool.query("DELETE FROM order_items WHERE order_id LIKE 'TEST_ORD%'");
    await pool.query("DELETE FROM orders WHERE id LIKE 'TEST_ORD%'");
    await pool.query("DELETE FROM warehouse_stock WHERE paint_id IN ('TEST_PNT_A', 'TEST_PNT_B')");
    await pool.query("DELETE FROM products WHERE id IN ('TEST_PNT_A', 'TEST_PNT_B')");

    await pool.query(
      `INSERT INTO products (id, name, brand, category, color, finish, price, quantity, status)
       VALUES 
       ('TEST_PNT_A', 'Test Paint Alpha', 'Dulux', 'Exterior', 'White', 'Matte', 100.00, 100, 'In Stock'),
       ('TEST_PNT_B', 'Test Paint Beta', 'Asian Paints', 'Interior', 'Blue', 'Gloss', 150.00, 50, 'In Stock')`
    );

    await pool.query(
      `INSERT INTO warehouse_stock (paint_id, paint_name, brand, warehouse, quantity, min_quantity, status)
       VALUES 
       ('TEST_PNT_A', 'Test Paint Alpha', 'Dulux', 'Central Warehouse - Tirunelveli', 100, 15, 'In Stock'),
       ('TEST_PNT_B', 'Test Paint Beta', 'Asian Paints', 'Central Warehouse - Tirunelveli', 50, 15, 'In Stock')`
    );

    // -----------------------------------------------------------------
    // TEST 1: Normal Order
    // Initial stock = 100, Order = 20 -> Expected: MySQL stock = 80, Order exists
    // -----------------------------------------------------------------
    console.log("[TEST 1] Normal Order: Initial = 100, Order = 20");
    await pool.query("UPDATE products SET quantity = 100 WHERE id = 'TEST_PNT_A'");
    await pool.query("UPDATE warehouse_stock SET quantity = 100 WHERE paint_id = 'TEST_PNT_A'");

    const order1Res = await request(
      "POST",
      "/api/orders",
      {
        id: "TEST_ORD_001",
        customerName: "Test Buyer 1",
        customerPhone: "+91 99999 11111",
        customerAddress: "Test Address 1",
        items: [{ paintId: "TEST_PNT_A", paintName: "Test Paint Alpha", quantity: 20, price: 100.0 }]
      },
      adminToken
    );

    const [t1Prod] = await pool.query("SELECT quantity FROM products WHERE id = 'TEST_PNT_A'");
    const [t1Order] = await pool.query("SELECT * FROM orders WHERE id = 'TEST_ORD_001'");
    const [t1Items] = await pool.query("SELECT * FROM order_items WHERE order_id = 'TEST_ORD_001'");

    if (
      order1Res.status === 201 &&
      t1Prod[0].quantity === 80 &&
      t1Order.length === 1 &&
      t1Items.length === 1
    ) {
      console.log("  => SUCCESS: MySQL stock is 80, order created with order_items.\n");
      passedTests++;
    } else {
      console.error("  => FAILED: Expected stock 80, got", t1Prod[0]?.quantity, "HTTP status:", order1Res.status);
    }

    // -----------------------------------------------------------------
    // TEST 2: Insufficient Stock
    // Initial stock = 10, Order = 20 -> Expected: Order NOT created, Stock remains 10
    // -----------------------------------------------------------------
    console.log("[TEST 2] Insufficient Stock: Stock = 10, Request = 20");
    await pool.query("UPDATE products SET quantity = 10 WHERE id = 'TEST_PNT_A'");
    await pool.query("UPDATE warehouse_stock SET quantity = 10 WHERE paint_id = 'TEST_PNT_A'");

    const order2Res = await request(
      "POST",
      "/api/orders",
      {
        id: "TEST_ORD_002",
        customerName: "Test Buyer 2",
        customerPhone: "+91 99999 22222",
        items: [{ paintId: "TEST_PNT_A", paintName: "Test Paint Alpha", quantity: 20, price: 100.0 }]
      },
      adminToken
    );

    const [t2Prod] = await pool.query("SELECT quantity FROM products WHERE id = 'TEST_PNT_A'");
    const [t2Order] = await pool.query("SELECT * FROM orders WHERE id = 'TEST_ORD_002'");

    if (order2Res.status === 400 && t2Prod[0].quantity === 10 && t2Order.length === 0) {
      console.log(`  => SUCCESS: HTTP 400 returned ("${order2Res.data.error}"), stock remains 10, no order created.\n`);
      passedTests++;
    } else {
      console.error("  => FAILED:", order2Res.status, "Stock:", t2Prod[0]?.quantity, "Order exists:", t2Order.length);
    }

    // -----------------------------------------------------------------
    // TEST 3: Cancellation
    // Initial stock = 100, Order = 20, After order = 80, Cancel order -> Expected: Stock = 100
    // -----------------------------------------------------------------
    console.log("[TEST 3] Cancellation: Stock 100 -> Order 20 -> Stock 80 -> Cancel -> Stock 100");
    await pool.query("UPDATE products SET quantity = 100 WHERE id = 'TEST_PNT_A'");
    await pool.query("UPDATE warehouse_stock SET quantity = 100 WHERE paint_id = 'TEST_PNT_A'");

    const order3Res = await request(
      "POST",
      "/api/orders",
      {
        id: "TEST_ORD_003",
        customerName: "Test Buyer 3",
        customerPhone: "+91 99999 33333",
        items: [{ paintId: "TEST_PNT_A", paintName: "Test Paint Alpha", quantity: 20, price: 100.0 }]
      },
      adminToken
    );

    const [t3AfterOrder] = await pool.query("SELECT quantity FROM products WHERE id = 'TEST_PNT_A'");
    console.log("  - After order placement: Stock =", t3AfterOrder[0].quantity);

    const cancelRes = await request(
      "PUT",
      "/api/orders/TEST_ORD_003/status",
      { status: "Cancelled" },
      adminToken
    );

    const [t3AfterCancel] = await pool.query("SELECT quantity FROM products WHERE id = 'TEST_PNT_A'");
    const [t3Order] = await pool.query("SELECT status FROM orders WHERE id = 'TEST_ORD_003'");

    if (
      cancelRes.status === 200 &&
      t3AfterCancel[0].quantity === 100 &&
      t3Order[0].status === "Cancelled"
    ) {
      console.log("  => SUCCESS: Order cancelled, MySQL stock restored back to 100.\n");
      passedTests++;
    } else {
      console.error("  => FAILED: Expected stock 100, got", t3AfterCancel[0]?.quantity, "Order status:", t3Order[0]?.status);
    }

    // -----------------------------------------------------------------
    // TEST 4: Double Cancellation Protection
    // Stock = 100, Cancel again -> Stock must remain 100 (NOT become 120)
    // -----------------------------------------------------------------
    console.log("[TEST 4] Double Cancellation: Cancel already cancelled order -> Stock remains 100");
    const doubleCancelRes = await request(
      "PUT",
      "/api/orders/TEST_ORD_003/status",
      { status: "Cancelled" },
      adminToken
    );

    const [t4Prod] = await pool.query("SELECT quantity FROM products WHERE id = 'TEST_PNT_A'");

    if (doubleCancelRes.status === 200 && t4Prod[0].quantity === 100) {
      console.log("  => SUCCESS: Second cancellation request prevented double stock restoration. Stock remains 100.\n");
      passedTests++;
    } else {
      console.error("  => FAILED: Expected stock 100, got", t4Prod[0]?.quantity);
    }

    // -----------------------------------------------------------------
    // TEST 5: Multiple Products Order
    // Paint A = 100, Paint B = 50. Order: A = 20, B = 10 -> Expected: A = 80, B = 40
    // -----------------------------------------------------------------
    console.log("[TEST 5] Multiple Products Order: A = 100, B = 50 -> Order: A: 20, B: 10");
    await pool.query("UPDATE products SET quantity = 100 WHERE id = 'TEST_PNT_A'");
    await pool.query("UPDATE warehouse_stock SET quantity = 100 WHERE paint_id = 'TEST_PNT_A'");
    await pool.query("UPDATE products SET quantity = 50 WHERE id = 'TEST_PNT_B'");
    await pool.query("UPDATE warehouse_stock SET quantity = 50 WHERE paint_id = 'TEST_PNT_B'");

    const multiOrderRes = await request(
      "POST",
      "/api/orders",
      {
        id: "TEST_ORD_005",
        customerName: "Test Multi Buyer",
        customerPhone: "+91 99999 55555",
        items: [
          { paintId: "TEST_PNT_A", paintName: "Test Paint Alpha", quantity: 20, price: 100.0 },
          { paintId: "TEST_PNT_B", paintName: "Test Paint Beta", quantity: 10, price: 150.0 }
        ]
      },
      adminToken
    );

    const [t5ProdA] = await pool.query("SELECT quantity FROM products WHERE id = 'TEST_PNT_A'");
    const [t5ProdB] = await pool.query("SELECT quantity FROM products WHERE id = 'TEST_PNT_B'");

    if (multiOrderRes.status === 201 && t5ProdA[0].quantity === 80 && t5ProdB[0].quantity === 40) {
      console.log("  => SUCCESS: A deducted to 80, B deducted to 40.\n");
      passedTests++;
    } else {
      console.error("  => FAILED: A:", t5ProdA[0]?.quantity, "B:", t5ProdB[0]?.quantity);
    }

    // -----------------------------------------------------------------
    // TEST 6: One Item Insufficient in Multi-Product Order
    // Paint A = 100, Paint B = 5. Order: A = 20, B = 10 -> Expected: Order fails, A remains 100, B remains 5
    // -----------------------------------------------------------------
    console.log("[TEST 6] Multi-product one item insufficient: A = 100, B = 5 -> Request A: 20, B: 10");
    await pool.query("UPDATE products SET quantity = 100 WHERE id = 'TEST_PNT_A'");
    await pool.query("UPDATE warehouse_stock SET quantity = 100 WHERE paint_id = 'TEST_PNT_A'");
    await pool.query("UPDATE products SET quantity = 5 WHERE id = 'TEST_PNT_B'");
    await pool.query("UPDATE warehouse_stock SET quantity = 5 WHERE paint_id = 'TEST_PNT_B'");

    const failOrderRes = await request(
      "POST",
      "/api/orders",
      {
        id: "TEST_ORD_006",
        customerName: "Test Multi Buyer Fail",
        customerPhone: "+91 99999 66666",
        items: [
          { paintId: "TEST_PNT_A", paintName: "Test Paint Alpha", quantity: 20, price: 100.0 },
          { paintId: "TEST_PNT_B", paintName: "Test Paint Beta", quantity: 10, price: 150.0 }
        ]
      },
      adminToken
    );

    const [t6ProdA] = await pool.query("SELECT quantity FROM products WHERE id = 'TEST_PNT_A'");
    const [t6ProdB] = await pool.query("SELECT quantity FROM products WHERE id = 'TEST_PNT_B'");
    const [t6Order] = await pool.query("SELECT * FROM orders WHERE id = 'TEST_ORD_006'");

    if (
      failOrderRes.status === 400 &&
      t6ProdA[0].quantity === 100 &&
      t6ProdB[0].quantity === 5 &&
      t6Order.length === 0
    ) {
      console.log(`  => SUCCESS: Order rejected with 400 ("${failOrderRes.data.error}"). Transaction rolled back: A remained 100, B remained 5.\n`);
      passedTests++;
    } else {
      console.error("  => FAILED: HTTP:", failOrderRes.status, "A:", t6ProdA[0]?.quantity, "B:", t6ProdB[0]?.quantity);
    }

    // -----------------------------------------------------------------
    // TEST 7: Browser Refresh / API Fetching
    // Query GET /api/paints, /api/stock, /api/orders and compare to MySQL
    // -----------------------------------------------------------------
    console.log("[TEST 7] Browser Refresh: Verify GET /api/paints, /api/stock, /api/orders return live MySQL data");
    const paintsApi = await request("GET", "/api/paints");
    const stockApi = await request("GET", "/api/stock");
    const ordersApi = await request("GET", "/api/orders");

    const [paintsDb] = await pool.query("SELECT COUNT(*) AS count FROM products");
    const [stockDb] = await pool.query("SELECT COUNT(*) AS count FROM warehouse_stock");
    const [ordersDb] = await pool.query("SELECT COUNT(*) AS count FROM orders");

    if (
      paintsApi.data.length === paintsDb[0].count &&
      stockApi.data.length === stockDb[0].count &&
      ordersApi.data.length === ordersDb[0].count
    ) {
      console.log(`  => SUCCESS: Live endpoints return exact MySQL counts: Paints=${paintsApi.data.length}, Stock=${stockApi.data.length}, Orders=${ordersApi.data.length}.\n`);
      passedTests++;
    } else {
      console.error("  => FAILED count mismatch:", {
        apiPaints: paintsApi.data.length,
        dbPaints: paintsDb[0].count,
        apiStock: stockApi.data.length,
        dbStock: stockDb[0].count
      });
    }

    // -----------------------------------------------------------------
    // TEST 8: Direct Database Verification
    // Verify warehouse_stock update reflects in products table and vice versa
    // -----------------------------------------------------------------
    console.log("[TEST 8] Direct Database Verification: Update stock in warehouse -> Products table synchronizes");
    const [wsRow] = await pool.query("SELECT id FROM warehouse_stock WHERE paint_id = 'TEST_PNT_A' LIMIT 1");
    const wsUpdateRes = await request(
      "PUT",
      `/api/stock/${wsRow[0].id}`,
      { quantity: 77, minQuantity: 15 },
      adminToken
    );

    const [t8Prod] = await pool.query("SELECT quantity FROM products WHERE id = 'TEST_PNT_A'");
    const [t8Ws] = await pool.query("SELECT quantity FROM warehouse_stock WHERE id = ?", [wsRow[0].id]);

    if (wsUpdateRes.status === 200 && t8Prod[0].quantity === 77 && t8Ws[0].quantity === 77) {
      console.log("  => SUCCESS: Warehouse stock update to 77 correctly updated products table to 77 in MySQL.\n");
      passedTests++;
    } else {
      console.error("  => FAILED: Expected 77, got prod:", t8Prod[0]?.quantity, "ws:", t8Ws[0]?.quantity);
    }

    // Cleanup test artifacts
    await pool.query("DELETE FROM order_items WHERE order_id LIKE 'TEST_ORD%'");
    await pool.query("DELETE FROM orders WHERE id LIKE 'TEST_ORD%'");
    await pool.query("DELETE FROM warehouse_stock WHERE paint_id IN ('TEST_PNT_A', 'TEST_PNT_B')");
    await pool.query("DELETE FROM products WHERE id IN ('TEST_PNT_A', 'TEST_PNT_B')");

    console.log("=====================================================");
    console.log(` Test Results: ${passedTests}/${totalTests} Passed `);
    console.log("=====================================================");

    if (passedTests === totalTests) {
      console.log("\nALL 8 INVENTORY SYNCHRONIZATION TESTS PASSED PERFECTLY!\n");
      server.close(() => {
        process.exit(0);
      });
    } else {
      console.error(`\nFAILED: Only ${passedTests} of ${totalTests} passed.`);
      server.close(() => {
        process.exit(1);
      });
    }
  } catch (error) {
    console.error("Fatal error during test suite:", error);
    server.close(() => {
      process.exit(1);
    });
  }
}

runTestSuite();
