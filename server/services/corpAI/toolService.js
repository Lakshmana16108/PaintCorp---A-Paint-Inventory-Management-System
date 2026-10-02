const { getPool } = require("../../config/database");
const { searchKnowledge, findBestSection } = require("./knowledgeService");

/**
 * Format a Date object to YYYY-MM-DD
 */
function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Intelligent date range resolver for natural language date inputs
 */
function resolveDateRange(from, to, naturalQuery = "") {
  const today = new Date();
  const q = (naturalQuery || "").toLowerCase();

  // If explicit YYYY-MM-DD dates provided
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (from && dateRegex.test(from) && to && dateRegex.test(to)) {
    return { fromDate: from, toDate: to };
  }

  // Parse natural language keywords
  if (q.includes("today")) {
    const d = toDateStr(today);
    return { fromDate: d, toDate: d };
  }

  if (q.includes("yesterday")) {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const d = toDateStr(y);
    return { fromDate: d, toDate: d };
  }

  if (q.includes("this week")) {
    const d = new Date(today);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(d.setDate(diff));
    return { fromDate: toDateStr(monday), toDate: toDateStr(today) };
  }

  if (q.includes("this month")) {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return { fromDate: toDateStr(firstDay), toDate: toDateStr(today) };
  }

  if (q.includes("last month") || q.includes("previous month")) {
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
    return { fromDate: toDateStr(firstDay), toDate: toDateStr(lastDay) };
  }

  // Check specific months like "September 2026" or "Sep 2026"
  const monthMatch = q.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[^\d]*(\d{4})?/);
  if (monthMatch) {
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const mStr = monthMatch[1].substring(0, 3).toLowerCase();
    const mIdx = monthNames.indexOf(mStr);
    const year = monthMatch[2] ? parseInt(monthMatch[2], 10) : today.getFullYear();
    if (mIdx !== -1) {
      const firstDay = new Date(year, mIdx, 1);
      const lastDay = new Date(year, mIdx + 1, 0);
      return { fromDate: toDateStr(firstDay), toDate: toDateStr(lastDay) };
    }
  }

  // Check explicit date range in query (e.g., "from 2026-09-01 to 2026-09-30")
  const rangeMatch = q.match(/(\d{4}-\d{2}-\d{2})\s*(?:to|until|-)\s*(\d{4}-\d{2}-\d{2})/);
  if (rangeMatch) {
    return { fromDate: rangeMatch[1], toDate: rangeMatch[2] };
  }

  // Default: past 30 days
  const past30 = new Date(today);
  past30.setDate(past30.getDate() - 30);
  return {
    fromDate: toDateStr(past30),
    toDate: toDateStr(today)
  };
}

/**
 * Intelligent helper to resolve a product name query against MySQL catalog.
 * Handles ambiguity: If multiple matches exist, returns all candidates so AI can ask for clarification.
 */
async function resolveProductCandidates(nameOrQuery) {
  if (!nameOrQuery || typeof nameOrQuery !== "string") {
    return { found: false, message: "No product query provided." };
  }

  const pool = getPool();
  const raw = nameOrQuery.trim();
  // Strip common noisy words like 'the', 'that', 'paint', 'paints'
  const cleaned = raw.replace(/\b(the|that|this|paint|paints|color|shade)\b/gi, "").trim();
  const searchPattern = `%${cleaned || raw}%`;

  // 1. Exact match check
  const [exactRows] = await pool.query(
    "SELECT id, name, brand, category, color, finish, price, quantity, status FROM products WHERE name = ? LIMIT 1",
    [raw]
  );
  if (exactRows.length === 1) {
    return { found: true, isExact: true, product: exactRows[0] };
  }

  // 2. Search by name, brand, or category
  const [matches] = await pool.query(
    `SELECT id, name, brand, category, color, finish, price, quantity, status 
     FROM products 
     WHERE name LIKE ? OR brand LIKE ? OR category LIKE ?
     ORDER BY (name LIKE ?) DESC, name ASC 
     LIMIT 10`,
    [searchPattern, searchPattern, searchPattern, `%${cleaned}%`]
  );

  if (matches.length === 0) {
    return {
      found: false,
      message: `I couldn't find a product matching "${raw}" in the PaintCorp inventory.`
    };
  }

  if (matches.length === 1) {
    return { found: true, isExact: false, product: matches[0] };
  }

  // Multiple candidates found -> Ambiguity resolution
  return {
    found: true,
    multipleMatches: true,
    count: matches.length,
    candidates: matches.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      price: Number(p.price),
      quantity: Number(p.quantity),
      status: p.status
    })),
    message: `I found ${matches.length} matching products in PaintCorp: ${matches.map((m) => m.name).join(", ")}. Which one would you like details for?`
  };
}

