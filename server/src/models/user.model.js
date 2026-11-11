const { pool } = require("../config/db");

/**
 * Find user by email
 */
const findUserByEmail = async (email) => {
    const query = `
    SELECT *
    FROM users
    WHERE email = $1
  `;

    const result = await pool.query(query, [email]);

    return result.rows[0];
};

/**
 * Find user by ID
 */
const findUserById = async (id) => {
    const query = `
    SELECT id, name, email, role, created_at, updated_at
    FROM users
    WHERE id = $1
  `;

    const result = await pool.query(query, [id]);

    return result.rows[0];
};

/**
 * Create new user
 */
const createUser = async ({ name, email, password, role }) => {
    const query = `
    INSERT INTO users
    (
      name,
      email,
      password,
      role
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4
    )
    RETURNING
      id,
      name,
      email,
      role,
      created_at
  `;

    const values = [
        name,
        email,
        password,
        role || "interviewer",
    ];

    const result = await pool.query(query, values);

    return result.rows[0];
};

/**
 * Update user profile
 */
const updateUser = async (id, name) => {
    const query = `
    UPDATE users
    SET
      name = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING
      id,
      name,
      email,
      role,
      created_at,
      updated_at
  `;

    const result = await pool.query(query, [name, id]);

    return result.rows[0];
};

/**
 * Delete user
 */
const deleteUser = async (id) => {
    const query = `
    DELETE FROM users
    WHERE id = $1
    RETURNING id
  `;

    const result = await pool.query(query, [id]);

    return result.rows[0];
};

module.exports = {
    findUserByEmail,
    findUserById,
    createUser,
    updateUser,
    deleteUser,
};