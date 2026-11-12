import { pool } from "../db.js";
export async function checkDatabase() {
  await pool.query(
    "SELECT d.is_active,c.version,r.canceled_at, r.cancellation_reason, e.version, a.approver_name_snapshot, h.changed_by_name_snapshot FROM trip_app.travel_requests r, trip_app.sessions, trip_app.approval_routes, trip_app.employees e, trip_app.approval_steps a, trip_app.request_status_history h, trip_app.admin_audit_log,trip_app.departments d,trip_app.expense_categories c LIMIT 0",
  );
}