/**
 * 1. get_product: Retrieve product specs, price, finish, brand by name.
 */
async function get_product({ productName }) {
  if (!productName) return { success: false, error: "Product name is required." };
  const res = await resolveProductCandidates(productName);
  if (!res.found) return { success: false, message: res.message };
  if (res.multipleMatches) {
    return {
      success: true,
      multipleMatches: true,
      message: res.message,
      matches: res.candidates
    };
  }
  return {
    success: true,
    product: {
      id: res.product.id,
      name: res.product.name,
      brand: res.product.brand,
      category: res.product.category,
      color: res.product.color,
      finish: res.product.finish,
      price: Number(res.product.price),
      quantity: Number(res.product.quantity),
      status: res.product.status
    }
  };
}

/**
 * 2. get_product_by_id: Exact lookup by Product ID code (e.g. PNT001).
 */
async function get_product_by_id({ productId }) {
  if (!productId) return { success: false, error: "Product ID is required." };
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT id, name, brand, category, color, finish, price, quantity, status FROM products WHERE id = ?",
    [productId.trim()]
  );
  if (rows.length === 0) {
    return { success: false, message: `Product with ID "${productId}" not found.` };
  }
  const p = rows[0];
  return {
    success: true,
    product: {
      id: p.id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      color: p.color,
      finish: p.finish,
      price: Number(p.price),
      quantity: Number(p.quantity),
      status: p.status
    }
  };
}

/**
 * 3. search_products: Flexible multi-attribute catalog search.
 */
async function search_products({ query, category, brand, limit = 10 } = {}) {
  const pool = getPool();
  const maxLimit = Math.min(Number(limit) || 10, 30);
  let sql = "SELECT id, name, brand, category, color, finish, price, quantity, status FROM products WHERE 1=1";
  const params = [];

  if (query) {
    sql += " AND (name LIKE ? OR brand LIKE ? OR category LIKE ? OR color LIKE ?)";
    const p = `%${query.trim()}%`;
    params.push(p, p, p, p);
  }
  if (category) {
    sql += " AND category = ?";
    params.push(category.trim());
  }
  if (brand) {
    sql += " AND brand = ?";
    params.push(brand.trim());
  }
  sql += " ORDER BY name ASC LIMIT ?";
  params.push(maxLimit);

  const [rows] = await pool.query(sql, params);
  return {
    success: true,
    count: rows.length,
    products: rows.map((r) => ({
      id: r.id,
      name: r.name,
      brand: r.brand,
      category: r.category,
      color: r.color,
      finish: r.finish,
      price: Number(r.price),
      quantity: Number(r.quantity),
      status: r.status
    }))
  };
}

/**
 * 4. get_all_products: Catalog list with total count.
 */
async function get_all_products({ limit = 25 } = {}) {
  const pool = getPool();
  const maxLimit = Math.min(Number(limit) || 25, 50);

  const [rows] = await pool.query(
    "SELECT id, name, brand, category, price, quantity, status FROM products ORDER BY name ASC LIMIT ?",
    [maxLimit]
  );
  const [totalCountRow] = await pool.query("SELECT COUNT(*) AS total FROM products");
  const total = totalCountRow[0]?.total || rows.length;

  return {
    success: true,
    totalCatalogCount: total,
    returnedCount: rows.length,
    products: rows.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      price: Number(p.price),
      quantity: Number(p.quantity),
      status: p.status
    }))
  };
}

/**
 * 5. get_stock: Get total available stock and physical warehouse distribution for a product.
 */
async function get_stock({ productName }) {
  if (!productName) return { success: false, error: "Product name is required." };
  const res = await resolveProductCandidates(productName);
  if (!res.found) return { success: false, message: res.message };

  if (res.multipleMatches) {
    return {
      success: true,
      multipleMatches: true,
      message: res.message,
      matches: res.candidates
    };
  }

  const pool = getPool();
  const prod = res.product;
  const [wsRows] = await pool.query(
    "SELECT warehouse, quantity, min_quantity, status FROM warehouse_stock WHERE paint_id = ?",
    [prod.id]
  );

  return {
    success: true,
    product: {
      id: prod.id,
      name: prod.name,
      brand: prod.brand,
      totalStock: Number(prod.quantity),
      status: prod.status,
      warehouses: wsRows.map((w) => ({
        warehouse: w.warehouse,
        stock: Number(w.quantity),
        minQuantity: Number(w.min_quantity),
        status: w.status
      }))
    }
  };
}

