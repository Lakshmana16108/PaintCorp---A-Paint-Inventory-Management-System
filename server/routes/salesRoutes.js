const express = require("express");
const router = express.Router();
const { getSalesReport } = require("../controllers/salesController");
const authMiddleware = require("../middleware/authMiddleware");

// Protected sales report endpoint
router.get("/", authMiddleware, getSalesReport);
router.get("/report", authMiddleware, getSalesReport);

module.exports = router;
