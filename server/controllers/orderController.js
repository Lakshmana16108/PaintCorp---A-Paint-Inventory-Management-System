const { getPool } = require("../config/database");

/**
 * Helper to format date values safely into YYYY-MM-DD
 */
function formatDate(d) {
  if (!d) return new Date().toISOString().split("T")[0];
  if (d instanceof Date) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(d).split("T")[0];
}

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
        date: formatDate(r.order_date),
        status: r.status
      };
    });

    return res.json(formatted);
  } catch (error) {
    console.error("Get orders error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch orders from database." });
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
      return res.status(404).json({ success: false, error: `Order ${id} not found.` });
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
      date: formatDate(r.order_date),
      status: r.status
    });
  } catch (error) {
    console.error("Get order by id error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch order from database." });
  }
}

/**
 * POST /api/orders
 * Create a new customer order / invoice from Billing.
 * Executed in a strict MySQL transaction with row locking (SELECT ... FOR UPDATE).
 * Validates stock across ALL items before committing any stock deduction or order insertion.
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
    return res.status(400).json({ success: false, error: "Customer name and phone number are required." });
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
    return res.status(400).json({ success: false, error: "Order must contain at least one product." });
  }

  // Validate item quantities
  for (const it of items) {
    if (isNaN(it.quantity) || it.quantity <= 0) {
      return res.status(400).json({ success: false, error: "Quantity for each product must be greater than zero." });
    }
  }

  // Aggregate requested quantities by paintId in case the same product appears multiple times
  const requestedByPaintId = {};
  for (const it of items) {
    requestedByPaintId[it.paintId] = (requestedByPaintId[it.paintId] || 0) + it.quantity;
  }

  const pool = getPool();
  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1. Sort paint IDs to prevent transaction deadlocks when locking rows
    const sortedPaintIds = Object.keys(requestedByPaintId).sort();

    // 2. Validate stock for ALL items before deducting anything
    for (const pid of sortedPaintIds) {
      const [prodRows] = await conn.query(
        "SELECT id, name, quantity, status FROM products WHERE id = ? FOR UPDATE",
        [pid]
      );

      if (prodRows.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ success: false, error: `Product SKU ${pid} not found in database.` });
      }

      const product = prodRows[0];
      const requiredQty = requestedByPaintId[pid];
      const availableQty = Number(product.quantity);

      if (availableQty < requiredQty) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for ${product.name}. Available quantity: ${availableQty}`,
          message: `Insufficient stock. Available quantity: ${availableQty}`,
          available: availableQty,
          required: requiredQty,
          paintId: pid,
          paintName: product.name
        });
      }
    }

    // 3. All items have sufficient stock -> Deduct stock for each product
    for (const pid of sortedPaintIds) {
      const deductQty = requestedByPaintId[pid];

      // Deduct from products catalog
      await conn.query(
        `UPDATE products 
         SET quantity = quantity - ?,
             status = CASE 
               WHEN quantity - ? <= 0 THEN 'Out of Stock'
               WHEN quantity - ? <= 15 THEN 'Low Stock'
               ELSE 'In Stock'
             END
         WHERE id = ?`,
        [deductQty, deductQty, deductQty, pid]
      );

      // Deduct from warehouse_stock
      const [wsRows] = await conn.query(
        "SELECT id, warehouse, quantity, min_quantity FROM warehouse_stock WHERE paint_id = ? ORDER BY id ASC FOR UPDATE",
        [pid]
      );

      let remainingDeduct = deductQty;
      for (const ws of wsRows) {
        if (remainingDeduct <= 0) break;
        if (ws.quantity > 0) {
          const deduct = Math.min(ws.quantity, remainingDeduct);
          const newWsQty = ws.quantity - deduct;
          const newWsStatus = newWsQty <= 0 ? "Out of Stock" : (newWsQty <= ws.min_quantity ? "Low Stock" : "In Stock");
          await conn.query(
            "UPDATE warehouse_stock SET quantity = ?, status = ? WHERE id = ?",
            [newWsQty, newWsStatus, ws.id]
          );
          remainingDeduct -= deduct;
        }
      }

      // If warehouse_stock had fewer units recorded than products table, adjust remaining
      if (remainingDeduct > 0 && wsRows.length > 0) {
        await conn.query(
          `UPDATE warehouse_stock 
           SET quantity = GREATEST(0, quantity - ?),
               status = CASE WHEN quantity - ? <= min_quantity THEN 'Low Stock' ELSE 'In Stock' END
           WHERE id = ?`,
          [remainingDeduct, remainingDeduct, wsRows[0].id]
        );
      }
    }

    // 4. Generate order ID and calculate amounts
    let orderId = id;
    if (!orderId) {
      orderId = `ORD${Math.floor(1000 + Math.random() * 9000)}`;
    }
    const [existing] = await conn.query("SELECT id FROM orders WHERE id = ?", [orderId]);
    if (existing.length > 0) {
      orderId = `ORD${Date.now().toString().slice(-6)}`;
    }

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

    // 5. Insert master Order record
    await conn.query(
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

    // 6. Insert Order Items records
    for (const item of items) {
      await conn.query(
        `INSERT INTO order_items (order_id, paint_id, paint_name, quantity, price) 
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.paintId, item.paintName, item.quantity, item.price]
      );
    }

    // 7. Commit Transaction
    await conn.commit();
    conn.release();

    const responseOrder = {
      success: true,
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
    if (conn) {
      try {
        await conn.rollback();
      } catch (rbErr) {}
      conn.release();
    }
    console.error("Create order transaction error:", error);
    return res.status(500).json({ success: false, error: "Unable to process order." });
  }
}

/**
 * PUT /api/orders/:id/status
 * Update order logistics / delivery status.
 * Safely handles status transitions in a MySQL transaction:
 * - Active -> Cancelled: Restores stock to MySQL products and warehouse_stock.
 * - Cancelled -> Cancelled (repeated): Protected! Does NOT restore stock again.
 * - Cancelled -> Active: Validates stock and re-deducts before changing status.
 */
