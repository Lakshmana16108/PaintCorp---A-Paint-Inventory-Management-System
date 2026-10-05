const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

// All admin routes require valid JWT auth + Administrator role verification
router.use(authMiddleware);
router.use(adminMiddleware);

// Admin dashboard unified metrics
router.get("/dashboard", adminController.getAdminDashboardData);

// Admin user management
router.get("/users", adminController.getAllUsers);
router.put("/users/:id", adminController.updateUser);
router.patch("/users/:id/status", adminController.toggleUserStatus);
router.put("/users/:id/status", adminController.toggleUserStatus);

module.exports = router;
