const { initializeDatabase, getPool } = require("./config/database");

async function check() {
  await initializeDatabase();
  const pool = getPool();
  try {
    const [users] = await pool.query(
      "SELECT id, email FROM users WHERE LOWER(email) = LOWER(?)",
      ["plakshmana22@gmail.com"]
    );
    console.log("Query returned users count:", users.length);
    console.log("Users found:", users);
  } catch (error) {
    console.error("Query failed with error:", error);
  }
  process.exit(0);
}

check();
