// Must use the project's db config (which properly handles Neon SSL)
const { pool } = require('./src/config/db');

const run = async () => {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS candidate_reports (
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
    )`);
    console.log('candidate_reports OK');

    await client.query(`CREATE TABLE IF NOT EXISTS interviewer_reports (
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
    )`);
    console.log('interviewer_reports OK');

    await client.query('CREATE INDEX IF NOT EXISTS idx_candidate_reports_interview ON candidate_reports(interview_id)');
    console.log('idx_candidate_reports OK');

    await client.query('CREATE INDEX IF NOT EXISTS idx_interviewer_reports_interview ON interviewer_reports(interview_id)');
    console.log('idx_interviewer_reports OK');

    console.log('All Phase 4 migrations complete.');
  } catch(e) {
    console.error('Migration error:', e.code, e.message);
  } finally {
    client.release();
    process.exit(0);
  }
};

pool.on('connect', () => console.log('Pool connected'));
pool.on('error', (e) => console.error('Pool error:', e.message));

run().catch(e => { console.error('run() failed:', e.message); process.exit(1); });
