const path = require("path");

// Load server environment if present
try {
  require("dotenv").config({ path: path.join(__dirname, "..", "server", ".env") });
} catch (e) {}
require("dotenv").config();

const { app } = require("../server/server");
const { initializeDatabase } = require("../server/config/database");

let dbInitialized = false;

module.exports = async (req, res) => {
  // Ensure connection & socket objects are populated for serverless environments
  if (!req.socket) req.socket = {};
  if (!req.socket.remoteAddress) req.socket.remoteAddress = "127.0.0.1";
  if (!req.connection) req.connection = req.socket;

  if (!dbInitialized) {
    try {
      await initializeDatabase();
    } catch (err) {
      console.warn("[Vercel Serverless] DB initialization notice:", err.message);
    }
    dbInitialized = true;
  }

  return app(req, res);
};
