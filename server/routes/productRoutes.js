const express = require("express");
const router = express.Router();
const { getAllPaints, createPaint, updatePaint, deletePaint } = require("../controllers/productController");
const authMiddleware = require("../middleware/authMiddleware");

// Read paints catalog
router.get("/", getAllPaints);

// Paint product mutation routes (protected)
router.post("/", authMiddleware, createPaint);
router.put("/:id", authMiddleware, updatePaint);
router.delete("/:id", authMiddleware, deletePaint);

module.exports = router;