/**
 * 6. get_warehouse_stock: Inventory breakdown across warehouse locations.
 */
async function get_warehouse_stock({ warehouse, limit = 20 } = {}) {
  const pool = getPool();
  const maxLimit = Math.min(Number(limit) || 20, 50);
  let query = "SELECT id, paint_id, paint_name, brand, warehouse, quantity, min_quantity, status FROM warehouse_stock";
  const params = [];

  if (warehouse) {
    query += " WHERE warehouse LIKE ?";
    params.push(`%${warehouse.trim()}%`);
  }
  query += " ORDER BY quantity DESC LIMIT ?";
  params.push(maxLimit);

  const [rows] = await pool.query(query, params);
  return {
    success: true,
    count: rows.length,
    warehouse: warehouse || "All Warehouses",
    items: rows.map((r) => ({
      paintId: r.paint_id,
      paintName: r.paint_name,
      brand: r.brand,
      warehouse: r.warehouse,
      quantity: Number(r.quantity),
      minQuantity: Number(r.min_quantity),
      status: r.status
    }))
  };
}

/**
 * 7. get_low_stock_products: Retrieve items <= safety minimum (<= 15L).
 */
async function get_low_stock_products() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT paint_id AS paintId, paint_name AS paintName, brand, warehouse, quantity, min_quantity AS minQuantity, status 
     FROM warehouse_stock 
     WHERE quantity <= min_quantity OR status = 'Low Stock' OR status = 'Out of Stock'
     ORDER BY quantity ASC`
  );

  return {
    success: true,
    lowStockCount: rows.length,
    items: rows.map((r) => ({
      paintId: r.paintId,
      paintName: r.paintName,
      brand: r.brand,
      warehouse: r.warehouse,
      quantity: Number(r.quantity),
      minQuantity: Number(r.minQuantity),
      status: r.status
    }))
  };
}

/**
 * 8. get_out_of_stock_products: Retrieve products with 0 liters available.
 */
async function get_out_of_stock_products() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT paint_id AS paintId, paint_name AS paintName, brand, warehouse, quantity, min_quantity AS minQuantity, status 
     FROM warehouse_stock 
     WHERE quantity = 0 OR status = 'Out of Stock'
     ORDER BY paint_name ASC`
  );

  return {
    success: true,
    outOfStockCount: rows.length,
    items: rows.map((r) => ({
      paintId: r.paintId,
      paintName: r.paintName,
      brand: r.brand,
      warehouse: r.warehouse,
      quantity: Number(r.quantity),
      status: r.status
    }))
  };
}

/**
 * 9. get_inventory_summary: High-level overview of total inventory health.
 */
async function get_inventory_summary() {
  const pool = getPool();
  const [pStats] = await pool.query(`
    SELECT 
      COUNT(*) AS totalProducts,
      COALESCE(SUM(quantity), 0) AS totalLiters,
      SUM(CASE WHEN quantity > 15 THEN 1 ELSE 0 END) AS inStockCount,
      SUM(CASE WHEN quantity > 0 AND quantity <= 15 THEN 1 ELSE 0 END) AS lowStockCount,
      SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END) AS outOfStockCount
    FROM products
  `);
  const [whStats] = await pool.query("SELECT DISTINCT warehouse FROM warehouse_stock");

  const stat = pStats[0];
  return {
    success: true,
    totalProducts: Number(stat.totalProducts || 0),
    totalStockLiters: Number(stat.totalLiters || 0),
    inStockCount: Number(stat.inStockCount || 0),
    lowStockCount: Number(stat.lowStockCount || 0),
    outOfStockCount: Number(stat.outOfStockCount || 0),
    warehouses: whStats.map((w) => w.warehouse)
  };
}

/**
 * 10. get_order: Order details with linked line items.
 */
