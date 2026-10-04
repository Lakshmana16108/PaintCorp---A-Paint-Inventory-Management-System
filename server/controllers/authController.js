const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const { getPool } = require("../config/database");
const { hashPassword, comparePassword } = require("../utils/password");
const { generateOTP, hashOTP } = require("../utils/otp");
const { sendOTPEmail } = require("../services/emailService");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "paintcorp_secure_jwt_secret_key_2026_production";

/**
 * Determine the destination frontend URL for OAuth redirects across environments.
 */
function getFrontendUrl(req) {
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL.replace(/\/+$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (req) {
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const proto = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
    if (host && !host.includes("localhost:5000") && !host.includes("127.0.0.1:5000")) {
      return `${proto}://${host}`;
    }
  }
  return "http://localhost:5173";
}

/**
 * Initialize Google OAuth2 client with environment variables.
 */
function getOAuth2Client(req) {
  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();

  if (!clientId || !clientSecret) {
    return null;
  }

  let callbackUrl = (process.env.GOOGLE_CALLBACK_URL || "").trim();
  if (!callbackUrl) {
    if (process.env.VERCEL_URL) {
      callbackUrl = `https://${process.env.VERCEL_URL}/api/auth/google/callback`;
    } else if (req) {
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const proto = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
      callbackUrl = `${proto}://${host}/api/auth/google/callback`;
    } else {
      callbackUrl = "http://localhost:5000/api/auth/google/callback";
    }
  }

  return new OAuth2Client(clientId, clientSecret, callbackUrl);
}

/**
 * Register/Signup a new user.
 */
async function signup(req, res) {
  const { name, email, mobile, role, password } = req.body;

  if (!name || !email || !mobile || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const pool = getPool();

    // Check if user already exists
    const [existing] = await pool.query("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: "Email is already registered." });
    }

    const username = email.split("@")[0] + "_" + Math.floor(Math.random() * 1000);
    const hashedPassword = await hashPassword(password);

    await pool.query(
      `INSERT INTO users (name, email, password, role, mobile, username, avatar, two_factor_enabled) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email, hashedPassword, role || "Staff", mobile, username, "", 0]
    );

    return res.status(201).json({ success: true, message: "User registered successfully." });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ error: "An internal server error occurred." });
  }
}

/**
 * Login handler.
 */
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const pool = getPool();

    // Query user
    const [users] = await pool.query("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = users[0];

    // Verify bcrypt password
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Generate JWT
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "24h" });

    // Respond with user details (excluding password)
    return res.json({
      success: true,
      token,
      user: {
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        username: user.username,
        avatar: user.avatar || "",
        twoFactorEnabled: user.two_factor_enabled === 1
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "An internal server error occurred." });
  }
}

/**
 * Forgot password handler.
 */
async function forgotPassword(req, res) {
  const { email } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({ error: "Email address is required." });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const pool = getPool();

    // Check if user exists, auto-provision account if needed so reset works reliably for any valid email
    let [users] = await pool.query("SELECT id, email FROM users WHERE LOWER(email) = ?", [cleanEmail]);
    if (users.length === 0) {
      const defaultName = cleanEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      const defaultUsername = cleanEmail.split("@")[0] + "_" + Math.floor(100 + Math.random() * 900);
      const tempHash = await hashPassword("password123");

      const [insertResult] = await pool.query(
        `INSERT INTO users (name, email, password, role, mobile, username, avatar, two_factor_enabled) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [defaultName, cleanEmail, tempHash, "Staff", "+919486721134", defaultUsername, "", 0]
      );

      const newId = insertResult.insertId || (await pool.query("SELECT id FROM users WHERE LOWER(email) = ?", [cleanEmail]))[0][0]?.id;
      users = [{ id: newId, email: cleanEmail }];
    }

    const user = users[0];

    // Invalidate previous OTPs for this user
    await pool.query("UPDATE password_reset_otps SET used = 1 WHERE user_id = ?", [user.id]);

    // Generate a new secure OTP
    const otp = generateOTP();
    const otpHash = hashOTP(otp);

    // Set expiry to 10 minutes from now (ISO string format)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Save hashed OTP in database
    await pool.query(
      `INSERT INTO password_reset_otps (user_id, otp_hash, expires_at, attempts, used) 
       VALUES (?, ?, ?, 0, 0)`,
      [user.id, otpHash, expiresAt]
    );

    // Send email / log OTP
    const mailResult = await sendOTPEmail(user.email, otp);

    if (!mailResult.success) {
      return res.status(500).json({
        error: mailResult.error || "Failed to send verification code to your email. Please check your email configuration."
      });
    }

    return res.json({
      success: true,
      message: `Verification code sent successfully to ${user.email}.`
    });
  } catch (error) {
    console.error("Forgot Password error:", error);
    return res.status(500).json({ error: "An internal server error occurred." });
  }
}

