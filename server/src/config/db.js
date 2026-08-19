const { Pool } = require("pg");
const env = require("./env");

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Function to test database connection
const connectDB = async () => {
  try {
    const client = await pool.connect();

    console.log("✅ PostgreSQL connected successfully!");

    client.release();
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