async function updateOrderStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, error: "Order status is required." });
  }

  const pool = getPool();
  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1. Lock and check existing order
    const [orderRows] = await conn.query("SELECT * FROM orders WHERE id = ? FOR UPDATE", [id]);
    if (orderRows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, error: `Order ${id} not found.` });
    }

    const order = orderRows[0];
    const prevStatus = order.status;

    // Check if status is identical -> no changes needed
    if (prevStatus === status) {
      await conn.rollback();
      conn.release();
      return res.json({
        success: true,
        id,
        status,
        prevStatus,
        message: `Order status is already ${status}. No stock modification performed.`
      });
    }

    // 2. Fetch order items to determine products and quantities
    let [itemRows] = await conn.query("SELECT * FROM order_items WHERE order_id = ? FOR UPDATE", [id]);
    if (itemRows.length === 0 && order.paint_id) {
      itemRows = [
        {
          paint_id: order.paint_id,
          paint_name: order.paint_name || "Paint Product",
          quantity: order.quantity || 1
        }
      ];
    }

    // Aggregate quantities by paint_id
    const qtyByPaintId = {};
    for (const item of itemRows) {
      const pid = item.paint_id || order.paint_id;
      if (pid) {
        qtyByPaintId[pid] = (qtyByPaintId[pid] || 0) + Number(item.quantity);
      }
    }

    const sortedPaintIds = Object.keys(qtyByPaintId).sort();

    // 3. CASE A: Active -> Cancelled (Restore stock)
    if (status === "Cancelled" && prevStatus !== "Cancelled") {
      for (const pid of sortedPaintIds) {
        const restoreQty = qtyByPaintId[pid];

        // Restore to products table
        await conn.query(
          `UPDATE products 
           SET quantity = quantity + ?,
               status = CASE 
                 WHEN quantity + ? <= 0 THEN 'Out of Stock'
                 WHEN quantity + ? <= 15 THEN 'Low Stock'
                 ELSE 'In Stock'
               END
           WHERE id = ?`,
          [restoreQty, restoreQty, restoreQty, pid]
        );

        // Restore to warehouse_stock table (to primary warehouse entry)
        const [wsRows] = await conn.query(
          "SELECT id, quantity, min_quantity FROM warehouse_stock WHERE paint_id = ? ORDER BY id ASC LIMIT 1 FOR UPDATE",
          [pid]
        );

        if (wsRows.length > 0) {
          const ws = wsRows[0];
          const newWsQty = ws.quantity + restoreQty;
          const newWsStatus = newWsQty <= 0 ? "Out of Stock" : (newWsQty <= ws.min_quantity ? "Low Stock" : "In Stock");
          await conn.query(
            "UPDATE warehouse_stock SET quantity = ?, status = ? WHERE id = ?",
            [newWsQty, newWsStatus, ws.id]
          );
        }
      }
    }
    // 4. CASE B: Cancelled -> Active (Reopening a previously cancelled order)
    else if (prevStatus === "Cancelled" && status !== "Cancelled") {
      // Validate sufficient stock for ALL products before re-deducting
      for (const pid of sortedPaintIds) {
        const [prodRows] = await conn.query(
          "SELECT id, name, quantity FROM products WHERE id = ? FOR UPDATE",
          [pid]
        );
        if (prodRows.length === 0) {
          await conn.rollback();
          conn.release();
          return res.status(404).json({ success: false, error: `Product SKU ${pid} not found.` });
        }

        const product = prodRows[0];
        const requiredQty = qtyByPaintId[pid];
        if (Number(product.quantity) < requiredQty) {
          await conn.rollback();
          conn.release();
          return res.status(400).json({
            success: false,
            error: `Cannot reactivate order: Insufficient stock for ${product.name}. Available: ${product.quantity}, Required: ${requiredQty}`,
            available: product.quantity,
            required: requiredQty
          });
        }
      }

      // Re-deduct stock from products and warehouse_stock
      for (const pid of sortedPaintIds) {
        const deductQty = qtyByPaintId[pid];

        await conn.query(
          `UPDATE products 
           SET quantity = quantity - ?,
               status = CASE 
                 WHEN quantity - ? <= 0 THEN 'Out of Stock'
                 WHEN quantity - ? <= 15 THEN 'Low Stock'
                 ELSE 'In Stock'
               END
           WHERE id = ?`,
          [deductQty, deductQty, deductQty, pid]
        );

        const [wsRows] = await conn.query(
          "SELECT id, quantity, min_quantity FROM warehouse_stock WHERE paint_id = ? ORDER BY id ASC FOR UPDATE",
          [pid]
        );

        let rem = deductQty;
        for (const ws of wsRows) {
          if (rem <= 0) break;
          if (ws.quantity > 0) {
            const d = Math.min(ws.quantity, rem);
            const newQty = ws.quantity - d;
            const newStatus = newQty <= 0 ? "Out of Stock" : (newQty <= ws.min_quantity ? "Low Stock" : "In Stock");
            await conn.query("UPDATE warehouse_stock SET quantity = ?, status = ? WHERE id = ?", [newQty, newStatus, ws.id]);
            rem -= d;
          }
        }
        if (rem > 0 && wsRows.length > 0) {
          await conn.query("UPDATE warehouse_stock SET quantity = GREATEST(0, quantity - ?) WHERE id = ?", [rem, wsRows[0].id]);
        }
      }
    }
    // 5. CASE C: Active -> Active (e.g. Pending -> Processing -> Delivered)
    // No stock modification needed

    // Update order status in MySQL
    await conn.query("UPDATE orders SET status = ? WHERE id = ?", [status, id]);

    await conn.commit();
    conn.release();

    return res.json({ success: true, id, status, prevStatus });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (rbErr) {}
      conn.release();
    }
    console.error("Update order status transaction error:", error);
    return res.status(500).json({ success: false, error: "Unable to update order status." });
  }
}

module.exports = {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrderStatus
};
