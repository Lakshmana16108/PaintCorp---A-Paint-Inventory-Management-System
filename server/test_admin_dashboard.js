const http = require("http");

const BASE_URL = "http://localhost:5000";

function apiCall(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = {
      "Content-Type": "application/json"
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: headers
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log("==================================================");
  console.log("STARTING ADMIN DASHBOARD & SECURITY VERIFICATION");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // SETUP: Register test users for each role
    const timestamp = Date.now();
    const adminEmail = `admin_test_${timestamp}@paintcorp.com`;
    const whmEmail = `whm_test_${timestamp}@paintcorp.com`;
    const staffEmail = `staff_test_${timestamp}@paintcorp.com`;
    const password = "Password@123";

    // Try signing up as Administrator directly via public signup API (STEP 15: Public users must NOT be able to create themselves as Administrator)
    const adminSignupRes = await apiCall("POST", "/api/auth/signup", {
      name: "Admin Tester",
      email: adminEmail,
      mobile: "+919876543210",
      role: "Administrator",
      password
    });
    assert(adminSignupRes.status === 201 || adminSignupRes.status === 200, "User signup request accepted");

    // Warehouse Manager Signup
    await apiCall("POST", "/api/auth/signup", {
      name: "Warehouse Manager Tester",
      email: whmEmail,
      mobile: "+919876543211",
      role: "Warehouse Manager",
      password
    });

    // Staff Signup
    await apiCall("POST", "/api/auth/signup", {
      name: "Staff Tester",
      email: staffEmail,
      mobile: "+919876543212",
      role: "Staff",
      password
    });

    // TEST 14: Verify public signup coerced role away from Administrator to Staff
    const adminLoginAttempt = await apiCall("POST", "/api/auth/login", {
      email: adminEmail,
      password
    });
    assert(
      adminLoginAttempt.body.user.role === "Staff",
      "TEST 14: Public signup correctly prevented creating Administrator role (coerced to Staff)"
    );

    // Now elevate admin_test user to Administrator directly via DB pool
    const { initializeDatabase, getPool } = require("./config/database");
    await initializeDatabase();
    const pool = getPool();
    await pool.query("UPDATE users SET role = 'Administrator' WHERE email = ?", [adminEmail]);

    // Log in as Administrator
    const adminLogin = await apiCall("POST", "/api/auth/login", {
      email: adminEmail,
      password
    });
    const adminToken = adminLogin.body.token;
    assert(
      adminLogin.status === 200 && adminLogin.body.user.role === "Administrator",
      "TEST 1: Administrator logs in successfully and possesses Administrator role"
    );

    // Log in as Warehouse Manager
    const whmLogin = await apiCall("POST", "/api/auth/login", {
      email: whmEmail,
      password
    });
    const whmToken = whmLogin.body.token;
    assert(
      whmLogin.status === 200 && whmLogin.body.user.role === "Warehouse Manager",
      "Warehouse Manager logs in successfully"
    );

    // Log in as Staff
    const staffLogin = await apiCall("POST", "/api/auth/login", {
      email: staffEmail,
      password
    });
    const staffToken = staffLogin.body.token;
    assert(
      staffLogin.status === 200 && staffLogin.body.user.role === "Staff",
      "Staff logs in successfully"
    );

    // TEST 2: Warehouse Manager calling Admin API -> 403 Forbidden
    const whmAdminCall = await apiCall("GET", "/api/admin/dashboard", null, whmToken);
    assert(
      whmAdminCall.status === 403,
      "TEST 2: Warehouse Manager cannot access Admin Dashboard API (HTTP 403 Forbidden)"
    );

    // TEST 3: Staff calling Admin API -> 403 Forbidden
    const staffAdminCall = await apiCall("GET", "/api/admin/dashboard", null, staffToken);
    assert(
      staffAdminCall.status === 403,
      "TEST 3: Staff cannot access Admin Dashboard API (HTTP 403 Forbidden)"
    );

    // TEST 11: Unauthenticated request calling Admin API -> 401 Unauthorized
    const unauthCall = await apiCall("GET", "/api/admin/dashboard", null, null);
    assert(
      unauthCall.status === 401,
      "TEST 11: Unauthenticated request to Admin API rejected (HTTP 401 Unauthorized)"
    );

    // TEST 4: Administrator calling Admin Dashboard API -> 200 OK with real database data
    const adminDashRes = await apiCall("GET", "/api/admin/dashboard", null, adminToken);
    assert(
      adminDashRes.status === 200 && adminDashRes.body.success === true,
      "TEST 4: Administrator dashboard data successfully retrieved (HTTP 200 OK)"
    );

    const { kpis, warehouses, salesOverview, recentOrders, lowStockAlerts, userSummary, inventorySummary, recentActivity } = adminDashRes.body;

    // Verify KPIs
    assert(
      typeof kpis.totalUsers === "number" && kpis.totalUsers >= 1,
      `KPI Total Users: ${kpis.totalUsers}`
    );
    assert(
      typeof kpis.totalProducts === "number" && kpis.totalProducts >= 0,
      `KPI Paint Products: ${kpis.totalProducts}`
    );
    assert(
      typeof kpis.totalStockUnits === "number",
      `KPI Total Stock Units: ${kpis.totalStockUnits}`
    );
    assert(
      typeof kpis.lowStockCount === "number",
      `KPI Low Stock Count: ${kpis.lowStockCount}`
    );
    assert(
      typeof kpis.totalOrders === "number",
      `KPI Total Orders: ${kpis.totalOrders}`
    );

    // TEST 5: Warehouse overview
    assert(
      Array.isArray(warehouses) && warehouses.length > 0,
      `TEST 5: Warehouse overview loaded with ${warehouses.length} facilities`
    );
    warehouses.forEach((wh) => {
      assert(wh.name && typeof wh.totalStock === "number" && wh.status, `Facility "${wh.name}": Stock = ${wh.totalStock}, Status = ${wh.status}`);
    });

    // TEST 6: Sales chart data
    assert(
      salesOverview && Array.isArray(salesOverview.chartData),
      `TEST 6: Sales overview and chart data present with ${salesOverview.chartData.length} timeline points`
    );

    // TEST 7: Recent orders
    assert(
      Array.isArray(recentOrders),
      `TEST 7: Recent orders present (${recentOrders.length} orders)`
    );

    // TEST 8: Low stock alerts
    assert(
      Array.isArray(lowStockAlerts),
      `TEST 8: Low stock alerts present (${lowStockAlerts.length} items flagged)`
    );

    // TEST 13: User Management APIs
    const usersListRes = await apiCall("GET", "/api/admin/users", null, adminToken);
    assert(
      usersListRes.status === 200 && Array.isArray(usersListRes.body.users),
      `TEST 13A: Admin successfully retrieved user registry (${usersListRes.body.users.length} users)`
    );

    // Non-admin cannot retrieve user registry
    const whmUsersCall = await apiCall("GET", "/api/admin/users", null, whmToken);
    assert(
      whmUsersCall.status === 403,
      "TEST 13B: Non-admin cannot access user management registry (HTTP 403)"
    );

    // Update staff role to Warehouse Manager
    const staffUser = usersListRes.body.users.find((u) => u.email === staffEmail);
    if (staffUser) {
      const updateRes = await apiCall("PUT", `/api/admin/users/${staffUser.id}`, {
        name: "Staff Tester Promoted",
        mobile: "+919876543299",
        role: "Warehouse Manager",
        isActive: true
      }, adminToken);
      assert(
        updateRes.status === 200 && updateRes.body.success === true,
        "TEST 13C: Administrator successfully updated user details and role"
      );

      // Toggle status to Inactive
      const statusRes = await apiCall("PATCH", `/api/admin/users/${staffUser.id}/status`, {
        isActive: false
      }, adminToken);
      assert(
        statusRes.status === 200 && statusRes.body.isActive === false,
        "TEST 13D: Administrator successfully deactivated user account"
      );

      // Verify self-deactivation protection for Administrator
      const currentAdminUser = usersListRes.body.users.find((u) => u.email === adminEmail);
      if (currentAdminUser) {
        const selfDeactRes = await apiCall("PATCH", `/api/admin/users/${currentAdminUser.id}/status`, {
          isActive: false
        }, adminToken);
        assert(
          selfDeactRes.status === 400,
          "TEST 13E: Self-deactivation of logged-in Administrator properly blocked (HTTP 400)"
        );
      }
    }

    // TEST 12: Existing ERP Modules verification (No Regression)
    const paintsRes = await apiCall("GET", "/api/paints");
    assert(Array.isArray(paintsRes.body), "TEST 12A: Existing /api/paints functional");

    const stockRes = await apiCall("GET", "/api/stock");
    assert(Array.isArray(stockRes.body), "TEST 12B: Existing /api/stock functional");

    const ordersRes = await apiCall("GET", "/api/orders");
    assert(Array.isArray(ordersRes.body), "TEST 12C: Existing /api/orders functional");

    // Clean up test users
    await pool.query("DELETE FROM users WHERE email IN (?, ?, ?)", [adminEmail, whmEmail, staffEmail]);
    console.log("[CLEANUP] Test user accounts cleaned up.");

  } catch (error) {
    console.error("Test execution error:", error);
    failed++;
  }

  console.log("\n==================================================");
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
