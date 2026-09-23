const { pool } = require("../config/db");

/**
 * Create an audio record for an interview.
 */
const createAudioRecord = async ({ interview_id, file_path, file_name, mime_type, file_size }) => {
  const query = `
    INSERT INTO interview_audio
      (interview_id, file_path, file_name, mime_type, file_size, status)
    VALUES ($1, $2, $3, $4, $5, 'uploaded')
    RETURNING *
  `;
  const result = await pool.query(query, [
    interview_id, file_path, file_name, mime_type, file_size,
  ]);
  return result.rows[0];
};

/**
 * Get audio record by interview ID.
 */
const getAudioByInterviewId = async (interview_id) => {
  const result = await pool.query(
    "SELECT * FROM interview_audio WHERE interview_id = $1",
    [interview_id]
  );
  return result.rows[0] || null;
};

/**
 * Update audio processing status.
 */
const updateAudioStatus = async (interview_id, status, error_message = null) => {
  const query = `
    UPDATE interview_audio
    SET
      status        = $2::VARCHAR,
      processed_at  = CASE WHEN $2::VARCHAR IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE processed_at END,
      error_message = $3
    WHERE interview_id = $1
    RETURNING *
  `;
  const result = await pool.query(query, [interview_id, status, error_message]);
  return result.rows[0] || null;
};

/**
 * Save speaker map to the audio record.
 * speakerMap: { "speaker_0": "interviewer", "speaker_1": "candidate" }
 */
const saveSpeakerMap = async (interview_id, speakerMap) => {
  const query = `
    UPDATE interview_audio
    SET speaker_map = $2
    WHERE interview_id = $1
    RETURNING *
  `;
  const result = await pool.query(query, [interview_id, JSON.stringify(speakerMap)]);
  return result.rows[0] || null;
};

module.exports = {
  createAudioRecord,
  getAudioByInterviewId,
  updateAudioStatus,
  saveSpeakerMap,
};
