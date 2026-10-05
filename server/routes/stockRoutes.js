const express = require("express");
const router = express.Router();
const {
  getAllStock,
  updateStock,
  addStock,
  getRecentStockAdditions,
  getWarehouses
} = require("../controllers/stockController");
const authMiddleware = require("../middleware/authMiddleware");

// Read stock
router.get("/", getAllStock);
router.get("/warehouses", getWarehouses);
router.get("/recent-additions", authMiddleware, getRecentStockAdditions);

// Add stock continuously (protected)
router.post("/add", authMiddleware, addStock);

// Modify stock (protected)
router.put("/:id", authMiddleware, updateStock);

module.exports = router;