async function get_order({ orderId }) {
  if (!orderId) return { success: false, error: "Order ID is required." };
  const pool = getPool();
  const cleanId = orderId.trim();

  const [orderRows] = await pool.query(
    "SELECT id, customer_name, customer_phone, customer_address, paint_name, quantity, price, order_date, status, total_amount, created_at FROM orders WHERE id = ?",
    [cleanId]
  );
  if (orderRows.length === 0) {
    return { success: false, message: `Order with ID "${orderId}" was not found in the PaintCorp system.` };
  }

  const o = orderRows[0];
  const [items] = await pool.query(
    "SELECT id, paint_id, paint_name, quantity, price FROM order_items WHERE order_id = ?",
    [cleanId]
  );

  return {
    success: true,
    order: {
      id: o.id,
      customerName: o.customer_name,
      customerPhone: o.customer_phone,
      customerAddress: o.customer_address,
      orderDate: toDateStr(new Date(o.order_date)),
      status: o.status,
      totalAmount: Number(o.total_amount),
      items: items.length > 0 ? items.map((i) => ({
        paintId: i.paint_id,
        paintName: i.paint_name,
        quantity: Number(i.quantity),
        price: Number(i.price)
      })) : [
        {
          paintId: o.paint_id || "N/A",
          paintName: o.paint_name,
          quantity: Number(o.quantity),
          price: Number(o.price)
        }
      ]
    }
  };
}

/**
 * 11. get_order_status: Quick status lookup for a specific order.
 */
async function get_order_status({ orderId }) {
  if (!orderId) return { success: false, error: "Order ID is required." };
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT id, customer_name, status, order_date, total_amount FROM orders WHERE id = ?",
    [orderId.trim()]
  );
  if (rows.length === 0) {
    return { success: false, message: `Order "${orderId}" was not found in the database.` };
  }
  const r = rows[0];
  return {
    success: true,
    orderId: r.id,
    customerName: r.customer_name,
    status: r.status,
    orderDate: toDateStr(new Date(r.order_date)),
    totalAmount: Number(r.total_amount)
  };
}

/**
 * 12. get_orders: List recent orders with optional status filter.
 */
async function get_orders({ status, limit = 10 } = {}) {
  const pool = getPool();
  const maxLimit = Math.min(Number(limit) || 10, 30);
  let query = "SELECT id, customer_name, order_date, status, total_amount, quantity FROM orders";
  const params = [];

  if (status) {
    query += " WHERE status = ?";
    params.push(status.trim());
  }
  query += " ORDER BY order_date DESC, created_at DESC LIMIT ?";
  params.push(maxLimit);

  const [rows] = await pool.query(query, params);
  return {
    success: true,
    count: rows.length,
    orders: rows.map((o) => ({
      id: o.id,
      customerName: o.customer_name,
      orderDate: toDateStr(new Date(o.order_date)),
      status: o.status,
      totalAmount: Number(o.total_amount),
      quantity: Number(o.quantity)
    }))
  };
}

/**
 * 13. get_sales_summary: Reuses the exact business calculations from Sales Analysis.
 * Cancelled orders are excluded from revenue and quantity sold metrics.
 */
async function get_sales_summary({ fromDate, toDate, naturalQuery } = {}) {
  const dates = resolveDateRange(fromDate, toDate, naturalQuery);
  const pool = getPool();

  const [ordersSummary] = await pool.query(
    `SELECT COUNT(*) AS totalOrders, COALESCE(SUM(total_amount), 0) AS totalRevenue
     FROM orders
     WHERE order_date >= ? AND order_date <= ? AND status != 'Cancelled'`,
    [dates.fromDate, dates.toDate]
  );

  const [itemsSummary] = await pool.query(
    `SELECT COALESCE(SUM(oi.quantity), 0) AS totalQuantity
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE o.order_date >= ? AND o.order_date <= ? AND o.status != 'Cancelled'`,
    [dates.fromDate, dates.toDate]
  );

  const [cancelledSummary] = await pool.query(
    `SELECT COUNT(*) AS cancelledOrders, COALESCE(SUM(total_amount), 0) AS cancelledRevenue 
     FROM orders 
     WHERE order_date >= ? AND order_date <= ? AND status = 'Cancelled'`,
    [dates.fromDate, dates.toDate]
  );

  const totalOrders = Number(ordersSummary[0]?.totalOrders || 0);
  const totalRevenue = Number(ordersSummary[0]?.totalRevenue || 0);
  const quantitySold = Number(itemsSummary[0]?.totalQuantity || 0);
  const averageOrderValue = totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0;

  return {
    success: true,
    interval: {
      from: dates.fromDate,
      to: dates.toDate
    },
    totalRevenue,
    totalOrders,
    quantitySold,
    averageOrderValue,
    cancelledOrders: Number(cancelledSummary[0]?.cancelledOrders || 0)
  };
}

