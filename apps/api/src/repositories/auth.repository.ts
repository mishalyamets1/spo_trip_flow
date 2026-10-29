import { pool } from "../db.js";
import type { User } from "../types/user.js";

const userSelect = `SELECT u.id, u.email, e.id AS employee_id, e.full_name,
  COALESCE(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles
  FROM users u JOIN employees e ON e.user_id=u.id
  LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN roles r ON r.id=ur.role_id`;

export async function findAccountByEmail(email: string) {
  return (
    await pool.query<{ id: string; password_hash: string; is_active: boolean }>(
      "SELECT id,password_hash,is_active FROM users WHERE email=$1",
      [email],
    )
  ).rows[0];
}
export async function findUserById(id: string) {
  return (
    await pool.query<User>(`${userSelect} WHERE u.id=$1 GROUP BY u.id,e.id`, [
      id,
    ])
  ).rows[0];
}
export async function findSessionUser(hash: string) {
  return (
    await pool.query<User>(
      `${userSelect}
    JOIN sessions s ON s.user_id=u.id
    WHERE s.token_hash=$1 AND s.expires_at>now() AND u.is_active
    GROUP BY u.id,e.id`,
      [hash],
    )
  ).rows[0];
}
export async function deleteExpiredSessions() {
  await pool.query("DELETE FROM sessions WHERE expires_at<=now()");
}
export async function createSession(hash: string, userId: string) {
  await pool.query(
    `INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '8 hours')`,
    [hash, userId],
  );
}
export async function deleteSession(hash: string) {
  await pool.query("DELETE FROM sessions WHERE token_hash=$1", [hash]);
}
