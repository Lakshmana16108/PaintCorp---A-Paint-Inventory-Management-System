const { getPool } = require("../config/database");

/**
 * GET /api/stock
 * Fetch all warehouse stock levels from MySQL
 */
async function getAllStock(req, res) {
  try {
    const pool = getPool();
    const [rows] = await pool.query("SELECT * FROM warehouse_stock ORDER BY id ASC");
    // Format to match frontend expected props
    const formatted = rows.map((r) => ({
      id: r.id,
      paintId: r.paint_id,
      paintName: r.paint_name,
      brand: r.brand,
      warehouse: r.warehouse,
      quantity: Number(r.quantity),
      minQuantity: Number(r.min_quantity),
      status: r.status
    }));
    return res.json(formatted);
  } catch (error) {
    console.error("Get stock error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch stock from database." });
  }
}

/**
 * PUT /api/stock/:id
 * Update warehouse stock quantity and synchronize products catalog total stock in a transaction
 */
async function updateStock(req, res) {
  const { id } = req.params;
  const { quantity, minQuantity } = req.body;

  const pool = getPool();
  let conn;

  try {
    const q = Number(quantity);
    const minQ = Number(minQuantity !== undefined ? minQuantity : 15);

    if (isNaN(q) || q < 0) {
      return res.status(400).json({ success: false, error: "Quantity must be a valid non-negative integer." });
    }
    if (isNaN(minQ) || minQ < 0) {
      return res.status(400).json({ success: false, error: "Minimum quantity must be a valid non-negative integer." });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [wsRows] = await conn.query("SELECT * FROM warehouse_stock WHERE id = ? FOR UPDATE", [id]);
    if (wsRows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, error: `Stock record ${id} not found.` });
    }

    const ws = wsRows[0];
    const status = q <= 0 ? "Out of Stock" : (q <= minQ ? "Low Stock" : "In Stock");

    // 1. Update the warehouse stock entry
    await conn.query(
      `UPDATE warehouse_stock SET quantity = ?, min_quantity = ?, status = ? WHERE id = ?`,
      [q, minQ, status, id]
    );

    // 2. Synchronize products table total quantity for this paint_id
    const [sumRows] = await conn.query(
      "SELECT COALESCE(SUM(quantity), 0) AS total_qty FROM warehouse_stock WHERE paint_id = ?",
      [ws.paint_id]
    );
    const totalQty = Number(sumRows[0].total_qty);
    const prodStatus = totalQty <= 0 ? "Out of Stock" : (totalQty <= 15 ? "Low Stock" : "In Stock");

    await conn.query(
      "UPDATE products SET quantity = ?, status = ? WHERE id = ?",
      [totalQty, prodStatus, ws.paint_id]
    );

    await conn.commit();
    conn.release();

    return res.json({ success: true, id, quantity: q, minQuantity: minQ, status });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (rbErr) {}
      conn.release();
    }
    console.error("Update stock error:", error);
    return res.status(500).json({ success: false, error: "Failed to update warehouse stock." });
  }
}

/**
 * GET /api/stock/warehouses
 * Fetch all distinct warehouse locations
 */
async function getWarehouses(req, res) {
  try {
    const pool = getPool();
    const [rows] = await pool.query("SELECT DISTINCT warehouse FROM warehouse_stock ORDER BY warehouse ASC");
    const warehouses = rows.map((r) => r.warehouse).filter(Boolean);
    return res.json(warehouses);
  } catch (error) {
    console.error("Get warehouses error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch warehouse locations." });
  }
}

/**
 * GET /api/stock/recent-additions
 * Fetch recent stock addition transactions
 */
async function getRecentStockAdditions(req, res) {
  try {
    const pool = getPool();
    let rows;
    try {
      [rows] = await pool.query("SELECT * FROM stock_transactions ORDER BY created_at DESC, id DESC LIMIT 20");
    } catch (e) {
      rows = [];
    }

    const formatted = rows.map((r) => ({
      id: r.id,
      paintCode: r.paint_id,
      paintName: r.paint_name,
      warehouse: r.warehouse,
      previousStock: Number(r.previous_stock),
      addedQuantity: Number(r.added_quantity),
      newStock: Number(r.new_stock),
      addedBy: r.added_by,
      date: r.created_at
    }));

    return res.json(formatted);
  } catch (error) {
    console.error("Get recent additions error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch recent stock additions." });
  }
}

/**
 * POST /api/stock/add
 * Safely and atomically add stock to a warehouse for a paint product
 */
