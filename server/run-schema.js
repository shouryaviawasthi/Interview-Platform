const fs = require("fs");
const path = require("path");
const { pool } = require("./src/config/db");

const runSchema = async () => {
  try {
    const schemaPath = path.join(__dirname, "..", "database", "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf-8");

    console.log("⏳ Running schema.sql against the database...\n");

    await pool.query(schema);

    console.log("✅ All tables created successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to run schema:", error.message);
    process.exit(1);
  }
};

runSchema();
