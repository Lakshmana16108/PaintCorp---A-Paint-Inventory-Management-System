const { processMessage } = require("../services/corpAI/aiService");

/**
 * POST /api/ai/chat
 * Main conversational interface for Corp AI.
 * Protected by JWT authentication middleware.
 */
async function chatWithAI(req, res) {
  try {
    const { message, conversationHistory } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "Message is required and cannot be empty."
      });
    }

    const result = await processMessage({
      message: message.trim(),
      conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : []
    });

    return res.json({
      success: true,
      answer: result.answer,
      source: result.source || "general",
      toolUsed: result.toolUsed || null,
      metadata: result.metadata || null
    });
  } catch (error) {
    console.error(`[Corp AI Controller Error] ${req.method} ${req.originalUrl || req.url}:`, {
      type: error.name || "AIProcessingError",
      message: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      success: false,
      error: "Unable to retrieve an answer right now. Please try again.",
      answer: "Corp AI is temporarily unable to process your request. Please try again shortly.",
      source: "system"
    });
  }
}

/**
 * GET /api/ai/status
 * Health-check endpoint for Corp AI
 */
function getAIStatus(req, res) {
  const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 5);
  return res.json({
    success: true,
    service: "Corp AI",
    status: "active",
    model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
    hasApiKey: hasKey,
    mode: hasKey ? "gemini-llm" : "live-mysql-engine"
  });
}

module.exports = {
  chatWithAI,
  getAIStatus
};