async function addStock(req, res) {
  // 1. Validate authenticated user & roles
  if (!req.user) {
    return res.status(401).json({ success: false, error: "Access denied. Authentication required." });
  }

  const userRole = req.user.role || "Staff";
  const allowedRoles = ["Administrator", "Warehouse Manager", "Staff", "Manager"];
  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({ success: false, error: "Access denied. Insufficient permissions to add stock." });
  }

  const { paintCode, paintId, warehouse, quantity } = req.body;
  const pCode = (paintCode || paintId || "").trim();
  const whName = (warehouse || "").trim();
  const q = Number(quantity);

  // 2. Validate product code
  if (!pCode) {
    return res.status(400).json({ success: false, error: "Paint code is required." });
  }

  // 3. Validate warehouse
  if (!whName) {
    return res.status(400).json({ success: false, error: "Warehouse selection is required." });
  }

  // 4. Validate quantity
  if (quantity === undefined || quantity === null || String(quantity).trim() === "") {
    return res.status(400).json({ success: false, error: "Quantity is required." });
  }
  if (!Number.isFinite(q) || isNaN(q)) {
    return res.status(400).json({ success: false, error: "Quantity must be a valid number." });
  }
  if (!Number.isInteger(q)) {
    return res.status(400).json({ success: false, error: "Quantity must be a whole integer." });
  }
  if (q <= 0) {
    return res.status(400).json({ success: false, error: "Quantity to add must be greater than 0." });
  }

  const pool = getPool();
  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 5. Look up product and lock with FOR UPDATE
    const normalizedCode = pCode.replace(/[^a-zA-Z0-9]/g, "");
    const [prodRows] = await conn.query(
      "SELECT * FROM products WHERE LOWER(id) = LOWER(?) OR LOWER(REPLACE(id, '-', '')) = LOWER(?) FOR UPDATE",
      [pCode, normalizedCode]
    );

    if (prodRows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, error: `Paint code "${pCode}" was not found.` });
    }

    const product = prodRows[0];
    const canonicalPaintId = product.id;
    const paintName = product.name;
    const brand = product.brand;

    // 6. Look up current warehouse_stock row with FOR UPDATE
    const [wsRows] = await conn.query(
      "SELECT * FROM warehouse_stock WHERE paint_id = ? AND warehouse = ? FOR UPDATE",
      [canonicalPaintId, whName]
    );

    let previousStock = 0;
    let newStock = 0;
    let wsId = null;
    const minQty = wsRows.length > 0 ? Number(wsRows[0].min_quantity || 15) : 15;

    if (wsRows.length > 0) {
      const existingWs = wsRows[0];
      wsId = existingWs.id;
      previousStock = Number(existingWs.quantity) || 0;
      newStock = previousStock + q;
      const status = newStock <= 0 ? "Out of Stock" : (newStock <= minQty ? "Low Stock" : "In Stock");

      await conn.query(
        "UPDATE warehouse_stock SET quantity = ?, status = ? WHERE id = ?",
        [newStock, status, wsId]
      );
    } else {
      previousStock = 0;
      newStock = q;
      const status = newStock <= 0 ? "Out of Stock" : (newStock <= minQty ? "Low Stock" : "In Stock");

      const [insertWs] = await conn.query(
        `INSERT INTO warehouse_stock (paint_id, paint_name, brand, warehouse, quantity, min_quantity, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [canonicalPaintId, paintName, brand, whName, newStock, minQty, status]
      );
      wsId = insertWs.insertId;
    }

    // 7. Synchronize total quantity in products table
    const [sumRows] = await conn.query(
      "SELECT COALESCE(SUM(quantity), 0) AS total_qty FROM warehouse_stock WHERE paint_id = ?",
      [canonicalPaintId]
    );
    const totalProductStock = Number(sumRows[0].total_qty);
    const prodStatus = totalProductStock <= 0 ? "Out of Stock" : (totalProductStock <= 15 ? "Low Stock" : "In Stock");

    await conn.query(
      "UPDATE products SET quantity = ?, status = ? WHERE id = ?",
      [totalProductStock, prodStatus, canonicalPaintId]
    );

    // 8. Record stock transaction entry
    const addedBy = req.user.name || req.user.username || req.user.email || req.user.role || "User";
    try {
      await conn.query(
        `INSERT INTO stock_transactions (paint_id, paint_name, warehouse, previous_stock, added_quantity, new_stock, added_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [canonicalPaintId, paintName, whName, previousStock, q, newStock, addedBy]
      );
    } catch (txErr) {
      console.warn("Notice: stock_transactions insert check:", txErr.message);
    }

    await conn.commit();
    conn.release();

    // 9. Return updated stock details to frontend
    return res.json({
      success: true,
      message: `✓ ${q} units successfully added to ${whName}.`,
      paintCode: canonicalPaintId,
      paintName: paintName,
      brand: brand,
      warehouse: whName,
      previousStock: previousStock,
      addedQuantity: q,
      newStock: newStock,
      totalProductStock: totalProductStock,
      addedBy: addedBy,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (rbErr) {}
      conn.release();
    }
    console.error("Add stock error:", error);
    return res.status(500).json({ success: false, error: "Failed to add stock due to database error." });
  }
}

module.exports = {
  getAllStock,
  updateStock,
  getWarehouses,
  getRecentStockAdditions,
  addStock
};
