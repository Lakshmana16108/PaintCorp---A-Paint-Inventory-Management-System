const { getPool } = require("../config/database");

/**
 * GET /api/orders
 * Fetch all customer orders with order items
 */
async function getAllOrders(req, res) {
  try {
    const pool = getPool();
    const [rows] = await pool.query("SELECT * FROM orders ORDER BY order_date DESC, created_at DESC");

    let itemRows = [];
    try {
      [itemRows] = await pool.query("SELECT * FROM order_items ORDER BY id ASC");
    } catch (err) {
      itemRows = [];
    }

    const itemsByOrderId = {};
    for (const item of itemRows) {
      if (!itemsByOrderId[item.order_id]) {
        itemsByOrderId[item.order_id] = [];
      }
      itemsByOrderId[item.order_id].push({
        id: item.id,
        orderId: item.order_id,
        paintId: item.paint_id,
        paintName: item.paint_name,
        quantity: Number(item.quantity),
        price: Number(item.price),
        amount: Number(item.quantity) * Number(item.price)
      });
    }

    const formatted = rows.map((r) => {
      const items =
        itemsByOrderId[r.id] && itemsByOrderId[r.id].length > 0
          ? itemsByOrderId[r.id]
          : [
              {
                id: 1,
                orderId: r.id,
                paintId: r.paint_id || "PNT001",
                paintName: r.paint_name || "Paint Product",
                quantity: Number(r.quantity) || 1,
                price: Number(r.price) || 0,
                amount: (Number(r.quantity) || 1) * (Number(r.price) || 0)
              }
            ];

      const totalAmount =
        r.total_amount !== null && r.total_amount !== undefined && Number(r.total_amount) > 0
          ? Number(r.total_amount)
          : items.reduce((sum, it) => sum + it.quantity * it.price, 0);

      const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0);

      return {
        id: r.id,
        customerName: r.customer_name,
        customerPhone: r.customer_phone,
        customerAddress: r.customer_address,
        paintName: items.map((it) => it.paintName).join(", "),
        paintId: items[0]?.paintId || r.paint_id || "PNT001",
        quantity: items.length > 1 ? 1 : totalQuantity,
        totalQuantity,
        price: totalAmount,
        totalAmount,
        items,
        date: r.order_date,
        status: r.status
      };
    });

    return res.json(formatted);
  } catch (error) {
    console.error("Get orders error:", error);
    return res.status(500).json({ error: "Failed to fetch orders from database." });
  }
}

/**
 * GET /api/orders/:id
 * Fetch a single order with its items
 */
async function getOrderById(req, res) {
  const { id } = req.params;
  try {
    const pool = getPool();
    const [rows] = await pool.query("SELECT * FROM orders WHERE id = ?", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: `Order ${id} not found.` });
    }

    const r = rows[0];
    let itemRows = [];
    try {
      [itemRows] = await pool.query("SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC", [id]);
    } catch (err) {
      itemRows = [];
    }

    const items =
      itemRows.length > 0
        ? itemRows.map((it) => ({
            id: it.id,
            orderId: it.order_id,
            paintId: it.paint_id,
            paintName: it.paint_name,
            quantity: Number(it.quantity),
            price: Number(it.price),
            amount: Number(it.quantity) * Number(it.price)
          }))
        : [
            {
              id: 1,
              orderId: r.id,
              paintId: r.paint_id || "PNT001",
              paintName: r.paint_name || "Paint Product",
              quantity: Number(r.quantity) || 1,
              price: Number(r.price) || 0,
              amount: (Number(r.quantity) || 1) * (Number(r.price) || 0)
            }
          ];

    const totalAmount =
      r.total_amount !== null && r.total_amount !== undefined && Number(r.total_amount) > 0
        ? Number(r.total_amount)
        : items.reduce((sum, it) => sum + it.quantity * it.price, 0);

    const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0);

    return res.json({
      id: r.id,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      customerAddress: r.customer_address,
      paintName: items.map((it) => it.paintName).join(", "),
      paintId: items[0]?.paintId || r.paint_id || "PNT001",
      quantity: items.length > 1 ? 1 : totalQuantity,
      totalQuantity,
      price: totalAmount,
      totalAmount,
      items,
      date: r.order_date,
      status: r.status
    });
  } catch (error) {
    console.error("Get order by id error:", error);
    return res.status(500).json({ error: "Failed to fetch order from database." });
  }
}

/**
 * POST /api/orders
 * Create a new customer order / invoice from Billing.
 * One checkout transaction creates ONE Order ID with one or more order items.
 */
