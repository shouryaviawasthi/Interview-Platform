// Server Entry Point - Updated for Groq Model configuration hot-reload
const http = require("http");

const app = require("./app");
const env = require("./config/env");
const logger = require("./config/logger");
const { initializeSocket } = require("./sockets/socket");
const { connectDB, pool } = require("./config/db");

const runPhase4Migration = async () => {
  const statements = [
    `CREATE TABLE IF NOT EXISTS candidate_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      interview_id UUID UNIQUE NOT NULL,
      overall_score DECIMAL(5,2),
      recommendation VARCHAR(50),
      report_json JSONB,
      llm_model VARCHAR(100),
      status VARCHAR(20) CHECK (status IN ('not_started','processing','completed','failed')) DEFAULT 'not_started',
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_candidate_report_interview FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS interviewer_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      interview_id UUID UNIQUE NOT NULL,
      overall_score DECIMAL(5,2),
      report_json JSONB,
      llm_model VARCHAR(100),
      status VARCHAR(20) CHECK (status IN ('not_started','processing','completed','failed')) DEFAULT 'not_started',
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_interviewer_report_interview FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS interview_analytics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      interview_id UUID UNIQUE NOT NULL,
      total_duration INTEGER,
      interviewer_speaking_time INTEGER,
      candidate_speaking_time INTEGER,
      interviewer_speaking_percentage DECIMAL(5,2),
      candidate_speaking_percentage DECIMAL(5,2),
      silence_duration INTEGER,
      interviewer_turn_count INTEGER,
      candidate_turn_count INTEGER,
      total_turns INTEGER,
      average_interviewer_turn_duration DECIMAL(6,2),
      average_candidate_turn_duration DECIMAL(6,2),
      longest_turn_duration DECIMAL(6,2),
      question_count INTEGER,
      follow_up_count INTEGER,
      candidate_filler_count INTEGER,
      interviewer_filler_count INTEGER,
      candidate_language_stats JSONB,
      interviewer_language_stats JSONB,
      analytics_json JSONB,
      status VARCHAR(20) CHECK (status IN ('not_started','processing','completed','failed')) DEFAULT 'not_started',
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_analytics_interview FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_candidate_reports_interview ON candidate_reports(interview_id)`,
    `CREATE INDEX IF NOT EXISTS idx_interviewer_reports_interview ON interviewer_reports(interview_id)`,
    `CREATE INDEX IF NOT EXISTS idx_interview_analytics_interview ON interview_analytics(interview_id)`,
  ];
  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (e) {
      // Table/index already exists or other non-fatal error
      logger.warn("Database migration note:", e.message);
    }
  }
  logger.info("✅ Database tables verified (Phase 4 & Phase 5).");
};

const autoProcessUploadedAudio = async () => {
  try {
    const { processAudio } = require("./services/transcription/transcription.service");
    const res = await pool.query("SELECT interview_id FROM interview_audio WHERE status = 'uploaded'");
    if (res.rows.length > 0) {
      logger.info(`[Startup] Found ${res.rows.length} audio file(s) in 'uploaded' status. Starting background transcription...`);
      for (const row of res.rows) {
        processAudio(row.interview_id);
      }
    }
  } catch (err) {
    logger.error("[Startup] Failed to auto-process uploaded audio:", err.message);
  }
};

const startServer = async () => {
  try {
    // Connect to Database
    await connectDB();

    // Run Phase 4 migration (idempotent — IF NOT EXISTS)
    await runPhase4Migration();

    // Auto-process any pending uploaded audio records (e.g. if nodemon restarted)
    await autoProcessUploadedAudio();

    // Create HTTP Server
    const server = http.createServer(app);

    // Initialize Socket.IO
    initializeSocket(server);

    // Start Server
    server.listen(env.PORT, () => {
      logger.info(
        `🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`
      );
    });

  } catch (error) {
    logger.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();