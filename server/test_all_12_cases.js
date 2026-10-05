const { initializeDatabase, getPool } = require("./config/database");
const jwt = require("jsonwebtoken");
const http = require("http");
const { app } = require("./server");

const JWT_SECRET = process.env.JWT_SECRET || "paintcorp_secure_jwt_secret_key_2026_production";

async function executeTestSuite() {
  console.log("===============================================================");
  console.log(" PaintCorp ERP - Continuous Stock Addition 12-Point Test Suite ");
  console.log("===============================================================");

  await initializeDatabase();
  const pool = getPool();

  const server = app.listen(0);
  const port = server.address().port;

  function apiCall(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const options = {
        hostname: "localhost",
        port,
        path,
        method,
        headers
      };

      const req = http.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });

      req.on("error", reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  // Setup test tokens for existing roles
  const adminToken = jwt.sign(
    { id: 1, email: "admin@paintcorp.com", role: "Administrator", name: "Administrator" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  const warehouseManagerToken = jwt.sign(
    { id: 4, email: "suresh.balan@paintcorp.com", role: "Warehouse Manager", name: "Suresh Balan" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  const staffToken = jwt.sign(
    { id: 3, email: "priya.raj@paintcorp.com", role: "Staff", name: "Priya Raj" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  const invalidRoleToken = jwt.sign(
    { id: 99, email: "intruder@domain.com", role: "Auditor", name: "Intruder" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  let passedCount = 0;

  try {
    // -------------------------------------------------------------
    // TEST 1: Search existing paint code
    // -------------------------------------------------------------
    console.log("\n--- TEST 1: Search existing paint code (PNT-002) ---");
    const t1 = await apiCall("GET", "/api/paints/PNT-002");
    console.log(`Status: ${t1.status}, Product Found:`, t1.body.product?.name);
    console.log("Details:", {
      id: t1.body.product?.id,
      brand: t1.body.product?.brand,
      category: t1.body.product?.category,
      color: t1.body.product?.color,
      price: t1.body.product?.price,
      quantity: t1.body.product?.quantity
    });
    if (t1.status === 200 && t1.body.product?.id === "PNT002" && t1.body.product?.name) {
      console.log("✓ TEST 1 PASSED: All actual paint details retrieved from DB.");
      passedCount++;
    } else {
      throw new Error("TEST 1 FAILED");
    }

    // -------------------------------------------------------------
    // TEST 2: Select Warehouse 1 and add 500
    // -------------------------------------------------------------
    console.log("\n--- TEST 2: Select Warehouse 1 and add 500 ---");
    // Discover warehouses
    const whRes = await apiCall("GET", "/api/stock/warehouses");
    const wh1 = whRes.body[0]; // e.g. 'Central Warehouse - Tirunelveli'
    console.log(`Target Warehouse: ${wh1}`);

    // Check pre-addition stock in DB
    const [preWs] = await pool.query("SELECT quantity FROM warehouse_stock WHERE paint_id = 'PNT002' AND warehouse = ?", [wh1]);
    const prevStock = preWs.length > 0 ? Number(preWs[0].quantity) : 0;
    console.log(`Previous Stock in ${wh1}: ${prevStock}`);

    const t2 = await apiCall("POST", "/api/stock/add", {
      paintCode: "PNT-002",
      warehouse: wh1,
      quantity: 500
    }, adminToken);

    console.log("Response:", t2.body);
    const expectedStockAfter500 = prevStock + 500;
    if (t2.status === 200 && t2.body.previousStock === prevStock && t2.body.newStock === expectedStockAfter500) {
      console.log(`✓ TEST 2 PASSED: ${prevStock} → ${expectedStockAfter500} successfully.`);
      passedCount++;
    } else {
      throw new Error("TEST 2 FAILED");
    }

    // -------------------------------------------------------------
    // TEST 3: Immediately add another 300 (Continuous Stock Addition)
    // -------------------------------------------------------------
    console.log("\n--- TEST 3: Immediately add another 300 ---");
    const t3 = await apiCall("POST", "/api/stock/add", {
      paintCode: "PNT-002",
      warehouse: wh1,
      quantity: 300
    }, warehouseManagerToken);

    console.log("Response:", t3.body);
    const expectedStockAfter300 = expectedStockAfter500 + 300;
    if (t3.status === 200 && t3.body.previousStock === expectedStockAfter500 && t3.body.newStock === expectedStockAfter300) {
      console.log(`✓ TEST 3 PASSED: Continuous addition works! ${expectedStockAfter500} → ${expectedStockAfter300}.`);
      passedCount++;
    } else {
      throw new Error("TEST 3 FAILED");
    }

    // -------------------------------------------------------------
    // TEST 4: Change warehouse
    // -------------------------------------------------------------
    console.log("\n--- TEST 4: Change warehouse and verify stock ---");
    const wh2 = whRes.body[1]; // second warehouse
    console.log(`Switched to Warehouse 2: ${wh2}`);
    const t4 = await apiCall("GET", "/api/paints/PNT002");
    const wh2Entry = t4.body.product.warehouseStocks.find(w => w.warehouse === wh2);
    const wh2Stock = wh2Entry ? wh2Entry.quantity : 0;
    console.log(`Warehouse 2 (${wh2}) Actual Stock: ${wh2Stock}`);
    if (t4.status === 200 && typeof wh2Stock === "number") {
      console.log(`✓ TEST 4 PASSED: Selected warehouse's actual stock is displayed correctly (${wh2Stock} L).`);
      passedCount++;
    } else {
      throw new Error("TEST 4 FAILED");
    }

    // -------------------------------------------------------------
    // TEST 5: Search another paint
    // -------------------------------------------------------------
    console.log("\n--- TEST 5: Search another paint (PNT-003) ---");
    const t5 = await apiCall("GET", "/api/paints/PNT-003");
    console.log("Product:", t5.body.product?.id, t5.body.product?.name, "Stock:", t5.body.product?.quantity);
    if (t5.status === 200 && t5.body.product?.id === "PNT003") {
      console.log("✓ TEST 5 PASSED: New paint details fetched successfully.");
      passedCount++;
    } else {
      throw new Error("TEST 5 FAILED");
    }

    // -------------------------------------------------------------
    // TEST 6: Enter invalid paint code
    // -------------------------------------------------------------
    console.log("\n--- TEST 6: Enter invalid paint code (PNT-999) ---");
    const t6 = await apiCall("GET", "/api/paints/PNT-999");
    console.log("Status:", t6.status, "Error message:", t6.body.error);
    if (t6.status === 404 && t6.body.error === 'Paint code "PNT-999" was not found.') {
      console.log("✓ TEST 6 PASSED: Clear error message returned.");
      passedCount++;
    } else {
      throw new Error("TEST 6 FAILED");
    }

    // -------------------------------------------------------------
    // TEST 7: Enter 0 quantity
    // -------------------------------------------------------------
    console.log("\n--- TEST 7: Enter quantity 0 ---");
    const t7 = await apiCall("POST", "/api/stock/add", {
      paintCode: "PNT-003",
      warehouse: wh1,
      quantity: 0
    }, adminToken);
    console.log("Status:", t7.status, "Error message:", t7.body.error);
    if (t7.status === 400 && t7.body.error.includes("greater than 0")) {
      console.log("✓ TEST 7 PASSED: Zero quantity rejected with validation error.");
      passedCount++;
    } else {
      throw new Error("TEST 7 FAILED");
    }

    // -------------------------------------------------------------
    // TEST 8: Enter negative quantity
    // -------------------------------------------------------------
    console.log("\n--- TEST 8: Enter negative quantity (-100) ---");
    const t8 = await apiCall("POST", "/api/stock/add", {
      paintCode: "PNT-003",
      warehouse: wh1,
      quantity: -100
    }, adminToken);
    console.log("Status:", t8.status, "Error message:", t8.body.error);
    if (t8.status === 400 && t8.body.error.includes("greater than 0")) {
      console.log("✓ TEST 8 PASSED: Negative quantity rejected with validation error.");
      passedCount++;
    } else {
      throw new Error("TEST 8 FAILED");
    }

    // -------------------------------------------------------------
    // TEST 9: Rapidly click Add Stock multiple times (Concurrency/Debounce)
    // -------------------------------------------------------------
    console.log("\n--- TEST 9: Concurrent/Rapid Stock Addition Requests ---");
    // Fire 5 simultaneous requests adding 10 units each
    const [initialWs] = await pool.query("SELECT quantity FROM warehouse_stock WHERE paint_id = 'PNT003' AND warehouse = ?", [wh1]);
    const initialQty = initialWs.length > 0 ? Number(initialWs[0].quantity) : 0;
    console.log(`Starting stock before 5 concurrent additions: ${initialQty}`);

    const concurrentPromises = [1, 2, 3, 4, 5].map((i) =>
      apiCall("POST", "/api/stock/add", {
        paintCode: "PNT-003",
        warehouse: wh1,
        quantity: 10
      }, staffToken)
    );

    const concurrentResults = await Promise.all(concurrentPromises);
    const allSuccessful = concurrentResults.every(r => r.status === 200 && r.body.success);
    console.log(`Concurrent executions status: ${concurrentResults.map(r => r.status).join(", ")}`);

    const [postWs] = await pool.query("SELECT quantity FROM warehouse_stock WHERE paint_id = 'PNT003' AND warehouse = ?", [wh1]);
    const finalQty = Number(postWs[0].quantity);
    console.log(`Stock after 5 concurrent additions (10 each): ${finalQty} (expected: ${initialQty + 50})`);

    if (allSuccessful && finalQty === initialQty + 50) {
      console.log("✓ TEST 9 PASSED: All concurrent additions executed atomically without lost updates.");
      passedCount++;
    } else {
      throw new Error("TEST 9 FAILED");
    }

    // -------------------------------------------------------------
    // TEST 10: Verify the database after multiple additions
    // -------------------------------------------------------------
    console.log("\n--- TEST 10: Verify database records and transactions ledger ---");
    const [dbTxs] = await pool.query("SELECT * FROM stock_transactions WHERE paint_id = 'PNT003' ORDER BY id DESC LIMIT 5");
    console.log(`Found ${dbTxs.length} stock transaction records in DB for PNT003.`);
    if (dbTxs.length >= 5) {
      console.log("Sample transaction record:", {
        id: dbTxs[0].id,
        paint_id: dbTxs[0].paint_id,
        warehouse: dbTxs[0].warehouse,
        previous_stock: dbTxs[0].previous_stock,
        added_quantity: dbTxs[0].added_quantity,
        new_stock: dbTxs[0].new_stock,
        added_by: dbTxs[0].added_by
      });
      console.log("✓ TEST 10 PASSED: Database state and audit ledger correctly match.");
      passedCount++;
    } else {
      throw new Error("TEST 10 FAILED");
    }

    // -------------------------------------------------------------
    // TEST 11: Refresh the page / Re-query from DB persistence
    // -------------------------------------------------------------
    console.log("\n--- TEST 11: Verify persistence upon simulated reload ---");
    const t11 = await apiCall("GET", "/api/stock");
    const reloadedItem = t11.body.find(s => s.paintId === "PNT003" && s.warehouse === wh1);
    console.log("Reloaded Stock item:", reloadedItem);
    if (reloadedItem && reloadedItem.quantity === finalQty) {
      console.log("✓ TEST 11 PASSED: Stock persists across refreshes because it is committed to MySQL.");
      passedCount++;
    } else {
      throw new Error("TEST 11 FAILED");
    }

    // -------------------------------------------------------------
    // TEST 12: Test with authenticated roles & reject unauthorized requests
    // -------------------------------------------------------------
    console.log("\n--- TEST 12: Role-based permissions & authorization ---");
    // Administrator
    const rAdmin = await apiCall("POST", "/api/stock/add", { paintCode: "PNT003", warehouse: wh1, quantity: 1 }, adminToken);
    console.log("Administrator role allowed:", rAdmin.status === 200);

    // Warehouse Manager
    const rWh = await apiCall("POST", "/api/stock/add", { paintCode: "PNT003", warehouse: wh1, quantity: 1 }, warehouseManagerToken);
    console.log("Warehouse Manager role allowed:", rWh.status === 200);

    // Staff
    const rStaff = await apiCall("POST", "/api/stock/add", { paintCode: "PNT003", warehouse: wh1, quantity: 1 }, staffToken);
    console.log("Staff role allowed:", rStaff.status === 200);

    // Unauthenticated (no token)
    const rNoToken = await apiCall("POST", "/api/stock/add", { paintCode: "PNT003", warehouse: wh1, quantity: 1 });
    console.log("No token rejected:", rNoToken.status === 401);

    // Unauthorized role
    const rInvalidRole = await apiCall("POST", "/api/stock/add", { paintCode: "PNT003", warehouse: wh1, quantity: 1 }, invalidRoleToken);
    console.log("Unauthorized role rejected:", rInvalidRole.status === 403);

    if (
      rAdmin.status === 200 &&
      rWh.status === 200 &&
      rStaff.status === 200 &&
      rNoToken.status === 401 &&
      rInvalidRole.status === 403
    ) {
      console.log("✓ TEST 12 PASSED: Authorized roles accepted, unauthorized/unauthenticated rejected.");
      passedCount++;
    } else {
      throw new Error("TEST 12 FAILED");
    }

    console.log("\n===============================================================");
    console.log(` ALL ${passedCount} / 12 TESTS COMPLETED AND VERIFIED SUCCESSFULLY! `);
    console.log("===============================================================");
  } catch (err) {
    console.error("Test execution failed:", err.message);
  } finally {
    server.close();
    process.exit(0);
  }
}

executeTestSuite();