async function createOrder(req, res) {
  const {
    id,
    customerName,
    customerPhone,
    customerAddress,
    customerGst,
    items: incomingItems,
    paintName,
    paintId,
    quantity,
    price,
    totalAmount: incomingTotalAmount,
    status,
    date
  } = req.body;

  if (!customerName || !customerPhone) {
    return res.status(400).json({ error: "Customer name and phone number are required." });
  }

  // Normalize items array: support multi-item orders as well as legacy single item requests
  const items =
    Array.isArray(incomingItems) && incomingItems.length > 0
      ? incomingItems.map((it) => ({
          paintId: it.paintId || "PNT001",
          paintName: it.paintName || "Paint Product",
          quantity: Number(it.quantity) || 1,
          price: Number(it.price) || 0
        }))
      : [
          {
            paintId: paintId || "PNT001",
            paintName: paintName || "Paint Product",
            quantity: Number(quantity) || 1,
            price: Number(price) || 0
          }
        ];

  if (items.length === 0) {
    return res.status(400).json({ error: "Order must contain at least one product." });
  }

  const orderId = id || `ORD${Math.floor(100 + Math.random() * 900)}`;
  const orderDate = date || new Date().toISOString().split("T")[0];
  const orderStatus = status || "Pending";

  const calculatedTotal = items.reduce((sum, it) => sum + it.quantity * it.price, 0);
  const totalAmount =
    incomingTotalAmount !== undefined && incomingTotalAmount !== null
      ? Number(incomingTotalAmount)
      : calculatedTotal;
  const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0);
  const allPaintNames = items.map((it) => it.paintName).join(", ");
  const primaryPaintId = items[0]?.paintId || "PNT001";

  try {
    const pool = getPool();

    // 1. Insert master Order record
    await pool.query(
      `INSERT INTO orders (id, customer_name, customer_phone, customer_address, paint_name, paint_id, quantity, price, order_date, status, total_amount) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        customerName,
        customerPhone,
        customerAddress || "",
        allPaintNames,
        primaryPaintId,
        items.length > 1 ? 1 : totalQuantity,
        totalAmount,
        orderDate,
        orderStatus,
        totalAmount
      ]
    );

    // 2. Insert Order Items records
    for (const item of items) {
      await pool.query(
        `INSERT INTO order_items (order_id, paint_id, paint_name, quantity, price) 
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.paintId, item.paintName, item.quantity, item.price]
      );
    }

    // 3. Sync database warehouse stock (deduct for Central Warehouse A)
    try {
      for (const item of items) {
        await pool.query(
          `UPDATE warehouse_stock SET quantity = GREATEST(0, quantity - ?) 
           WHERE paint_id = ? AND warehouse = 'Central Warehouse A'`,
          [item.quantity, item.paintId]
        );
        await pool.query(
          `UPDATE products p 
           SET quantity = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE paint_id = p.id) 
           WHERE p.id = ?`,
          [item.paintId]
        );
      }
    } catch (stockErr) {
      console.warn("Notice: warehouse stock sync during order creation:", stockErr.message);
    }

    const responseOrder = {
      id: orderId,
      customerName,
      customerPhone,
      customerAddress: customerAddress || "",
      customerGst: customerGst || "",
      paintName: allPaintNames,
      paintId: primaryPaintId,
      quantity: items.length > 1 ? 1 : totalQuantity,
      totalQuantity,
      price: totalAmount,
      totalAmount,
      items: items.map((it, idx) => ({
        id: idx + 1,
        orderId,
        paintId: it.paintId,
        paintName: it.paintName,
        quantity: it.quantity,
        price: it.price,
        amount: it.quantity * it.price
      })),
      date: orderDate,
      status: orderStatus
    };

    return res.status(201).json(responseOrder);
  } catch (error) {
    console.error("Create order error:", error);
    return res.status(500).json({ error: "Failed to create order in database." });
  }
}

/**
 * PUT /api/orders/:id/status
 * Update order logistics / delivery status for the entire order
 */
async function updateOrderStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Order status is required." });
  }

  try {
    const pool = getPool();

    // Check existing status before update to handle cancellation stock restoration
    const [orderRows] = await pool.query("SELECT status FROM orders WHERE id = ?", [id]);
    const prevStatus = orderRows[0]?.status;

    await pool.query("UPDATE orders SET status = ? WHERE id = ?", [status, id]);

    // Handle inventory restoration if status changed to Cancelled
    if (status === "Cancelled" && prevStatus !== "Cancelled") {
      try {
        const [itemRows] = await pool.query("SELECT * FROM order_items WHERE order_id = ?", [id]);
        for (const item of itemRows) {
          await pool.query(
            `UPDATE warehouse_stock SET quantity = quantity + ? 
             WHERE paint_id = ? AND warehouse = 'Central Warehouse A'`,
            [item.quantity, item.paint_id]
          );
          await pool.query(
            `UPDATE products p 
             SET quantity = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE paint_id = p.id) 
             WHERE p.id = ?`,
            [item.paint_id]
          );
        }
      } catch (restockErr) {
        console.warn("Notice: warehouse stock sync during order cancellation:", restockErr.message);
      }
    } else if (prevStatus === "Cancelled" && status !== "Cancelled") {
      // Re-deduct if uncancelled
      try {
        const [itemRows] = await pool.query("SELECT * FROM order_items WHERE order_id = ?", [id]);
        for (const item of itemRows) {
          await pool.query(
            `UPDATE warehouse_stock SET quantity = GREATEST(0, quantity - ?) 
             WHERE paint_id = ? AND warehouse = 'Central Warehouse A'`,
            [item.quantity, item.paint_id]
          );
          await pool.query(
            `UPDATE products p 
             SET quantity = (SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE paint_id = p.id) 
             WHERE p.id = ?`,
            [item.paint_id]
          );
        }
      } catch (restockErr) {
        console.warn("Notice: warehouse stock sync during order re-activation:", restockErr.message);
      }
    }

    return res.json({ id, status });
  } catch (error) {
    console.error("Update order status error:", error);
    return res.status(500).json({ error: "Failed to update order status." });
  }
}

module.exports = {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrderStatus
};