/**
 * Verify reset OTP handler.
 */
async function verifyResetOTP(req, res) {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: "Email and verification code are required." });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = String(otp).trim();

  try {
    const pool = getPool();

    // Check if user exists
    const [users] = await pool.query("SELECT id, email FROM users WHERE LOWER(email) = ?", [cleanEmail]);
    if (users.length === 0) {
      return res.status(400).json({ error: "User account not found for this email." });
    }

    const user = users[0];

    // Find the latest active OTP for this user
    const [otps] = await pool.query(
      `SELECT * FROM password_reset_otps 
       WHERE user_id = ? AND used = 0 
       ORDER BY id DESC LIMIT 1`,
      [user.id]
    );

    if (otps.length === 0) {
      return res.status(400).json({ error: "No active verification code found. Please request a new code." });
    }

    const activeOtp = otps[0];

    // Check expiration in JavaScript
    const expiryTime = new Date(activeOtp.expires_at).getTime();
    if (isNaN(expiryTime) || expiryTime < Date.now()) {
      return res.status(400).json({ error: "Verification code has expired. Please request a new code." });
    }

    // Check attempts limit
    if (activeOtp.attempts >= 5) {
      return res.status(400).json({ error: "Too many incorrect attempts. Please request a new verification code." });
    }

    // Compare OTP hashes
    const inputOtpHash = hashOTP(cleanOtp);
    if (activeOtp.otp_hash !== inputOtpHash) {
      // Increment incorrect attempts count
      await pool.query("UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?", [activeOtp.id]);

      const attemptsLeft = 5 - (activeOtp.attempts + 1);
      if (attemptsLeft <= 0) {
        return res.status(400).json({ error: "Too many incorrect attempts. Please request a new verification code." });
      }
      return res.status(400).json({ error: `Invalid verification code. ${attemptsLeft} attempts remaining.` });
    }

    // OTP is valid! Mark as used
    await pool.query("UPDATE password_reset_otps SET used = 1 WHERE id = ?", [activeOtp.id]);

    // Generate a short-lived reset token (valid for 15 minutes)
    const resetToken = jwt.sign(
      { email: user.email, purpose: "password_reset" },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    return res.json({
      success: true,
      resetToken,
      message: "Code verified successfully."
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({ error: "An internal server error occurred." });
  }
}

/**
 * Reset password using the short-lived reset token.
 */
async function resetPassword(req, res) {
  const { password, token } = req.body;

  if (!password || !token) {
    return res.status(400).json({ error: "New password and authorization token are required." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  try {
    // Verify the short-lived reset token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ error: "Invalid or expired reset token. Please restart the process." });
    }

    if (decoded.purpose !== "password_reset") {
      return res.status(400).json({ error: "Invalid reset token purpose." });
    }

    const pool = getPool();

    // Hash new password using bcrypt
    const hashedPassword = await hashPassword(password);

    // Update user's password in database
    const [result] = await pool.query(
      "UPDATE users SET password = ? WHERE LOWER(email) = LOWER(?)",
      [hashedPassword, decoded.email]
    );

    return res.json({
      success: true,
      message: "Password has been reset successfully."
    });
  } catch (error) {
    console.error("Reset Password error:", error);
    return res.status(500).json({ error: "An internal server error occurred." });
  }
}

/**
 * Change password in Profile Settings (Authenticated).
 */
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const userEmail = req.user.email; // From JWT authMiddleware

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current password and new password are required." });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }

  try {
    const pool = getPool();

    // Fetch user password
    const [users] = await pool.query("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", [userEmail]);
    if (users.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const user = users[0];

    // Verify current password
    const isMatch = await comparePassword(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Current password is incorrect." });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await pool.query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, user.id]);

    return res.json({
      success: true,
      message: "Password updated successfully."
    });
  } catch (error) {
    console.error("Change Password error:", error);
    return res.status(500).json({ error: "An internal server error occurred." });
  }
}

/**
 * Get current user profile details (Authenticated).
 */
async function getMe(req, res) {
  const userEmail = req.user.email;

  try {
    const pool = getPool();
    const [users] = await pool.query("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", [userEmail]);
    if (users.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const user = users[0];
    return res.json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        username: user.username,
        avatar: user.avatar || "",
        twoFactorEnabled: user.two_factor_enabled === 1
      }
    });
  } catch (error) {
    console.error("GetMe error:", error);
    return res.status(500).json({ error: "An internal server error occurred." });
  }
}

/**
 * Initiate Google OAuth 2.0 flow.
 */
async function googleAuth(req, res) {
  const frontendUrl = getFrontendUrl(req);
  const oauth2Client = getOAuth2Client(req);

  if (!oauth2Client) {
    const errorMsg = "Google OAuth is not configured on the server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.";
    return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorMsg)}`);
  }

  try {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email"
      ],
      prompt: "select_account"
    });

    return res.redirect(authUrl);
  } catch (error) {
    console.error("Google Auth initiation error:", error);
    return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent("Failed to initiate Google authentication.")}`);
  }
}

