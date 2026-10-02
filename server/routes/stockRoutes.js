const express = require("express");
const router = express.Router();
const { getAllStock, updateStock } = require("../controllers/stockController");
const authMiddleware = require("../middleware/authMiddleware");

// Read stock
router.get("/", getAllStock);

// Modify stock (protected)
router.put("/:id", authMiddleware, updateStock);

module.exports = router;
