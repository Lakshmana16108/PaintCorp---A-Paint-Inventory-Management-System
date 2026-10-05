const { initializeDatabase, getPool } = require("./config/database");
const jwt = require("jsonwebtoken");
const http = require("http");
const { app } = require("./server");

const JWT_SECRET = process.env.JWT_SECRET || "paintcorp_secure_jwt_secret_key_2026_production";

async function runTests() {
  console.log("=== Testing Continuous Stock Addition Backend API ===");
  await initializeDatabase();

  const server = app.listen(0);
  const port = server.address().port;
  console.log(`Test server running on port ${port}`);

  function makeRequest(method, path, body = null, token = null) {
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

  try {
    // Generate valid tokens
    const adminToken = jwt.sign(
      { id: 1, email: "admin@paintcorp.com", role: "Administrator", name: "Admin" },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
    const staffToken = jwt.sign(
      { id: 3, email: "priya.raj@paintcorp.com", role: "Staff", name: "Priya Raj" },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
    const unauthorizedToken = jwt.sign(
      { id: 99, email: "guest@paintcorp.com", role: "Guest", name: "Guest" },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 1. Test Paint search by exact code
    console.log("\n[Test 1] GET /api/paints/PNT001");
    const res1 = await makeRequest("GET", "/api/paints/PNT001");
    console.log("Status:", res1.status, "Product:", res1.body.product?.id, res1.body.product?.name);
    if (res1.status !== 200 || !res1.body.product) throw new Error("Test 1 failed");

    // 2. Test Paint search with hyphen (PNT-001)
    console.log("\n[Test 2] GET /api/paints/PNT-001");
    const res2 = await makeRequest("GET", "/api/paints/PNT-001");
    console.log("Status:", res2.status, "Found:", res2.body.product?.id, res2.body.product?.name);
    if (res2.status !== 200 || res2.body.product?.id !== "PNT001") throw new Error("Test 2 failed");

    // 3. Test Invalid Paint code (PNT-999)
    console.log("\n[Test 3] GET /api/paints/PNT-999");
    const res3 = await makeRequest("GET", "/api/paints/PNT-999");
    console.log("Status:", res3.status, "Error:", res3.body.error);
    if (res3.status !== 404 || !res3.body.error.includes("PNT-999")) throw new Error("Test 3 failed");

    // 4. Test Warehouses endpoint
    console.log("\n[Test 4] GET /api/stock/warehouses");
    const res4 = await makeRequest("GET", "/api/stock/warehouses");
    console.log("Status:", res4.status, "Warehouses:", res4.body);
    if (res4.status !== 200 || !Array.isArray(res4.body) || res4.body.length === 0) throw new Error("Test 4 failed");

    const targetWarehouse = res4.body[0];

    // 5. Test validation: Zero quantity
    console.log("\n[Test 5] POST /api/stock/add with quantity 0");
    const res5 = await makeRequest("POST", "/api/stock/add", { paintCode: "PNT-001", warehouse: targetWarehouse, quantity: 0 }, adminToken);
    console.log("Status:", res5.status, "Error:", res5.body.error);
    if (res5.status !== 400) throw new Error("Test 5 failed: zero quantity not rejected");

    // 6. Test validation: Negative quantity
    console.log("\n[Test 6] POST /api/stock/add with quantity -50");
    const res6 = await makeRequest("POST", "/api/stock/add", { paintCode: "PNT-001", warehouse: targetWarehouse, quantity: -50 }, adminToken);
    console.log("Status:", res6.status, "Error:", res6.body.error);
    if (res6.status !== 400) throw new Error("Test 6 failed: negative quantity not rejected");

    // 7. Test unauthenticated request
    console.log("\n[Test 7] POST /api/stock/add without token");
    const res7 = await makeRequest("POST", "/api/stock/add", { paintCode: "PNT-001", warehouse: targetWarehouse, quantity: 100 });
    console.log("Status:", res7.status, "Error:", res7.body.error);
    if (res7.status !== 401) throw new Error("Test 7 failed: unauthenticated not rejected");

    // 8. Test unauthorized role
    console.log("\n[Test 8] POST /api/stock/add with unauthorized role");
    const res8 = await makeRequest("POST", "/api/stock/add", { paintCode: "PNT-001", warehouse: targetWarehouse, quantity: 100 }, unauthorizedToken);
    console.log("Status:", res8.status, "Error:", res8.body.error);
    if (res8.status !== 403) throw new Error("Test 8 failed: unauthorized role not rejected");

    // 9. Test Continuous Addition 1: Add 500 units
    console.log(`\n[Test 9] POST /api/stock/add (Addition 1: 500 units to ${targetWarehouse})`);
    const res9 = await makeRequest("POST", "/api/stock/add", { paintCode: "PNT-001", warehouse: targetWarehouse, quantity: 500 }, adminToken);
    console.log("Addition 1 Result:", res9.body);
    if (res9.status !== 200 || !res9.body.success || res9.body.addedQuantity !== 500) throw new Error("Test 9 failed");
    const stockAfterFirst = res9.body.newStock;

    // 10. Test Continuous Addition 2: Add 300 units immediately
    console.log(`\n[Test 10] POST /api/stock/add (Addition 2: 300 units to ${targetWarehouse})`);
    const res10 = await makeRequest("POST", "/api/stock/add", { paintCode: "PNT-001", warehouse: targetWarehouse, quantity: 300 }, staffToken);
    console.log("Addition 2 Result:", res10.body);
    if (res10.status !== 200 || !res10.body.success || res10.body.previousStock !== stockAfterFirst || res10.body.newStock !== stockAfterFirst + 300) {
      throw new Error("Test 10 failed: continuous addition did not calculate correctly");
    }

    // 11. Test Recent Stock Additions
    console.log("\n[Test 11] GET /api/stock/recent-additions");
    const res11 = await makeRequest("GET", "/api/stock/recent-additions", null, adminToken);
    console.log("Status:", res11.status, "Count:", res11.body.length);
    console.log("Latest additions:", res11.body.slice(0, 2));
    if (res11.status !== 200 || !Array.isArray(res11.body) || res11.body.length < 2) throw new Error("Test 11 failed");

    console.log("\n>>> ALL BACKEND TESTS PASSED SUCCESSFULLY! <<<");
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    server.close();
    process.exit(0);
  }
}

runTests();
