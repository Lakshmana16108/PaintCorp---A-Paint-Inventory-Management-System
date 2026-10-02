const bcrypt = require("bcryptjs");

/**
 * Hash a plain-text password using bcrypt.
 * @param {string} password 
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

/**
 * Compare a plain-text password with a hash.
 * @param {string} password 
 * @param {string} hash 
 * @returns {Promise<boolean>}
 */
async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

module.exports = {
  hashPassword,
  comparePassword
};
