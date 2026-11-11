const { pool } = require("../config/db");

// ── Candidate Reports ───────────────────────────────────────────────────────

const getCandidateReport = async (interview_id) => {
  const result = await pool.query(
    "SELECT * FROM candidate_reports WHERE interview_id = $1",
    [interview_id]
  );
  return result.rows[0] || null;
};

const upsertCandidateReport = async ({ interview_id, status, report_json, overall_score, recommendation, llm_model, error_message }) => {
  const result = await pool.query(
    `INSERT INTO candidate_reports
       (interview_id, status, report_json, overall_score, recommendation, llm_model, error_message, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
     ON CONFLICT (interview_id) DO UPDATE SET
       status          = EXCLUDED.status,
       report_json     = EXCLUDED.report_json,
       overall_score   = EXCLUDED.overall_score,
       recommendation  = EXCLUDED.recommendation,
       llm_model       = EXCLUDED.llm_model,
       error_message   = EXCLUDED.error_message,
       updated_at      = CURRENT_TIMESTAMP
     RETURNING *`,
    [interview_id, status, report_json ? JSON.stringify(report_json) : null,
     overall_score ?? null, recommendation ?? null, llm_model ?? null, error_message ?? null]
  );
  return result.rows[0];
};

const setCandidateReportStatus = async (interview_id, status, error_message = null) => {
  const result = await pool.query(
    `UPDATE candidate_reports SET status = $2, error_message = $3, updated_at = CURRENT_TIMESTAMP
     WHERE interview_id = $1 RETURNING *`,
    [interview_id, status, error_message]
  );
  return result.rows[0] || null;
};

// ── Interviewer Reports ─────────────────────────────────────────────────────

const getInterviewerReport = async (interview_id) => {
  const result = await pool.query(
    "SELECT * FROM interviewer_reports WHERE interview_id = $1",
    [interview_id]
  );
  return result.rows[0] || null;
};

const upsertInterviewerReport = async ({ interview_id, status, report_json, overall_score, llm_model, error_message }) => {
  const result = await pool.query(
    `INSERT INTO interviewer_reports
       (interview_id, status, report_json, overall_score, llm_model, error_message, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
     ON CONFLICT (interview_id) DO UPDATE SET
       status          = EXCLUDED.status,
       report_json     = EXCLUDED.report_json,
       overall_score   = EXCLUDED.overall_score,
       llm_model       = EXCLUDED.llm_model,
       error_message   = EXCLUDED.error_message,
       updated_at      = CURRENT_TIMESTAMP
     RETURNING *`,
    [interview_id, status, report_json ? JSON.stringify(report_json) : null,
     overall_score ?? null, llm_model ?? null, error_message ?? null]
  );
  return result.rows[0];
};

const setInterviewerReportStatus = async (interview_id, status, error_message = null) => {
  const result = await pool.query(
    `UPDATE interviewer_reports SET status = $2, error_message = $3, updated_at = CURRENT_TIMESTAMP
     WHERE interview_id = $1 RETURNING *`,
    [interview_id, status, error_message]
  );
  return result.rows[0] || null;
};

module.exports = {
  getCandidateReport,
  upsertCandidateReport,
  setCandidateReportStatus,
  getInterviewerReport,
  upsertInterviewerReport,
  setInterviewerReportStatus,
};
