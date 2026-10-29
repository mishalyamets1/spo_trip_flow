import { pool } from "../db.js";
export async function checkDatabase() {
  await pool.query(
    "SELECT 1 FROM trip_app.sessions, trip_app.approval_routes LIMIT 0",
  );
}
