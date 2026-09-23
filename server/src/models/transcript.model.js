const { pool } = require("../config/db");

/**
 * Insert a batch of transcript segments for an interview.
 * segments: Array of { speaker_type, text, start_time, end_time, sequence_num, confidence, language }
 */
const insertSegments = async (interview_id, segments) => {
  if (!segments || segments.length === 0) return [];

  // Build a multi-row insert
  const values = [];
  const placeholders = segments.map((seg, i) => {
    const base = i * 7;
    values.push(
      interview_id,
      seg.speaker_type,
      seg.text,
      seg.start_time ?? null,
      seg.end_time ?? null,
      seg.sequence_num,
      seg.confidence ?? null,
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
  });

  const query = `
    INSERT INTO transcripts
      (interview_id, speaker_type, transcript_text, start_time, end_time, sequence_num, confidence)
    VALUES ${placeholders.join(", ")}
    RETURNING *
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

/**
 * Delete all transcript segments for an interview (used before retry).
 */
const deleteSegmentsByInterviewId = async (interview_id) => {
  await pool.query("DELETE FROM transcripts WHERE interview_id = $1", [interview_id]);
};

/**
 * Get all segments for an interview, ordered by sequence.
 */
const getSegmentsByInterviewId = async (interview_id) => {
  const result = await pool.query(
    `SELECT
       id,
       speaker_type  AS speaker,
       transcript_text AS text,
       start_time,
       end_time,
       sequence_num  AS "sequenceNumber",
       confidence,
       language,
       created_at
     FROM transcripts
     WHERE interview_id = $1
     ORDER BY sequence_num ASC`,
    [interview_id]
  );
  return result.rows;
};

/**
 * Update the speaker_type for all segments that match a given raw Deepgram speaker label.
 * Used during speaker assignment.
 */
const updateSpeakerType = async (interview_id, rawSpeakerLabel, speakerType) => {
  // raw speaker label is stored temporarily in the `speaker` column (existing col)
  await pool.query(
    `UPDATE transcripts
     SET speaker_type = $3
     WHERE interview_id = $1 AND speaker = $2`,
    [interview_id, rawSpeakerLabel, speakerType]
  );
};

module.exports = {
  insertSegments,
  deleteSegmentsByInterviewId,
  getSegmentsByInterviewId,
  updateSpeakerType,
};
