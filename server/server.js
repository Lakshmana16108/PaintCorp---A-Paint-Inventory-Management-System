const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { initializeDatabase } = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const stockRoutes = require("./routes/stockRoutes");
const orderRoutes = require("./routes/orderRoutes");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Flexible CORS Configuration supporting Vercel, local dev, and FRONTEND_URL
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000"
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow non-browser requests (Postman, curl, server-to-server)
      if (!origin) return callback(null, true);

      // Allow request if origin matches allowed list, ends with .vercel.app, or is localhost
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        origin.includes("localhost")
      ) {
        return callback(null, true);
      }
      // Fallback allow origin dynamically to prevent CORS failure on Render
      return callback(null, true);
    },
    credentials: true
  })
);

// Body Parser Middleware
app.use(express.json({ limit: "50mb" })); // Increased limit to support base64 avatars
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { error: "Too many requests from this IP, please try again after 15 minutes." }
});

// Apply rate limiter to all API endpoints
app.use("/api/", apiLimiter);

// Root route
app.get("/", (req, res) => {
  res.json({ message: "PaintCorp ERP API is running." });
});

// Register routes
app.use("/api/auth", authRoutes);
app.use("/api/paints", productRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/orders", orderRoutes);

// Database initialization and server startup
async function startServer() {
  try {
    await initializeDatabase();
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
    
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use. Please free the port or set a different PORT in process.env.`);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error("Failed to start server due to database initialization failure:", error);
    process.exit(1);
  }
}

startServer();
