const { Pool } = require("pg");
const env = require("./env");

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  // Keep connections alive so Neon doesn't auto-suspend (free tier suspends after 5 min idle)
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Function to test database connection
const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log("✅ PostgreSQL connected successfully!");
    client.release();

    // Ping the DB every 4 minutes to prevent Neon free-tier auto-suspension.
    // Without this, the first query after 5 min idle takes 4-5 seconds (cold start).
    setInterval(async () => {
      try {
        await pool.query("SELECT 1");
      } catch (e) {
        // Non-fatal — next real query will reconnect automatically
        console.warn("[DB Keepalive] ping failed:", e.message);
      }
    }, 4 * 60 * 1000); // every 4 minutes

  } catch (error) {
    console.error("❌ Database connection failed");
    console.error(error.message);
    process.exit(1);
  }
};

module.exports = {
  pool,
  connectDB,
};