/**
 * 14. get_top_selling_products: Paints ranked by quantity sold (liters).
 * Reuses the authoritative query from salesController.js.
 */
async function get_top_selling_products({ fromDate, toDate, limit = 5, naturalQuery } = {}) {
  const dates = resolveDateRange(fromDate, toDate, naturalQuery);
  const pool = getPool();
  const maxLimit = Math.min(Number(limit) || 5, 20);

  const [rows] = await pool.query(
    `SELECT 
       oi.paint_id AS paintId,
       oi.paint_name AS paintName,
       COALESCE(SUM(oi.quantity), 0) AS quantitySold,
       COALESCE(SUM(oi.quantity * oi.price), 0) AS revenue
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE o.order_date >= ? AND o.order_date <= ? AND o.status != 'Cancelled'
     GROUP BY oi.paint_id, oi.paint_name
     ORDER BY quantitySold DESC, revenue DESC
     LIMIT ?`,
    [dates.fromDate, dates.toDate, maxLimit]
  );

  return {
    success: true,
    interval: {
      from: dates.fromDate,
      to: dates.toDate
    },
    topSellingPaints: rows.map((r) => ({
      paintId: r.paintId,
      paintName: r.paintName,
      quantitySold: Number(r.quantitySold),
      revenue: Number(r.revenue)
    }))
  };
}

/**
 * 15. get_revenue_by_product: Paints ranked by gross revenue contribution.
 * Reuses the authoritative query from salesController.js.
 */
async function get_revenue_by_product({ fromDate, toDate, limit = 5, naturalQuery } = {}) {
  const dates = resolveDateRange(fromDate, toDate, naturalQuery);
  const pool = getPool();
  const maxLimit = Math.min(Number(limit) || 5, 20);

  const [rows] = await pool.query(
    `SELECT 
       oi.paint_id AS paintId,
       oi.paint_name AS paintName,
       COALESCE(SUM(oi.quantity * oi.price), 0) AS revenue,
       COALESCE(SUM(oi.quantity), 0) AS quantitySold
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE o.order_date >= ? AND o.order_date <= ? AND o.status != 'Cancelled'
     GROUP BY oi.paint_id, oi.paint_name
     ORDER BY revenue DESC, quantitySold DESC
     LIMIT ?`,
    [dates.fromDate, dates.toDate, maxLimit]
  );

  return {
    success: true,
    interval: {
      from: dates.fromDate,
      to: dates.toDate
    },
    revenueByPaint: rows.map((r) => ({
      paintId: r.paintId,
      paintName: r.paintName,
      revenue: Number(r.revenue),
      quantitySold: Number(r.quantitySold)
    }))
  };
}

/**
 * 16. get_sales_by_date: Chronological daily sales progression.
 */
async function get_sales_by_date({ fromDate, toDate, naturalQuery } = {}) {
  const dates = resolveDateRange(fromDate, toDate, naturalQuery);
  const pool = getPool();

  const [rows] = await pool.query(
    `SELECT 
       DATE_FORMAT(order_date, '%Y-%m-%d') AS date,
       COALESCE(SUM(total_amount), 0) AS revenue,
       COUNT(id) AS ordersCount,
       COALESCE(SUM(quantity), 0) AS quantity
     FROM orders
     WHERE order_date >= ? AND order_date <= ? AND status != 'Cancelled'
     GROUP BY DATE_FORMAT(order_date, '%Y-%m-%d')
     ORDER BY date ASC`,
    [dates.fromDate, dates.toDate]
  );

  return {
    success: true,
    interval: {
      from: dates.fromDate,
      to: dates.toDate
    },
    days: rows.map((r) => ({
      date: r.date,
      revenue: Number(r.revenue),
      ordersCount: Number(r.ordersCount),
      quantity: Number(r.quantity)
    }))
  };
}

/**
 * 17. get_sales_details: Individual order line items matching Sales Details table.
 */
async function get_sales_details({ fromDate, toDate, limit = 10, naturalQuery } = {}) {
  const dates = resolveDateRange(fromDate, toDate, naturalQuery);
  const pool = getPool();
  const maxLimit = Math.min(Number(limit) || 10, 30);

  const [rows] = await pool.query(
    `SELECT 
       oi.id,
       DATE_FORMAT(o.order_date, '%Y-%m-%d') AS date,
       o.id AS orderId,
       o.customer_name AS customerName,
       oi.paint_name AS paintName,
       oi.quantity,
       (oi.quantity * oi.price) AS amount,
       o.status
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE o.order_date >= ? AND o.order_date <= ?
     ORDER BY o.order_date DESC, o.created_at DESC
     LIMIT ?`,
    [dates.fromDate, dates.toDate, maxLimit]
  );

  return {
    success: true,
    interval: {
      from: dates.fromDate,
      to: dates.toDate
    },
    details: rows.map((r) => ({
      id: r.id,
      date: r.date,
      orderId: r.orderId,
      customerName: r.customerName,
      paintName: r.paintName,
      quantity: Number(r.quantity),
      amount: Number(r.amount),
      status: r.status
    }))
  };
}

