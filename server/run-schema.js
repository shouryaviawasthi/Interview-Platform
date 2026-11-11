const fs = require("fs");
const path = require("path");
const { pool } = require("./src/config/db");

const runSqlFile = async (fileName) => {
  const filePath = path.join(__dirname, "..", "database", fileName);
  const sql = fs.readFileSync(filePath, "utf-8");
  await pool.query(sql);
  console.log(`✅ Applied ${fileName}`);
};

const runDatabaseSetup = async () => {
  try {
    const migrationFiles = [
      "schema.sql",
      "migration_phase3.sql",
      "migration_phase4.sql",
      "migration_phase5.sql",
    ];

    for (const fileName of migrationFiles) {
      console.log(`⏳ Applying ${fileName}...`);
      await runSqlFile(fileName);
    }

    console.log("✅ Database setup complete!");
  } catch (error) {
    console.error("❌ Failed to set up database:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

runDatabaseSetup();
