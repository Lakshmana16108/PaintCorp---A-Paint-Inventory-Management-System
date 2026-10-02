const express = require("express");
const router = express.Router();
const { getAllStock, updateStock } = require("../controllers/stockController");

router.get("/", getAllStock);
router.put("/:id", updateStock);

module.exports = router;
