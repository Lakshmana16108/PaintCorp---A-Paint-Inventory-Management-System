const express = require("express");
const router = express.Router();
const { getAllPaints, createPaint, updatePaint, deletePaint } = require("../controllers/productController");

router.get("/", getAllPaints);
router.post("/", createPaint);
router.put("/:id", updatePaint);
router.delete("/:id", deletePaint);

module.exports = router;
