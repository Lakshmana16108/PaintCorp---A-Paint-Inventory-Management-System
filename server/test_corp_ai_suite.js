const { initializeDatabase, getPool } = require("./config/database");
const { app } = require("./server");
const jwt = require("jsonwebtoken");
const http = require("http");
require("dotenv").config();

async function runTestSuite() {
  console.log("=====================================================");
  console.log(" PaintCorp ERP - Corp AI Assistant Test Suite ");
  console.log("=====================================================");

  await initializeDatabase();
  const pool = getPool();

  const PORT = 5059;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[TEST SERVER] Running on port ${PORT} for Corp AI testing.\n`);

  const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key_here";
  const testToken = jwt.sign(
    { id: 1, email: "admin@paintcorp.com", role: "admin", username: "admin" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${testToken}`
  };

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      passed++;
      console.log(`  => SUCCESS: ${message}`);
    } else {
      console.error(`  => FAILED: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // ----------------------------------------------------
    // TEST 1: System Knowledge ("What is PaintCorp?")
    // ----------------------------------------------------
    console.log("[TEST 1] System Knowledge: 'What is PaintCorp?'");
    const res1 = await fetch(`http://localhost:${PORT}/api/ai/chat`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ message: "What is PaintCorp?" })
    });
    const data1 = await res1.json();
    assert(
      data1.success === true &&
      data1.answer.toLowerCase().includes("paintcorp") &&
      data1.source === "system",
      "Answers from system documentation with source 'system'."
    );

    // ----------------------------------------------------
    // TEST 2: Available Products ("What products are available?")
    // ----------------------------------------------------
    console.log("\n[TEST 2] Available Products: 'What products are available?'");
    const res2 = await fetch(`http://localhost:${PORT}/api/ai/chat`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ message: "What products are available in the catalog?" })
    });
    const data2 = await res2.json();
    assert(
      data2.success === true &&
      (data2.answer.includes("WeatherShield") || data2.answer.includes("Nippon") || data2.answer.includes("Apex")),
      "Returns live products directly from MySQL products catalog."
    );

    // ----------------------------------------------------
    // TEST 3: Live Stock for Real Product ("What is the stock of Nippon Spot-less?")
    // ----------------------------------------------------
    console.log("\n[TEST 3] Real Product Stock: 'What is the stock of Nippon Spot-less?'");
    // Get actual stock from MySQL first
    const [pRows] = await pool.query("SELECT name, quantity FROM products WHERE name LIKE '%Nippon Spot-less%' LIMIT 1");
    const expectedName = pRows[0]?.name;
    const expectedQty = Number(pRows[0]?.quantity);

    const res3 = await fetch(`http://localhost:${PORT}/api/ai/chat`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ message: "What is the stock of Nippon Spot-less?" })
    });
    const data3 = await res3.json();
    assert(
      data3.success === true &&
      data3.answer.includes(String(expectedQty)) &&
      data3.source === "inventory",
      `Matches authoritative MySQL stock (${expectedQty} L) for ${expectedName}.`
    );

    // ----------------------------------------------------
    // TEST 4: Low Stock Products ("Which products are low in stock?")
    // ----------------------------------------------------
    console.log("\n[TEST 4] Low Stock Products: 'Which products are low in stock?'");
    const [lowRows] = await pool.query("SELECT COUNT(*) as count FROM warehouse_stock WHERE quantity <= min_quantity");
    const actualLowCount = lowRows[0].count;

    const res4 = await fetch(`http://localhost:${PORT}/api/ai/chat`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ message: "Which products are low in stock?" })
    });
    const data4 = await res4.json();
    assert(
      data4.success === true &&
      data4.source === "inventory" &&
      (actualLowCount === 0 || data4.answer.includes(String(actualLowCount)) || data4.answer.includes("Low Stock")),
      `Correctly reports live low-stock items (${actualLowCount} items in MySQL).`
    );

    // ----------------------------------------------------
    // TEST 5: Top Selling Paints ("What are the top-selling paints?")
    // ----------------------------------------------------
    console.log("\n[TEST 5] Top Selling Paints: 'What are the top-selling paints?'");
    const res5 = await fetch(`http://localhost:${PORT}/api/ai/chat`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ message: "What are the top-selling paints for September 2026?" })
    });
    const data5 = await res5.json();
    assert(
      data5.success === true &&
      data5.source === "sales" &&
      (data5.answer.includes("Apex Ultima") || data5.answer.includes("WoodTech") || data5.answer.includes("sold")),
      "Returns top-selling paint formulations ranked from MySQL order items."
    );

    // ----------------------------------------------------
    // TEST 6: Sales & Revenue Query ("What is the revenue for September 2026?")
    // ----------------------------------------------------
    console.log("\n[TEST 6] Revenue Query: 'What is the revenue for September 2026?'");
    const [revRows] = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS revenue, COUNT(*) AS count 
       FROM orders 
       WHERE order_date >= '2026-09-01' AND order_date <= '2026-09-30' AND status != 'Cancelled'`
    );
    const expectedRevenue = Number(revRows[0].revenue);

    const res6 = await fetch(`http://localhost:${PORT}/api/ai/chat`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ message: "What was the revenue and total sales for September 2026?" })
    });
    const data6 = await res6.json();
    assert(
      data6.success === true &&
      data6.source === "sales" &&
      data6.answer.includes(expectedRevenue.toLocaleString("en-IN")),
      `Accurately states exact MySQL revenue (₹${expectedRevenue.toLocaleString("en-IN")}) matching Sales Analysis.`
    );

    // ----------------------------------------------------
    // TEST 7: Specific Order Status ("What is the status of real order?")
    // ----------------------------------------------------
    console.log("\n[TEST 7] Order Status Lookup for real order");
    const [orderRows] = await pool.query("SELECT id, status, customer_name FROM orders LIMIT 1");
    const testOrder = orderRows[0];

    const res7 = await fetch(`http://localhost:${PORT}/api/ai/chat`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ message: `What is the status of order ${testOrder.id}?` })
    });
    const data7 = await res7.json();
    assert(
      data7.success === true &&
      data7.source === "orders" &&
      data7.answer.includes(testOrder.status) &&
      data7.answer.includes(testOrder.customer_name),
      `Found real order ${testOrder.id} with status '${testOrder.status}' and customer '${testOrder.customer_name}'.`
    );

    // ----------------------------------------------------
    // TEST 8: Nonexistent Product Query
    // ----------------------------------------------------
    console.log("\n[TEST 8] Nonexistent Product: 'What is the stock of Flying Unicorn Hologram Paint?'");
    const res8 = await fetch(`http://localhost:${PORT}/api/ai/chat`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ message: "What is the stock of Flying Unicorn Hologram Paint?" })
    });
    const data8 = await res8.json();
    assert(
      data8.success === true &&
      (data8.answer.toLowerCase().includes("couldn't find") || data8.answer.toLowerCase().includes("no product") || data8.answer.toLowerCase().includes("not found")),
      "Truthfully reports nonexistent product is not in database without hallucinating fake stock."
    );

    // ----------------------------------------------------
    // TEST 9: Nonexistent Order Query
    // ----------------------------------------------------
    console.log("\n[TEST 9] Nonexistent Order: 'What is the status of order ORD999999?'");
    const res9 = await fetch(`http://localhost:${PORT}/api/ai/chat`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ message: "What is the status of order ORD999999?" })
    });
    const data9 = await res9.json();
    assert(
      data9.success === true &&
      (data9.answer.toLowerCase().includes("not found") || data9.answer.toLowerCase().includes("does not exist")),
      "Truthfully reports non-existent order was not found."
    );

    // ----------------------------------------------------
    // TEST 10: Out-of-Scope Query ("Who was the first president?")
    // ----------------------------------------------------
    console.log("\n[TEST 10] Out-of-Scope Query: 'Who was the first president of the United States?'");
    const res10 = await fetch(`http://localhost:${PORT}/api/ai/chat`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ message: "Who was the first president of the United States?" })
    });
    const data10 = await res10.json();
    assert(
      data10.success === true &&
      (data10.answer.includes("Corp AI") || data10.answer.includes("PaintCorp")),
      "Clarifies Corp AI's scope and does not pretend external questions are PaintCorp records."
    );

    // ----------------------------------------------------
    // TEST 11: Authentication Enforcement
    // ----------------------------------------------------
    console.log("\n[TEST 11] Authentication Enforcement: Unauthenticated request rejected");
    const res11 = await fetch(`http://localhost:${PORT}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "What is current stock?" })
    });
    assert(
      res11.status === 401,
      "Unauthenticated request properly rejected with HTTP 401."
    );

    // ----------------------------------------------------
    // TEST 12: Empty Input Validation
    // ----------------------------------------------------
    console.log("\n[TEST 12] Empty Input Validation: Blank query rejected with 400");
    const res12 = await fetch(`http://localhost:${PORT}/api/ai/chat`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ message: "   " })
    });
    assert(
      res12.status === 400,
      "Empty query rejected with HTTP 400."
    );

    // ----------------------------------------------------
    // TEST 13: Health Check / Status Endpoint
    // ----------------------------------------------------
    console.log("\n[TEST 13] Health Check: GET /api/ai/status");
    const res13 = await fetch(`http://localhost:${PORT}/api/ai/status`);
    const data13 = await res13.json();
    assert(
      data13.success === true && data13.service === "Corp AI" && data13.status === "active",
      "Status endpoint returns active status and model metadata."
    );

    // ----------------------------------------------------
    // TEST 14: How-to Documentation Query ("How do I cancel an order?")
    // ----------------------------------------------------
    console.log("\n[TEST 14] How-to Documentation: 'How do I cancel an order?'");
    const res14 = await fetch(`http://localhost:${PORT}/api/ai/chat`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ message: "How do I cancel an order and how does stock restoration work?" })
    });
    const data14 = await res14.json();
    assert(
      data14.success === true &&
      (data14.answer.toLowerCase().includes("cancel") || data14.answer.toLowerCase().includes("restor")),
      "Explains order cancellation and automatic stock restoration workflow from knowledge base."
    );

    console.log("\n=====================================================");
    console.log(` Corp AI Test Suite Results: ${passed}/${total} Passed `);
    console.log("=====================================================");
    console.log("\nALL CORP AI TESTS COMPLETED SUCCESSFULLY!\n");
  } finally {
    server.close();
  }
}

runTestSuite().catch((err) => {
  console.error("Test Suite execution failed:", err);
  process.exit(1);
});
