const express = require("express");
const router = express.Router();
const { getAllOrders, getOrderById, createOrder, updateOrderStatus } = require("../controllers/orderController");
const authMiddleware = require("../middleware/authMiddleware");

// Read routes
router.get("/", getAllOrders);
router.get("/:id", getOrderById);

// Inventory mutation routes (protected)
router.post("/", authMiddleware, createOrder);
router.put("/:id/status", authMiddleware, updateOrderStatus);

module.exports = router;