/**
 * 18. get_product_sales: Specific sales volume and revenue for a single paint product.
 */
async function get_product_sales({ productName, fromDate, toDate, naturalQuery } = {}) {
  if (!productName) return { success: false, error: "Product name is required." };
  const dates = resolveDateRange(fromDate, toDate, naturalQuery);
  const pool = getPool();

  const [rows] = await pool.query(
    `SELECT 
       oi.paint_id AS paintId,
       oi.paint_name AS paintName,
       COALESCE(SUM(oi.quantity), 0) AS quantitySold,
       COALESCE(SUM(oi.quantity * oi.price), 0) AS revenue,
       COUNT(DISTINCT o.id) AS ordersCount
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE oi.paint_name LIKE ? AND o.order_date >= ? AND o.order_date <= ? AND o.status != 'Cancelled'
     GROUP BY oi.paint_id, oi.paint_name`,
    [`%${productName.trim()}%`, dates.fromDate, dates.toDate]
  );

  if (rows.length === 0) {
    return {
      success: true,
      found: false,
      interval: { from: dates.fromDate, to: dates.toDate },
      message: `No sales records found for "${productName}" in the interval ${dates.fromDate} to ${dates.toDate}.`
    };
  }

  return {
    success: true,
    found: true,
    interval: { from: dates.fromDate, to: dates.toDate },
    products: rows.map((r) => ({
      paintId: r.paintId,
      paintName: r.paintName,
      quantitySold: Number(r.quantitySold),
      revenue: Number(r.revenue),
      ordersCount: Number(r.ordersCount)
    }))
  };
}

/**
 * 19. get_paintcorp_knowledge: Semantic search of system documentation.
 */
async function get_paintcorp_knowledge({ query }) {
  if (!query) return { success: false, error: "Query is required." };
  const bestSection = findBestSection(query, 16);
  if (bestSection) {
    return {
      success: true,
      query,
      count: 1,
      matchedSection: bestSection.heading,
      articles: [
        {
          title: bestSection.heading,
          id: bestSection.file.replace(".md", ""),
          content: bestSection.body
        }
      ]
    };
  }
  const results = searchKnowledge(query, 2);
  return {
    success: true,
    query,
    count: results.length,
    articles: results
  };
}

// Master Tools Registry
const TOOLS = {
  get_product,
  get_product_by_id,
  search_products,
  get_all_products,
  get_stock,
  get_warehouse_stock,
  get_low_stock_products,
  get_out_of_stock_products,
  get_inventory_summary,
  get_order,
  get_order_status,
  get_orders,
  get_sales_summary,
  get_sales_by_date,
  get_top_selling_products,
  get_revenue_by_product,
  get_sales_details,
  get_product_sales,
  get_paintcorp_knowledge,

  // CamelCase Aliases for backward compatibility
  getProduct: get_product,
  getProductById: get_product_by_id,
  getAllProducts: get_all_products,
  getStock: get_stock,
  getWarehouseStock: get_warehouse_stock,
  getLowStockProducts: get_low_stock_products,
  getOrder: get_order,
  getOrderStatus: get_order_status,
  getOrders: get_orders,
  getSalesSummary: get_sales_summary,
  getTopSellingProducts: get_top_selling_products,
  getRevenueByProduct: get_revenue_by_product,
  getPaintCorpKnowledge: get_paintcorp_knowledge
};

module.exports = {
  TOOLS,
  resolveDateRange,
  resolveProductCandidates,
  get_product,
  get_product_by_id,
  search_products,
  get_all_products,
  get_stock,
  get_warehouse_stock,
  get_low_stock_products,
  get_out_of_stock_products,
  get_inventory_summary,
  get_order,
  get_order_status,
  get_orders,
  get_sales_summary,
  get_sales_by_date,
  get_top_selling_products,
  get_revenue_by_product,
  get_sales_details,
  get_product_sales,
  get_paintcorp_knowledge
};
