const { pool } = require("../config/db");

/**
 * Get analytics record for an interview.
 */
const getAnalyticsByInterviewId = async (interview_id) => {
  const result = await pool.query(
    "SELECT * FROM interview_analytics WHERE interview_id = $1",
    [interview_id]
  );
  return result.rows[0] || null;
};

/**
 * Upsert full analytics record.
 */
const upsertAnalytics = async ({
  interview_id,
  status,
  total_duration,
  interviewer_speaking_time,
  candidate_speaking_time,
  interviewer_speaking_percentage,
  candidate_speaking_percentage,
  silence_duration,
  interviewer_turn_count,
  candidate_turn_count,
  total_turns,
  average_interviewer_turn_duration,
  average_candidate_turn_duration,
  longest_turn_duration,
  question_count,
  follow_up_count,
  candidate_filler_count,
  interviewer_filler_count,
  candidate_language_stats,
  interviewer_language_stats,
  analytics_json,
  error_message,
}) => {
  const result = await pool.query(
    `INSERT INTO interview_analytics (
       interview_id,
       status,
       total_duration,
       interviewer_speaking_time,
       candidate_speaking_time,
       interviewer_speaking_percentage,
       candidate_speaking_percentage,
       silence_duration,
       interviewer_turn_count,
       candidate_turn_count,
       total_turns,
       average_interviewer_turn_duration,
       average_candidate_turn_duration,
       longest_turn_duration,
       question_count,
       follow_up_count,
       candidate_filler_count,
       interviewer_filler_count,
       candidate_language_stats,
       interviewer_language_stats,
       analytics_json,
       error_message,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, CURRENT_TIMESTAMP)
     ON CONFLICT (interview_id) DO UPDATE SET
       status                            = EXCLUDED.status,
       total_duration                    = EXCLUDED.total_duration,
       interviewer_speaking_time         = EXCLUDED.interviewer_speaking_time,
       candidate_speaking_time           = EXCLUDED.candidate_speaking_time,
       interviewer_speaking_percentage   = EXCLUDED.interviewer_speaking_percentage,
       candidate_speaking_percentage     = EXCLUDED.candidate_speaking_percentage,
       silence_duration                  = EXCLUDED.silence_duration,
       interviewer_turn_count            = EXCLUDED.interviewer_turn_count,
       candidate_turn_count              = EXCLUDED.candidate_turn_count,
       total_turns                       = EXCLUDED.total_turns,
       average_interviewer_turn_duration = EXCLUDED.average_interviewer_turn_duration,
       average_candidate_turn_duration   = EXCLUDED.average_candidate_turn_duration,
       longest_turn_duration             = EXCLUDED.longest_turn_duration,
       question_count                    = EXCLUDED.question_count,
       follow_up_count                   = EXCLUDED.follow_up_count,
       candidate_filler_count            = EXCLUDED.candidate_filler_count,
       interviewer_filler_count          = EXCLUDED.interviewer_filler_count,
       candidate_language_stats          = EXCLUDED.candidate_language_stats,
       interviewer_language_stats        = EXCLUDED.interviewer_language_stats,
       analytics_json                    = EXCLUDED.analytics_json,
       error_message                     = EXCLUDED.error_message,
       updated_at                        = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      interview_id,
      status,
      total_duration ?? null,
      interviewer_speaking_time ?? null,
      candidate_speaking_time ?? null,
      interviewer_speaking_percentage ?? null,
      candidate_speaking_percentage ?? null,
      silence_duration ?? null,
      interviewer_turn_count ?? null,
      candidate_turn_count ?? null,
      total_turns ?? null,
      average_interviewer_turn_duration ?? null,
      average_candidate_turn_duration ?? null,
      longest_turn_duration ?? null,
      question_count ?? null,
      follow_up_count ?? null,
      candidate_filler_count ?? null,
      interviewer_filler_count ?? null,
      candidate_language_stats ? JSON.stringify(candidate_language_stats) : null,
      interviewer_language_stats ? JSON.stringify(interviewer_language_stats) : null,
      analytics_json ? JSON.stringify(analytics_json) : null,
      error_message ?? null,
    ]
  );
  return result.rows[0];
};

/**
 * Set analytics status (e.g. processing, failed).
 */
const setAnalyticsStatus = async (interview_id, status, error_message = null) => {
  const result = await pool.query(
    `INSERT INTO interview_analytics (interview_id, status, error_message, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (interview_id) DO UPDATE SET
       status = EXCLUDED.status,
       error_message = EXCLUDED.error_message,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [interview_id, status, error_message]
  );
  return result.rows[0] || null;
};

module.exports = {
  getAnalyticsByInterviewId,
  upsertAnalytics,
  setAnalyticsStatus,
};
