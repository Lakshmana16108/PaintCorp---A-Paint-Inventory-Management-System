const { getPool } = require("../config/database");

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
 * GET /api/sales-report?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Aggregates live sales metrics, trends, top products, and status breakdowns from MySQL.
 */
async function getSalesReport(req, res) {
  const { from, to } = req.query;

  // 1. Validate inputs
  if (!from || !to) {
    return res.status(400).json({
      success: false,
      error: "Both 'from' and 'to' date parameters are required in YYYY-MM-DD format."
    });
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(from) || !dateRegex.test(to)) {
    return res.status(400).json({
      success: false,
      error: "Invalid date format. Expected YYYY-MM-DD."
    });
  }

  const startDate = new Date(`${from}T00:00:00Z`);
  const endDate = new Date(`${to}T00:00:00Z`);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.status(400).json({
      success: false,
      error: "Invalid date value provided."
    });
  }

  if (from > to) {
    return res.status(400).json({
      success: false,
      error: "From Date cannot be after To Date."
    });
  }

  try {
    const pool = getPool();

    // 2. Summary KPIs (Non-cancelled orders)
    // Orders count and total revenue from orders header
    const [ordersSummary] = await pool.query(
      `SELECT 
         COUNT(*) AS totalOrders,
         COALESCE(SUM(total_amount), 0) AS totalRevenue
       FROM orders
       WHERE order_date >= ? AND order_date <= ? AND status != 'Cancelled'`,
      [from, to]
    );

    // Quantity sold from order_items
    const [itemsSummary] = await pool.query(
      `SELECT 
         COALESCE(SUM(oi.quantity), 0) AS totalQuantity
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.order_date >= ? AND o.order_date <= ? AND o.status != 'Cancelled'`,
      [from, to]
    );

    const totalOrders = Number(ordersSummary[0]?.totalOrders || 0);
    const totalRevenue = Number(ordersSummary[0]?.totalRevenue || 0);
    const quantitySold = Number(itemsSummary[0]?.totalQuantity || 0);
    const averageOrderValue = totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0;

    // 3. Daily Sales aggregation from MySQL
    const [dailyRows] = await pool.query(
      `SELECT 
         DATE_FORMAT(order_date, '%Y-%m-%d') AS date,
         COALESCE(SUM(total_amount), 0) AS revenue,
         COUNT(id) AS ordersCount,
         COALESCE(SUM(quantity), 0) AS quantity
       FROM orders
       WHERE order_date >= ? AND order_date <= ? AND status != 'Cancelled'
       GROUP BY DATE_FORMAT(order_date, '%Y-%m-%d')
       ORDER BY date ASC`,
      [from, to]
    );

    const salesByDate = {};
    for (const r of dailyRows) {
      salesByDate[r.date] = {
        date: r.date,
        revenue: Number(r.revenue),
        ordersCount: Number(r.ordersCount),
        quantity: Number(r.quantity)
      };
    }

    // Zero-fill every single day between 'from' and 'to'
    const zeroFilledDailySales = [];
    const current = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);

    while (current <= end) {
      const dStr = toDateStr(current);
      if (salesByDate[dStr]) {
        zeroFilledDailySales.push(salesByDate[dStr]);
      } else {
        zeroFilledDailySales.push({
          date: dStr,
          revenue: 0,
          ordersCount: 0,
          quantity: 0
        });
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }

    // Determine granularity based on duration
    const diffDays = zeroFilledDailySales.length;
    let granularity = "daily";
    let timeline = zeroFilledDailySales;

    if (diffDays > 31 && diffDays <= 90) {
      granularity = "weekly";
      // Group by 7-day buckets
      const weeklyBuckets = [];
      for (let i = 0; i < zeroFilledDailySales.length; i += 7) {
        const chunk = zeroFilledDailySales.slice(i, i + 7);
        const startDateStr = chunk[0].date;
        const endDateStr = chunk[chunk.length - 1].date;
        const label = `${startDateStr.slice(5)} to ${endDateStr.slice(5)}`;
        const rev = chunk.reduce((sum, d) => sum + d.revenue, 0);
        const ords = chunk.reduce((sum, d) => sum + d.ordersCount, 0);
        const qty = chunk.reduce((sum, d) => sum + d.quantity, 0);
        weeklyBuckets.push({
          date: label,
          startDate: startDateStr,
          endDate: endDateStr,
          revenue: rev,
          ordersCount: ords,
          quantity: qty
        });
      }
      timeline = weeklyBuckets;
    } else if (diffDays > 90) {
      granularity = "monthly";
      // Group by YYYY-MM
      const monthlyMap = {};
      for (const item of zeroFilledDailySales) {
        const monthKey = item.date.slice(0, 7); // YYYY-MM
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = {
            date: monthKey,
            revenue: 0,
            ordersCount: 0,
            quantity: 0
          };
        }
        monthlyMap[monthKey].revenue += item.revenue;
        monthlyMap[monthKey].ordersCount += item.ordersCount;
        monthlyMap[monthKey].quantity += item.quantity;
      }
      timeline = Object.values(monthlyMap);
    }

    // 4. Top Selling Paints (ranked by quantity sold)
    const [topProductsRows] = await pool.query(
      `SELECT 
         oi.paint_id AS paintId,
         oi.paint_name AS paintName,
         COALESCE(SUM(oi.quantity), 0) AS quantity,
         COALESCE(SUM(oi.quantity * oi.price), 0) AS revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.order_date >= ? AND o.order_date <= ? AND o.status != 'Cancelled'
       GROUP BY oi.paint_id, oi.paint_name
       ORDER BY quantity DESC, revenue DESC
       LIMIT 10`,
      [from, to]
    );

    const topProducts = topProductsRows.map((p) => ({
      paintId: p.paintId,
      paintName: p.paintName,
      quantity: Number(p.quantity),
      revenue: Number(p.revenue)
    }));

    // 5. Revenue by Paint (ranked by revenue)
    const [revenueByProductRows] = await pool.query(
      `SELECT 
         oi.paint_id AS paintId,
         oi.paint_name AS paintName,
         COALESCE(SUM(oi.quantity * oi.price), 0) AS revenue,
         COALESCE(SUM(oi.quantity), 0) AS quantity
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.order_date >= ? AND o.order_date <= ? AND o.status != 'Cancelled'
       GROUP BY oi.paint_id, oi.paint_name
       ORDER BY revenue DESC, quantity DESC
       LIMIT 10`,
      [from, to]
    );

    const revenueByProduct = revenueByProductRows.map((p) => ({
      paintId: p.paintId,
      paintName: p.paintName,
      revenue: Number(p.revenue),
      quantity: Number(p.quantity)
    }));

    // 6. Order Status Breakdown (includes all statuses including Cancelled)
    const [statusRows] = await pool.query(
      `SELECT 
         status,
         COUNT(*) AS count,
         COALESCE(SUM(total_amount), 0) AS totalAmount
       FROM orders
       WHERE order_date >= ? AND order_date <= ?
       GROUP BY status
       ORDER BY count DESC`,
      [from, to]
    );

    const orderStatus = statusRows.map((s) => ({
      status: s.status,
      count: Number(s.count),
      totalAmount: Number(s.totalAmount)
    }));

    // 7. Sales Details List (filtered by date range, newest first)
    const [detailRows] = await pool.query(
      `SELECT 
         o.id AS orderId,
         DATE_FORMAT(o.order_date, '%Y-%m-%d') AS date,
         o.customer_name AS customerName,
         COALESCE(oi.paint_name, o.paint_name, 'Paint Product') AS paintName,
         COALESCE(oi.paint_id, o.paint_id, 'PNT001') AS paintId,
         COALESCE(oi.quantity, o.quantity, 1) AS quantity,
         COALESCE(oi.price * oi.quantity, o.total_amount, 0) AS amount,
         o.status AS status,
         o.created_at AS createdAt
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.order_date >= ? AND o.order_date <= ?
       ORDER BY o.order_date DESC, o.created_at DESC, oi.id ASC`,
      [from, to]
    );

    const details = detailRows.map((d, index) => ({
      id: `${d.orderId}-${index}`,
      orderId: d.orderId,
      date: d.date,
      customerName: d.customerName,
      paintName: d.paintName,
      paintId: d.paintId,
      quantity: Number(d.quantity),
      amount: Number(d.amount),
      status: d.status
    }));

    // 8. Return comprehensive, strictly database-driven sales report
    return res.json({
      success: true,
      filters: { from, to },
      summary: {
        totalRevenue,
        totalOrders,
        quantitySold,
        averageOrderValue
      },
      granularity,
      timeline,
      dailySales: zeroFilledDailySales,
      topProducts,
      revenueByProduct,
      orderStatus,
      details
    });
  } catch (error) {
    console.error("Sales report SQL error:", error);
    return res.status(500).json({
      success: false,
      error: "Unable to load sales data. Please try again."
    });
  }
}

module.exports = {
  getSalesReport
};
