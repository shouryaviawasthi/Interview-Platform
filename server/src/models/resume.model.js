const { pool } = require("../config/db");

/**
 * Save resume record (file path + parsed text)
 */
const createResume = async ({ interview_id, resume_file_url, resume_text }) => {
  const query = `
    INSERT INTO resumes (interview_id, resume_file_url, resume_text)
    VALUES ($1, $2, $3)
    RETURNING *
  `;

  const result = await pool.query(query, [
    interview_id,
    resume_file_url,
    resume_text,
  ]);
  return result.rows[0];
};

/**
 * Get resume for an interview
 */
const getResumeByInterviewId = async (interview_id) => {
  const query = `
    SELECT *
    FROM resumes
    WHERE interview_id = $1
  `;

  const result = await pool.query(query, [interview_id]);
  return result.rows[0];
};

module.exports = {
  createResume,
  getResumeByInterviewId,
};
