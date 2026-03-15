const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../db");
const { env } = require("../config/env");
const { HttpError } = require("../utils/http-error");

async function verifyPassword(password, passwordHash) {
  if (!passwordHash) return false;
  if (passwordHash.startsWith("$2")) {
    return bcrypt.compare(password, passwordHash);
  }
  return password === passwordHash;
}

async function login({ username, password }) {
  const result = await query(
    `
      SELECT
        u.id,
        u.username,
        u.email,
        u.password_hash,
        u.is_active,
        COALESCE(
          json_agg(DISTINCT r.key) FILTER (WHERE r.key IS NOT NULL),
          '[]'::json
        ) AS roles,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'school_id', us.school_id,
              'grade_level', us.grade_level,
              'course_id', us.course_id,
              'teacher_id', us.teacher_id
            )
          ) FILTER (WHERE us.id IS NOT NULL),
          '[]'::json
        ) AS scopes
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      LEFT JOIN user_scopes us ON us.user_id = u.id
      WHERE u.username = $1 OR u.email = $1
      GROUP BY u.id
      LIMIT 1
    `,
    [username]
  );

  const user = result.rows[0];

  if (!user || !user.is_active) {
    throw new HttpError(401, "Invalid credentials");
  }

  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    throw new HttpError(401, "Invalid credentials");
  }

  const payload = {
    sub: user.id,
    username: user.username,
    roles: user.roles,
    scopes: user.scopes
  };

  const token = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: "8h"
  });

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles,
      scopes: user.scopes
    }
  };
}

module.exports = {
  login
};
