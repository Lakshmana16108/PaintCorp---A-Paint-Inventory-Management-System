const { getPool } = require("../config/database");

/**
 * GET /api/orders
 * Fetch all customer orders
 */
async function getAllOrders(req, res) {
  try {
    const pool = getPool();
    const [rows] = await pool.query("SELECT * FROM orders ORDER BY order_date DESC");
    const formatted = rows.map(r => ({
      id: r.id,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      customerAddress: r.customer_address,
      paintName: r.paint_name,
      paintId: r.paint_id,
      quantity: r.quantity,
      price: Number(r.price),
      date: r.order_date,
      status: r.status
    }));
    return res.json(formatted);
  } catch (error) {
    console.error("Get orders error:", error);
    return res.status(500).json({ error: "Failed to fetch orders from database." });
  }
}

/**
 * POST /api/orders
 * Create a new customer order / invoice from Billing
 */
async function createOrder(req, res) {
  const { customerName, customerPhone, customerAddress, paintName, paintId, quantity, price, status } = req.body;

  if (!customerName || !customerPhone || !paintName || !quantity) {
    return res.status(400).json({ error: "Customer name, phone, paint item, and quantity are required." });
  }

  const orderId = `ORD${Math.floor(100 + Math.random() * 900)}`;
  const orderDate = new Date().toISOString().split("T")[0];
  const orderStatus = status || "Pending";

  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO orders (id, customer_name, customer_phone, customer_address, paint_name, paint_id, quantity, price, order_date, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, customerName, customerPhone, customerAddress || "", paintName, paintId || "PNT001", quantity, price || 0, orderDate, orderStatus]
    );

    const newOrder = {
      id: orderId,
      customerName,
      customerPhone,
      customerAddress,
      paintName,
      paintId,
      quantity: Number(quantity),
      price: Number(price),
      date: orderDate,
      status: orderStatus
    };

    return res.status(201).json(newOrder);
  } catch (error) {
    console.error("Create order error:", error);
    return res.status(500).json({ error: "Failed to create order in database." });
  }
}

/**
 * PUT /api/orders/:id/status
 * Update order logistics / delivery status
 */
async function updateOrderStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Order status is required." });
  }

  try {
    const pool = getPool();
    await pool.query("UPDATE orders SET status = ? WHERE id = ?", [status, id]);
    return res.json({ id, status });
  } catch (error) {
    console.error("Update order status error:", error);
    return res.status(500).json({ error: "Failed to update order status." });
  }
}

module.exports = {
  getAllOrders,
  createOrder,
  updateOrderStatus
};
