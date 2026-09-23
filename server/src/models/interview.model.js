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
 * Get aggregated dashboard metrics (role-aware: interviewer or candidate)
 */
const getDashboardStats = async ({ userId, role, email }) => {
  const isCandidate = role === "candidate";
  const whereClause = isCandidate
    ? "WHERE i.candidate_email = $1"
    : "WHERE i.interviewer_id = $1";
  const param = isCandidate ? email : userId;

  const query = `
    SELECT
      COUNT(DISTINCT i.id)                                                          AS total,
      COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'scheduled')                   AS scheduled,
      COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'live')                        AS live,
      COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'completed')                   AS completed,
      COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'cancelled')                   AS cancelled,
      COUNT(DISTINCT i.id) FILTER (WHERE cr.status = 'completed')                  AS reports_ready,
      ROUND(AVG(cr.overall_score) FILTER (WHERE i.status = 'completed' AND cr.status = 'completed'), 1) AS average_score
    FROM interviews i
    LEFT JOIN candidate_reports cr ON i.id = cr.interview_id
    ${whereClause}
  `;

  const result = await pool.query(query, [param]);
  const row = result.rows[0];

  return {
    total: parseInt(row.total || 0, 10),
    scheduled: parseInt(row.scheduled || 0, 10),
    live: parseInt(row.live || 0, 10),
    completed: parseInt(row.completed || 0, 10),
    cancelled: parseInt(row.cancelled || 0, 10),
    reportsReady: parseInt(row.reports_ready || 0, 10),
    averageScore: row.average_score ? parseFloat(row.average_score) : null,
  };
};

/**
 * Get paginated, searched, filtered, and sorted interviews (role-scoped)
 */
const getPaginatedInterviews = async ({
  userId,
  role,
  email,
  search = "",
  status = "all",
  reportStatus = "all",
  sort = "newest",
  page = 1,
  limit = 20,
}) => {
  const isCandidate = role === "candidate";
  const values = [isCandidate ? email : userId];
  let paramIndex = 2;

  const conditions = [
    isCandidate ? "i.candidate_email = $1" : "i.interviewer_id = $1",
  ];

  // Search filter (candidate_name, candidate_email, job_description, id)
  if (search && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    values.push(q);
    conditions.push(
      `(LOWER(i.candidate_name) LIKE $${paramIndex} OR LOWER(i.candidate_email) LIKE $${paramIndex} OR LOWER(i.job_description) LIKE $${paramIndex} OR CAST(i.id AS TEXT) LIKE $${paramIndex})`
    );
    paramIndex++;
  }

  // Status filter
  if (status && status !== "all") {
    values.push(status);
    conditions.push(`i.status = $${paramIndex}`);
    paramIndex++;
  }

  // Report status filter
  if (reportStatus && reportStatus !== "all") {
    if (reportStatus === "reports_ready") {
      conditions.push("cr.status = 'completed'");
    } else if (reportStatus === "pending") {
      conditions.push("(cr.status IS NULL OR cr.status != 'completed')");
    }
  }

  const whereSql = `WHERE ${conditions.join(" AND ")}`;

  // Sorting
  let orderBy = "i.created_at DESC";
  if (sort === "oldest") {
    orderBy = "i.created_at ASC";
  } else if (sort === "upcoming") {
    orderBy = "CASE WHEN i.status = 'scheduled' THEN 0 WHEN i.status = 'live' THEN 1 ELSE 2 END, i.created_at ASC";
  } else if (sort === "highest_score") {
    orderBy = "cr.overall_score DESC NULLS LAST, i.created_at DESC";
  } else if (sort === "lowest_score") {
    orderBy = "cr.overall_score ASC NULLS LAST, i.created_at DESC";
  }

  // Count total matching
  const countQuery = `
    SELECT COUNT(DISTINCT i.id) AS total_count
    FROM interviews i
    LEFT JOIN candidate_reports cr ON i.id = cr.interview_id
    ${whereSql}
  `;
  const countRes = await pool.query(countQuery, values);
  const totalCount = parseInt(countRes.rows[0]?.total_count || 0, 10);

  // Pagination bounds
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  values.push(limitNum);
  const limitParam = `$${paramIndex++}`;
  values.push(offset);
  const offsetParam = `$${paramIndex++}`;

  const dataQuery = `
    SELECT
      i.id,
      i.interviewer_id,
      i.candidate_name,
      i.candidate_email,
      i.job_description,
      i.status,
      i.join_token,
      i.started_at,
      i.ended_at,
      i.created_at,
      i.updated_at,
      CASE
        WHEN i.started_at IS NOT NULL AND i.ended_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (i.ended_at - i.started_at))::INTEGER
        ELSE NULL
      END AS duration_seconds,
      cr.overall_score   AS candidate_score,
      cr.status          AS candidate_report_status,
      ir.status          AS interviewer_report_status,
      ia.status          AS analytics_status
    FROM interviews i
    LEFT JOIN candidate_reports cr ON i.id = cr.interview_id
    LEFT JOIN interviewer_reports ir ON i.id = ir.interview_id
    LEFT JOIN interview_analytics ia ON i.id = ia.interview_id
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `;

  const dataRes = await pool.query(dataQuery, values);

  return {
    interviews: dataRes.rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum) || 1,
    },
  };
};

/**
 * Start an interview — set status=live, started_at=NOW
 * Uses conditional update to prevent race conditions.
 */
const startInterview = async (id) => {
  const query = `
    UPDATE interviews
    SET
      status     = 'live',
      started_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
      AND status = 'scheduled'
    RETURNING *
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

/**
 * End an interview — set status=completed, ended_at=NOW
 * Only transitions from live → completed.
 */
const endInterview = async (id) => {
  const query = `
    UPDATE interviews
    SET
      status     = 'completed',
      ended_at   = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
      AND status = 'live'
    RETURNING *
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

/**
 * Get session-relevant fields for an interview by ID.
 * Returns timestamps + status for the session API.
 */
const getSessionById = async (id) => {
  const query = `
    SELECT
      id,
      status,
      started_at,
      ended_at,
      CASE
        WHEN started_at IS NOT NULL AND ended_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER
        ELSE NULL
      END AS duration_seconds
    FROM interviews
    WHERE id = $1
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

module.exports = {
  createInterview,
  getInterviewsByInterviewer,
  getInterviewById,
  getInterviewByToken,
  updateInterview,
  deleteInterview,
  getDashboardStats,
  getPaginatedInterviews,
  startInterview,
  endInterview,
  getSessionById,
};
