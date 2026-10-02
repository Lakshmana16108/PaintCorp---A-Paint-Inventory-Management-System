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

module.exports = {
  getAllStock,
  updateStock
};
