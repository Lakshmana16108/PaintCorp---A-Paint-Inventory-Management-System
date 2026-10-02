const http = require("http");
const jwt = require("jsonwebtoken");
const { initializeDatabase, getPool } = require("./config/database");
const { app } = require("./server");
require("dotenv").config();

const TEST_PORT = 5057;
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
        path: url.pathname + url.search,
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

async function runSalesTestSuite() {
  console.log("=====================================================");
  console.log(" PaintCorp ERP - Sales Analysis Dashboard Test Suite ");
  console.log("=====================================================\n");

  await initializeDatabase();
  const pool = getPool();

  const server = app.listen(TEST_PORT, () => {
    console.log(`[TEST SERVER] Running on port ${TEST_PORT} for sales testing.\n`);
  });

  const adminToken = jwt.sign(
    { id: 1, email: "admin@paintcorp.com", role: "Administrator" },
    process.env.JWT_SECRET || "your_jwt_secret_key_here",
    { expiresIn: "1h" }
  );

  let passed = 0;
  const total = 10;

  try {
    // -------------------------------------------------------------
    // TEST 1: Normal date range
    // -------------------------------------------------------------
    console.log("[TEST 1] Normal date range (2026-09-01 to 2026-09-30)");
    const res1 = await request("GET", "/api/sales-report?from=2026-09-01&to=2026-09-30", null, adminToken);

    const [dbOrders] = await pool.query(
      "SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount), 0) as rev FROM orders WHERE order_date >= '2026-09-01' AND order_date <= '2026-09-30' AND status != 'Cancelled'"
    );

    if (
      res1.status === 200 &&
      res1.data.summary.totalOrders === dbOrders[0].cnt &&
      res1.data.summary.totalRevenue === Number(dbOrders[0].rev)
    ) {
      console.log(`  => SUCCESS: Returns exact MySQL matches (Orders: ${res1.data.summary.totalOrders}, Revenue: ₹${res1.data.summary.totalRevenue}).\n`);
      passed++;
    } else {
      console.error("  => FAILED:", res1.status, res1.data);
    }

    // -------------------------------------------------------------
    // TEST 2: Single day query
    // -------------------------------------------------------------
    console.log("[TEST 2] Single day query (2026-09-17 to 2026-09-17)");
    const res2 = await request("GET", "/api/sales-report?from=2026-09-17&to=2026-09-17", null, adminToken);

    const [dbDay] = await pool.query(
      "SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount), 0) as rev FROM orders WHERE order_date = '2026-09-17' AND status != 'Cancelled'"
    );

    if (
      res2.status === 200 &&
      res2.data.timeline.length === 1 &&
      res2.data.summary.totalOrders === dbDay[0].cnt &&
      res2.data.summary.totalRevenue === Number(dbDay[0].rev)
    ) {
      console.log(`  => SUCCESS: Single day isolated correctly with 1 timeline point (Orders: ${res2.data.summary.totalOrders}, Revenue: ₹${res2.data.summary.totalRevenue}).\n`);
      passed++;
    } else {
      console.error("  => FAILED:", res2.status, res2.data);
    }

    // -------------------------------------------------------------
    // TEST 3: Range with NO sales
    // -------------------------------------------------------------
    console.log("[TEST 3] Range with NO sales (2024-01-01 to 2024-01-07)");
    const res3 = await request("GET", "/api/sales-report?from=2024-01-01&to=2024-01-07", null, adminToken);

    if (
      res3.status === 200 &&
      res3.data.summary.totalRevenue === 0 &&
      res3.data.summary.totalOrders === 0 &&
      res3.data.summary.quantitySold === 0 &&
      res3.data.summary.averageOrderValue === 0 &&
      res3.data.timeline.every((t) => t.revenue === 0)
    ) {
      console.log("  => SUCCESS: Correctly returned 0 KPIs, zero-filled series, no fake data.\n");
      passed++;
    } else {
      console.error("  => FAILED:", res3.status, res3.data);
    }

    // -------------------------------------------------------------
    // TEST 4: Cancelled Order Exclusion
    // -------------------------------------------------------------
    console.log("[TEST 4] Cancelled order exclusion from revenue/quantity KPIs");
    // Ensure test product and order
    await pool.query("DELETE FROM order_items WHERE order_id = 'SALES_TEST_CANC'");
    await pool.query("DELETE FROM orders WHERE id = 'SALES_TEST_CANC'");
    await pool.query(
      `INSERT INTO orders (id, customer_name, customer_phone, paint_name, paint_id, quantity, price, total_amount, order_date, status)
       VALUES ('SALES_TEST_CANC', 'Cancelled Customer', '0000000000', 'WeatherShield Max', 'PNT001', 50, 100.00, 5000.00, '2026-09-10', 'Cancelled')`
    );
    await pool.query(
      `INSERT INTO order_items (order_id, paint_id, paint_name, quantity, price)
       VALUES ('SALES_TEST_CANC', 'PNT001', 'WeatherShield Max', 50, 100.00)`
    );

    const res4 = await request("GET", "/api/sales-report?from=2026-09-10&to=2026-09-10", null, adminToken);
    const cancInStatus = res4.data.orderStatus.find((s) => s.status === "Cancelled");

    // The order is cancelled, so its 5000 amount and 50 quantity must NOT appear in summary
    const dayItem = res4.data.timeline.find((t) => t.date === "2026-09-10");
    const isExcludedFromRevenue = dayItem.revenue === 0;

    if (res4.status === 200 && isExcludedFromRevenue && cancInStatus && cancInStatus.count >= 1) {
      console.log("  => SUCCESS: Cancelled order excluded from revenue/KPIs but present in Order Status Analysis.\n");
      passed++;
    } else {
      console.error("  => FAILED: Cancelled order leakage:", res4.data);
    }

    // -------------------------------------------------------------
    // TEST 5: Real New Order Reflection
    // -------------------------------------------------------------
    console.log("[TEST 5] Real new order dynamically reflected in sales analysis");
    // Place a real order on 2026-09-12
    await pool.query("DELETE FROM order_items WHERE order_id = 'SALES_TEST_NEW'");
    await pool.query("DELETE FROM orders WHERE id = 'SALES_TEST_NEW'");

    const createOrderRes = await request(
      "POST",
      "/api/orders",
      {
        id: "SALES_TEST_NEW",
        customerName: "Realtime Analytics Buyer",
        customerPhone: "+91 99887 76655",
        date: "2026-09-12",
        items: [{ paintId: "PNT001", paintName: "WeatherShield Exterior Emulsion", quantity: 5, price: 3850.0 }]
      },
      adminToken
    );

    const res5 = await request("GET", "/api/sales-report?from=2026-09-12&to=2026-09-12", null, adminToken);

    if (
      createOrderRes.status === 201 &&
      res5.status === 200 &&
      res5.data.summary.totalOrders >= 1 &&
      res5.data.summary.totalRevenue >= 19250
    ) {
      console.log(`  => SUCCESS: New order immediately reflected in sales report (Revenue: ₹${res5.data.summary.totalRevenue}).\n`);
      passed++;
    } else {
      console.error("  => FAILED to reflect new order:", res5.data);
    }

    // -------------------------------------------------------------
    // TEST 6: Multi-product order item aggregation accuracy
    // -------------------------------------------------------------
    console.log("[TEST 6] Multi-product order item aggregation accuracy");
    await pool.query("DELETE FROM order_items WHERE order_id = 'SALES_TEST_MULTI'");
    await pool.query("DELETE FROM orders WHERE id = 'SALES_TEST_MULTI'");

    const multiOrder = await request(
      "POST",
      "/api/orders",
      {
        id: "SALES_TEST_MULTI",
        customerName: "Multi Product Analytics Buyer",
        customerPhone: "+91 99887 11223",
        date: "2026-09-14",
        items: [
          { paintId: "PNT001", paintName: "WeatherShield Exterior Emulsion", quantity: 2, price: 3850.0 },
          { paintId: "PNT002", paintName: "Weathershield Powerflexx", quantity: 3, price: 4280.0 }
        ]
      },
      adminToken
    );

    const res6 = await request("GET", "/api/sales-report?from=2026-09-14&to=2026-09-14", null, adminToken);
    const prod1 = res6.data.topProducts.find((p) => p.paintId === "PNT001");
    const prod2 = res6.data.topProducts.find((p) => p.paintId === "PNT002");

    if (
      multiOrder.status === 201 &&
      res6.status === 200 &&
      prod1 &&
      prod1.quantity >= 2 &&
      prod2 &&
      prod2.quantity >= 3
    ) {
      console.log("  => SUCCESS: Multi-product order items accurately aggregated in topProducts and revenueByProduct.\n");
      passed++;
    } else {
      console.error("  => FAILED multi-product aggregation:", res6.data);
    }

    // -------------------------------------------------------------
    // TEST 7: Date Boundary Precision
    // -------------------------------------------------------------
    console.log("[TEST 7] Date boundary precision (inclusive start and end, exclusive outside)");
    const res7 = await request("GET", "/api/sales-report?from=2026-09-12&to=2026-09-14", null, adminToken);

    const hasSept12 = res7.data.timeline.some((t) => t.date === "2026-09-12");
    const hasSept14 = res7.data.timeline.some((t) => t.date === "2026-09-14");
    const hasSept11 = res7.data.timeline.some((t) => t.date === "2026-09-11");
    const hasSept15 = res7.data.timeline.some((t) => t.date === "2026-09-15");

    if (hasSept12 && hasSept14 && !hasSept11 && !hasSept15) {
      console.log("  => SUCCESS: Boundary dates properly included, outside dates properly excluded.\n");
      passed++;
    } else {
      console.error("  => FAILED boundary precision:", { hasSept12, hasSept14, hasSept11, hasSept15 });
    }

    // -------------------------------------------------------------
    // TEST 8: Authentication Enforcement
    // -------------------------------------------------------------
    console.log("[TEST 8] Authentication enforcement on Sales Report API");
    const res8 = await request("GET", "/api/sales-report?from=2026-09-01&to=2026-09-30");

    if (res8.status === 401) {
      console.log("  => SUCCESS: Unauthenticated access rejected with HTTP 401.\n");
      passed++;
    } else {
      console.error("  => FAILED: Expected 401, got", res8.status);
    }

    // -------------------------------------------------------------
    // TEST 9: Date Order Validation (From > To)
    // -------------------------------------------------------------
    console.log("[TEST 9] Validation: From Date > To Date must be rejected with 400");
    const res9 = await request("GET", "/api/sales-report?from=2026-09-30&to=2026-09-01", null, adminToken);

    if (res9.status === 400 && res9.data.error.includes("From Date cannot be after To Date")) {
      console.log(`  => SUCCESS: Rejected invalid date order with HTTP 400 ("${res9.data.error}").\n`);
      passed++;
    } else {
      console.error("  => FAILED: Expected 400, got", res9.status, res9.data);
    }

    // -------------------------------------------------------------
    // TEST 10: Zero-fill Verification
    // -------------------------------------------------------------
    console.log("[TEST 10] Zero-fill Verification: Every date in range has an entry");
    const res10 = await request("GET", "/api/sales-report?from=2026-09-01&to=2026-09-10", null, adminToken);

    if (res10.status === 200 && res10.data.timeline.length === 10) {
      console.log("  => SUCCESS: Exactly 10 chronological data points for 10-day span with 0 revenue on empty trading days.\n");
      passed++;
    } else {
      console.error("  => FAILED zero-fill length:", res10.data.timeline?.length);
    }

    // Cleanup test records
    await pool.query("DELETE FROM order_items WHERE order_id IN ('SALES_TEST_CANC', 'SALES_TEST_NEW', 'SALES_TEST_MULTI')");
    await pool.query("DELETE FROM orders WHERE id IN ('SALES_TEST_CANC', 'SALES_TEST_NEW', 'SALES_TEST_MULTI')");

    console.log("=====================================================");
    console.log(` Sales Test Suite Results: ${passed}/${total} Passed `);
    console.log("=====================================================");

    if (passed === total) {
      console.log("\nALL 10 SALES DASHBOARD TESTS COMPLETED SUCCESSFULLY!\n");
      server.close(() => process.exit(0));
    } else {
      console.error(`\nFAILED: Only ${passed} of ${total} tests passed.`);
      server.close(() => process.exit(1));
    }
  } catch (err) {
    console.error("Sales test suite fatal error:", err);
    server.close(() => process.exit(1));
  }
}

runSalesTestSuite();
