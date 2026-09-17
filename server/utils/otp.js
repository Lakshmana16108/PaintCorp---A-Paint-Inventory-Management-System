const crypto = require("crypto");

/**
 * Generate a secure 6-digit numeric OTP.
 * @returns {string}
 */
function generateOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash an OTP using SHA-256.
 * @param {string} otp 
 * @returns {string}
 */
function hashOTP(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

module.exports = {
  generateOTP,
  hashOTP
};
