const { pool } = require("../config/db");

/**
 * Insert a batch of transcript segments for an interview.
 * segments: Array of { speaker, speaker_type, text, start_time, end_time, sequence_num, confidence, language }
 */
const insertSegments = async (interview_id, segments) => {
  if (!segments || segments.length === 0) return [];

  // Build a multi-row insert
  const values = [];
  const placeholders = segments.map((seg, i) => {
    const base = i * 10;
    const startTime = Number.isFinite(Number(seg.start_time)) ? Number(seg.start_time) : 0;
    const speakerType = ["interviewer", "candidate", "unknown"].includes(seg.speaker_type)
      ? seg.speaker_type
      : "unknown";
    const endTime = seg.end_time != null && Number.isFinite(Number(seg.end_time))
      ? Number(seg.end_time)
      : null;
    values.push(
      interview_id,
      seg.speaker ?? speakerType,
      speakerType,
      seg.text,
      startTime,
      startTime,
      endTime,
      seg.sequence_num ?? i + 1,
      seg.confidence ?? null,
      seg.language ?? null,
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`;
  });

  const query = `
    INSERT INTO transcripts
      (interview_id, speaker, speaker_type, transcript_text, time_offset_seconds, start_time, end_time, sequence_num, confidence, language)
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
       transcripts.speaker AS raw_speaker,
       transcript_text AS text,
       start_time,
       end_time,
       sequence_num  AS "sequenceNumber",
       confidence,
       language,
       created_at
     FROM transcripts
     WHERE interview_id = $1
     ORDER BY start_time ASC NULLS LAST, sequence_num ASC`,
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
