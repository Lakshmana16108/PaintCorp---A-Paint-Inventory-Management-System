const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { chatWithAI, getAIStatus } = require("../controllers/aiController");

// Health check endpoint (can be public or authenticated)
router.get("/status", getAIStatus);

// Main chat endpoint (strictly protected with JWT authentication)
router.post("/chat", authMiddleware, chatWithAI);

module.exports = router;
