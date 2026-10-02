const { getPool } = require("../config/database");

/**
 * GET /api/stock
 * Fetch all warehouse stock levels
 */
async function getAllStock(req, res) {
  try {
    const pool = getPool();
    const [rows] = await pool.query("SELECT * FROM warehouse_stock ORDER BY id ASC");
    // Format to match frontend expected props
    const formatted = rows.map(r => ({
      id: r.id,
      paintId: r.paint_id,
      paintName: r.paint_name,
      brand: r.brand,
      warehouse: r.warehouse,
      quantity: r.quantity,
      minQuantity: r.min_quantity,
      status: r.status
    }));
    return res.json(formatted);
  } catch (error) {
    console.error("Get stock error:", error);
    return res.status(500).json({ error: "Failed to fetch stock from database." });
  }
}

/**
 * PUT /api/stock/:id
 * Update warehouse stock quantity
 */
async function updateStock(req, res) {
  const { id } = req.params;
  const { quantity, minQuantity } = req.body;

  try {
    const pool = getPool();
    const q = Number(quantity);
    const minQ = Number(minQuantity || 15);
    const status = q <= minQ ? "Low Stock" : "In Stock";

    await pool.query(
      `UPDATE warehouse_stock SET quantity = ?, min_quantity = ?, status = ? WHERE id = ?`,
      [q, minQ, status, id]
    );

    return res.json({ id, quantity: q, minQuantity: minQ, status });
  } catch (error) {
    console.error("Update stock error:", error);
    return res.status(500).json({ error: "Failed to update warehouse stock." });
  }
}

module.exports = {
  getAllStock,
  updateStock
};