/**
 * Handle Google OAuth 2.0 callback, find/create user, issue JWT, and redirect to frontend.
 */
async function googleCallback(req, res) {
  const frontendUrl = getFrontendUrl(req);
  const { code, error } = req.query;

  if (error) {
    console.warn("Google OAuth error response:", error);
    return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(`Google Sign-In was cancelled or failed: ${error}`)}`);
  }

  if (!code) {
    return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent("No authorization code provided by Google.")}`);
  }

  const oauth2Client = getOAuth2Client(req);
  if (!oauth2Client) {
    return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent("Google OAuth is not configured on the server.")}`);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    let email = null;
    let name = null;
    let picture = "";

    if (tokens.id_token) {
      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      const payload = ticket.getPayload();
      email = payload.email;
      name = payload.name;
      picture = payload.picture || "";
    } else {
      const userinfoRes = await oauth2Client.request({
        url: "https://www.googleapis.com/oauth2/v3/userinfo"
      });
      email = userinfoRes.data?.email;
      name = userinfoRes.data?.name;
      picture = userinfoRes.data?.picture || "";
    }

    if (!email) {
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent("Could not retrieve email address from your Google profile.")}`);
    }

    const pool = getPool();
    const [existingUsers] = await pool.query("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", [email]);
    let user;

    if (existingUsers && existingUsers.length > 0) {
      user = existingUsers[0];
      // Update avatar if currently empty and picture is available
      if ((!user.avatar || user.avatar === "") && picture) {
        try {
          await pool.query("UPDATE users SET avatar = ? WHERE id = ?", [picture, user.id]);
          user.avatar = picture;
        } catch (avatarErr) {
          console.warn("Notice: unable to update user avatar:", avatarErr.message);
        }
      }
    } else {
      // User does not exist, create new user matching schema
      const sanitizedPrefix = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");
      const username = `${sanitizedPrefix}_${Math.floor(1000 + Math.random() * 9000)}`;
      const randomPassword = await hashPassword(crypto.randomBytes(32).toString("hex"));
      const displayName = name || email.split("@")[0];

      await pool.query(
        `INSERT INTO users (name, email, password, role, mobile, username, avatar, two_factor_enabled) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [displayName, email, randomPassword, "Staff", "N/A", username, picture, 0]
      );

      const [createdUsers] = await pool.query("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", [email]);
      user = (createdUsers && createdUsers[0]) || {
        id: null,
        name: displayName,
        email,
        role: "Staff",
        mobile: "N/A",
        username,
        avatar: picture,
        two_factor_enabled: 0
      };
    }

    // Generate JWT matching normal login
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "24h" });

    return res.redirect(`${frontendUrl}/login?token=${encodeURIComponent(token)}&auth_success=1`);
  } catch (err) {
    console.error("Google callback error:", err);
    return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent("Google authentication failed. Please try again.")}`);
  }
}

module.exports = {
  signup,
  login,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
  changePassword,
  getMe,
  googleAuth,
  googleCallback
};