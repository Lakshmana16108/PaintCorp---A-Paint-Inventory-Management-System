const { getPool } = require("../config/database");

/**
 * GET /api/paints
 * Fetch all paint products from MySQL
 */
async function getAllPaints(req, res) {
  try {
    const pool = getPool();
    let rows;
    try {
      [rows] = await pool.query("SELECT * FROM products ORDER BY created_at DESC");
    } catch (err) {
      [rows] = await pool.query("SELECT * FROM products ORDER BY id ASC");
    }

    const formatted = rows.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      color: p.color,
      finish: p.finish,
      price: Number(p.price),
      quantity: Number(p.quantity),
      status: p.status,
      created_at: p.created_at
    }));

    return res.json(formatted);
  } catch (error) {
    console.error("Get paints error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch paints from database." });
  }
}

/**
 * POST /api/paints
 * Create a new paint product and initialize its warehouse stock record in a transaction
 */
async function createPaint(req, res) {
  const { id, name, brand, category, color, finish, price, quantity, status } = req.body;

  if (!name || !brand || price === undefined) {
    return res.status(400).json({ success: false, error: "Product name, brand, and price are required." });
  }

  const paintId = id || `PNT${Math.floor(100 + Math.random() * 900)}`;
  const q = Number(quantity || 0);
  const calcStatus = status || (q <= 0 ? "Out of Stock" : q <= 15 ? "Low Stock" : "In Stock");

  const pool = getPool();
  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1. Insert into products catalog
    await conn.query(
      `INSERT INTO products (id, name, brand, category, color, finish, price, quantity, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [paintId, name, brand, category || "General", color || "White", finish || "Matte", price, q, calcStatus]
    );

    // 2. Discover default warehouse name from existing records
    const [whRows] = await conn.query("SELECT DISTINCT warehouse FROM warehouse_stock LIMIT 1");
    const defaultWarehouse = whRows[0]?.warehouse || "Central Warehouse - Tirunelveli";

    // 3. Insert default warehouse_stock entry
    await conn.query(
      `INSERT INTO warehouse_stock (paint_id, paint_name, brand, warehouse, quantity, min_quantity, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [paintId, name, brand, defaultWarehouse, q, 15, calcStatus]
    );

    await conn.commit();
    conn.release();

    const newPaint = {
      id: paintId,
      name,
      brand,
      category: category || "General",
      color: color || "White",
      finish: finish || "Matte",
      price: Number(price),
      quantity: q,
      status: calcStatus
    };
    return res.status(201).json(newPaint);
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (rbErr) {}
      conn.release();
    }
    console.error("Create paint error:", error);
    return res.status(500).json({ success: false, error: "Failed to create paint product." });
  }
}

/**
 * PUT /api/paints/:id
 * Update an existing paint product and synchronize warehouse stock
 */
async function updatePaint(req, res) {
  const { id } = req.params;
  const { name, brand, category, color, finish, price, quantity, status } = req.body;

  const pool = getPool();
  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [existing] = await conn.query("SELECT * FROM products WHERE id = ? FOR UPDATE", [id]);
    if (existing.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, error: `Product ${id} not found.` });
    }

    const q = quantity !== undefined ? Number(quantity) : existing[0].quantity;
    const calcStatus = status || (q <= 0 ? "Out of Stock" : q <= 15 ? "Low Stock" : "In Stock");

    await conn.query(
      `UPDATE products SET name = ?, brand = ?, category = ?, color = ?, finish = ?, price = ?, quantity = ?, status = ? WHERE id = ?`,
      [name, brand, category, color, finish, price, q, calcStatus, id]
    );

    // Update product name and brand in warehouse_stock
    await conn.query(
      `UPDATE warehouse_stock SET paint_name = ?, brand = ? WHERE paint_id = ?`,
      [name, brand, id]
    );

    // If quantity was explicitly edited, adjust warehouse_stock so total matches
    if (quantity !== undefined && Number(quantity) !== existing[0].quantity) {
      const [wsRows] = await conn.query(
        "SELECT id, quantity FROM warehouse_stock WHERE paint_id = ? ORDER BY id ASC LIMIT 1",
        [id]
      );
      if (wsRows.length > 0) {
        const [sumOther] = await conn.query(
          "SELECT COALESCE(SUM(quantity), 0) AS other_qty FROM warehouse_stock WHERE paint_id = ? AND id != ?",
          [id, wsRows[0].id]
        );
        const otherQty = Number(sumOther[0].other_qty);
        const newPrimaryQty = Math.max(0, q - otherQty);
        const wsStatus = newPrimaryQty <= 0 ? "Out of Stock" : (newPrimaryQty <= 15 ? "Low Stock" : "In Stock");
        await conn.query("UPDATE warehouse_stock SET quantity = ?, status = ? WHERE id = ?", [newPrimaryQty, wsStatus, wsRows[0].id]);
      } else {
        const [whRows] = await conn.query("SELECT DISTINCT warehouse FROM warehouse_stock LIMIT 1");
        const defaultWarehouse = whRows[0]?.warehouse || "Central Warehouse - Tirunelveli";
        await conn.query(
          `INSERT INTO warehouse_stock (paint_id, paint_name, brand, warehouse, quantity, min_quantity, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, name, brand, defaultWarehouse, q, 15, calcStatus]
        );
      }
    }

    await conn.commit();
    conn.release();

    const updated = {
      id,
      name,
      brand,
      category,
      color,
      finish,
      price: Number(price),
      quantity: q,
      status: calcStatus
    };
    return res.json(updated);
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (rbErr) {}
      conn.release();
    }
    console.error("Update paint error:", error);
    return res.status(500).json({ success: false, error: "Failed to update paint product." });
  }
}

/**
 * DELETE /api/paints/:id
 * Delete a paint product and associated warehouse stock
 */
async function deletePaint(req, res) {
  const { id } = req.params;

  const pool = getPool();
  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    await conn.query("DELETE FROM warehouse_stock WHERE paint_id = ?", [id]);
    await conn.query("DELETE FROM products WHERE id = ?", [id]);

    await conn.commit();
    conn.release();

    return res.json({ success: true, message: "Paint deleted successfully.", id });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (rbErr) {}
      conn.release();
    }
    console.error("Delete paint error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete paint product." });
  }
}

module.exports = {
  getAllPaints,
  createPaint,
  updatePaint,
  deletePaint
};
