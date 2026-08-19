const { pool } = require("../config/db");

/**
 * Create a new interview
 */
const createInterview = async ({
  interviewer_id,
  candidate_name,
  candidate_email,
  job_description,
  join_token,
}) => {
  const query = `
    INSERT INTO interviews
    (interviewer_id, candidate_name, candidate_email, job_description, join_token)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;

  const values = [
    interviewer_id,
    candidate_name,
    candidate_email,
    job_description,
    join_token,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

/**
 * Get all interviews for a specific interviewer
 */
const getInterviewsByInterviewer = async (interviewer_id) => {
  const query = `
    SELECT *
    FROM interviews
    WHERE interviewer_id = $1
    ORDER BY created_at DESC
  `;

  const result = await pool.query(query, [interviewer_id]);
  return result.rows;
};

/**
 * Get a single interview by ID
 */
const getInterviewById = async (id) => {
  const query = `
    SELECT *
    FROM interviews
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0];
};

/**
 * Get a single interview by join_token (public — no auth)
 */
const getInterviewByToken = async (token) => {
  const query = `
    SELECT id, candidate_name, job_description, status, join_token
    FROM interviews
    WHERE join_token = $1
  `;

  const result = await pool.query(query, [token]);
  return result.rows[0];
};

/**
 * Update interview details
 */
const updateInterview = async (id, { candidate_name, candidate_email, job_description }) => {
  const query = `
    UPDATE interviews
    SET
      candidate_name  = COALESCE($1, candidate_name),
      candidate_email = COALESCE($2, candidate_email),
      job_description = COALESCE($3, job_description),
      updated_at      = CURRENT_TIMESTAMP
    WHERE id = $4
    RETURNING *
  `;

  const result = await pool.query(query, [
    candidate_name,
    candidate_email,
    job_description,
    id,
  ]);
  return result.rows[0];
};

/**
 * Delete interview by ID
 */
const deleteInterview = async (id) => {
  const query = `
    DELETE FROM interviews
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0];
};

/**
 * Get dashboard counts for a specific interviewer
 */
const getDashboardStats = async (interviewer_id) => {
  const query = `
    SELECT
      COUNT(*)                                              AS total,
      COUNT(*) FILTER (WHERE status = 'scheduled')         AS scheduled,
      COUNT(*) FILTER (WHERE status = 'live')              AS live,
      COUNT(*) FILTER (WHERE status = 'completed')         AS completed,
      COUNT(*) FILTER (WHERE status = 'cancelled')         AS cancelled
    FROM interviews
    WHERE interviewer_id = $1
  `;

  const result = await pool.query(query, [interviewer_id]);
  return result.rows[0];
};

module.exports = {
  createInterview,
  getInterviewsByInterviewer,
  getInterviewById,
  getInterviewByToken,
  updateInterview,
  deleteInterview,
  getDashboardStats,
};
