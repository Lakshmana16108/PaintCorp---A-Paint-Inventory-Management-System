const { getPool } = require("../config/database");

/**
 * GET /api/paints
 * Fetch all paint products
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
    return res.json(rows);
  } catch (error) {
    console.error("Get paints error:", error);
    return res.status(500).json({ error: "Failed to fetch paints from database." });
  }
}

/**
 * POST /api/paints
 * Create a new paint product
 */
async function createPaint(req, res) {
  const { id, name, brand, category, color, finish, price, quantity, status } = req.body;

  if (!name || !brand || price === undefined) {
    return res.status(400).json({ error: "Product name, brand, and price are required." });
  }

  const paintId = id || `PNT${Math.floor(100 + Math.random() * 900)}`;
  const calcStatus = status || (quantity <= 0 ? "Out of Stock" : quantity <= 15 ? "Low Stock" : "In Stock");

  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO products (id, name, brand, category, color, finish, price, quantity, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [paintId, name, brand, category || "General", color || "White", finish || "Matte", price, quantity || 0, calcStatus]
    );

    const newPaint = { id: paintId, name, brand, category, color, finish, price: Number(price), quantity: Number(quantity || 0), status: calcStatus };
    return res.status(201).json(newPaint);
  } catch (error) {
    console.error("Create paint error:", error);
    return res.status(500).json({ error: "Failed to create paint product." });
  }
}

/**
 * PUT /api/paints/:id
 * Update an existing paint product
 */
async function updatePaint(req, res) {
  const { id } = req.params;
  const { name, brand, category, color, finish, price, quantity, status } = req.body;

  try {
    const pool = getPool();
    const calcStatus = status || (quantity <= 0 ? "Out of Stock" : quantity <= 15 ? "Low Stock" : "In Stock");

    await pool.query(
      `UPDATE products SET name = ?, brand = ?, category = ?, color = ?, finish = ?, price = ?, quantity = ?, status = ? WHERE id = ?`,
      [name, brand, category, color, finish, price, quantity, calcStatus, id]
    );

    const updated = { id, name, brand, category, color, finish, price: Number(price), quantity: Number(quantity), status: calcStatus };
    return res.json(updated);
  } catch (error) {
    console.error("Update paint error:", error);
    return res.status(500).json({ error: "Failed to update paint product." });
  }
}

/**
 * DELETE /api/paints/:id
 * Delete a paint product
 */
async function deletePaint(req, res) {
  const { id } = req.params;

  try {
    const pool = getPool();
    await pool.query("DELETE FROM products WHERE id = ?", [id]);
    return res.json({ message: "Paint deleted successfully.", id });
  } catch (error) {
    console.error("Delete paint error:", error);
    return res.status(500).json({ error: "Failed to delete paint product." });
  }
}

module.exports = {
  getAllPaints,
  createPaint,
  updatePaint,
  deletePaint
};
