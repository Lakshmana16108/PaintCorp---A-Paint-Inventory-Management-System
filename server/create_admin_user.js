const bcrypt = require("bcryptjs");
const readline = require("readline");
const path = require("path");
const fs = require("fs");
const { initializeDatabase, getPool } = require("./config/database");

async function askPassword() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question("Enter the password you want for lakshmana16108perumal@gmail.com: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const email = "lakshmana16108perumal@gmail.com";
  let password = process.argv[2];

  if (!password) {
    password = await askPassword();
  }

  if (!password) {
    console.error("Error: Password cannot be empty.");
    process.exit(1);
  }

  if (password.length < 6) {
    console.error("Error: Password must be at least 6 characters long.");
    process.exit(1);
  }

  console.log(`\nConfiguring Administrator account for: ${email}`);
  const hashedPassword = await bcrypt.hash(password, 10);

  // 1. Update / Insert in MySQL database
  try {
    await initializeDatabase();
    const pool = getPool();

    const [existing] = await pool.query("SELECT id, name, role FROM users WHERE LOWER(email) = LOWER(?)", [email]);

    if (existing.length > 0) {
      await pool.query(
        "UPDATE users SET role = 'Administrator', password = ? WHERE LOWER(email) = LOWER(?)",
        [hashedPassword, email]
      );
      console.log(`[MySQL] Successfully updated existing user (ID: ${existing[0].id}) to Administrator with new password.`);
    } else {
      const username = "lakshmana16108";
      const name = "Lakshmana Perumal";
      const mobile = "+919486721134";
      await pool.query(
        `INSERT INTO users (name, email, password, role, mobile, username, avatar, two_factor_enabled)
         VALUES (?, ?, ?, 'Administrator', ?, ?, '', 0)`,
        [name, email, hashedPassword, mobile, username]
      );
      console.log("[MySQL] Successfully created new user with Administrator role.");
    }
  } catch (dbErr) {
    console.warn("[MySQL] Warning: Could not update MySQL database directly:", dbErr.message);
  }

  // 2. Synchronize with fallback_users.json for offline/fallback mode
  try {
    const fallbackPath = path.join(__dirname, "fallback_users.json");
    if (fs.existsSync(fallbackPath)) {
      const users = JSON.parse(fs.readFileSync(fallbackPath, "utf8"));
      const userIndex = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());

      if (userIndex !== -1) {
        users[userIndex].role = "Administrator";
        users[userIndex].password = hashedPassword;
        console.log("[Fallback JSON] Updated existing user in fallback_users.json.");
      } else {
        const nextId = users.length > 0 ? Math.max(...users.map((u) => Number(u.id) || 0)) + 1 : 1;
        users.push({
          id: nextId,
          name: "Lakshmana Perumal",
          email: email,
          password: hashedPassword,
          role: "Administrator",
          mobile: "+919486721134",
          username: "lakshmana16108",
          avatar: "",
          two_factor_enabled: 0
        });
        console.log("[Fallback JSON] Added user to fallback_users.json.");
      }
      fs.writeFileSync(fallbackPath, JSON.stringify(users, null, 2), "utf8");
    }
  } catch (fsErr) {
    console.warn("[Fallback JSON] Warning updating fallback file:", fsErr.message);
  }

  console.log("\n=======================================================");
  console.log("SUCCESS! Administrator account configured successfully:");
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Role:     Administrator`);
  console.log("=======================================================\n");
  console.log("You can now log in at: http://localhost:5173/login");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
