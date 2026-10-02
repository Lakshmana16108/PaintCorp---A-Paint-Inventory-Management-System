const jwt = require("jsonwebtoken");
require("dotenv").config();

/**
 * Authentication Middleware to verify JWT token for protected operations.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ success: false, error: "Access denied. No token provided." });
  }

  try {
    const secret = process.env.JWT_SECRET || "your_jwt_secret_key_here";
    const decoded = jwt.verify(token, secret);
    req.user = decoded; // Attach user payload to request
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, error: "Token has expired." });
    }
    return res.status(403).json({ success: false, error: "Invalid token." });
  }
}

module.exports = authMiddleware;
