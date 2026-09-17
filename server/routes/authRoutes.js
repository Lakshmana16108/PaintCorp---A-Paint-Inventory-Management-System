const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

// Guest routes
router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/verify-reset-otp", authController.verifyResetOTP);
router.post("/reset-password", authController.resetPassword);

// Protected routes (require JWT verification)
router.post("/change-password", authMiddleware, authController.changePassword);
router.get("/me", authMiddleware, authController.getMe);

module.exports = router;
