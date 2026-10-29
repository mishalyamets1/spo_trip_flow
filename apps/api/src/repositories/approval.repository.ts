import type { PoolClient } from "pg";
import { pool } from "../db.js";
import { fields, joins } from "./request.repository.js";
export async function listSteps(id: string) {
  return (
    await pool.query(
      `SELECT a.*, e.full_name AS approver_name,
      (a.status='PENDING' AND r.status IN ('SUBMITTED','UNDER_REVIEW') AND NOT EXISTS
        (SELECT 1 FROM approval_steps p WHERE p.request_id=a.request_id AND p.step_order<a.step_order AND p.status<>'APPROVED')) AS actionable
      FROM approval_steps a JOIN employees e ON e.id=a.approver_employee_id
      JOIN travel_requests r ON r.id=a.request_id WHERE a.request_id=$1 ORDER BY a.step_order`,
      [id],
    )
  ).rows;
}
export async function findActiveRoute(client: PoolClient, employeeId: string) {
  return (
    await client.query(
      `SELECT r.id FROM approval_routes r JOIN employees e ON e.department_id=r.department_id
      WHERE e.id=$1 AND r.is_active FOR SHARE OF r`,
      [employeeId],
    )
  ).rows[0];
}
export async function listRouteSteps(client: PoolClient, routeId: string) {
  return (
    await client.query(
      `SELECT s.step_order,s.approver_employee_id,u.is_active,
      EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code='APPROVER') AS can_approve
      FROM approval_route_steps s JOIN employees e ON e.id=s.approver_employee_id JOIN users u ON u.id=e.user_id
      WHERE s.route_id=$1 ORDER BY s.step_order FOR SHARE OF s`,
      [routeId],
    )
  ).rows;
}
export async function insertStep(
  client: PoolClient,
  id: string,
  stepOrder: number,
  employeeId: string,
) {
  await client.query(
    `INSERT INTO approval_steps(request_id,step_order,approver_employee_id) VALUES ($1,$2,$3)`,
    [id, stepOrder, employeeId],
  );
}
export async function listPendingForApprover(employeeId: string) {
  return (
    await pool.query(
      `SELECT ${fields},a.id AS approval_id,a.step_order ${joins}
    JOIN approval_steps a ON a.request_id=r.id
    WHERE a.approver_employee_id=$1 AND a.status='PENDING' AND r.status IN ('SUBMITTED','UNDER_REVIEW')
    AND NOT EXISTS (SELECT 1 FROM approval_steps p WHERE p.request_id=r.id AND p.step_order<a.step_order AND p.status<>'APPROVED')
    ORDER BY r.submitted_at,r.id LIMIT 100`,
      [employeeId],
    )
  ).rows;
}
export async function findAssignedStep(
  client: PoolClient,
  approvalId: string,
  employeeId: string,
) {
  return (
    await client.query(
      "SELECT request_id FROM approval_steps WHERE id=$1 AND approver_employee_id=$2",
      [approvalId, employeeId],
    )
  ).rows[0];
}
export async function findStepForUpdate(
  client: PoolClient,
  approvalId: string,
) {
  return (
    await client.query("SELECT * FROM approval_steps WHERE id=$1 FOR UPDATE", [
      approvalId,
    ])
  ).rows[0];
}
export async function hasUnapprovedPrevious(
  client: PoolClient,
  id: string,
  stepOrder: number,
) {
  return Boolean(
    (
      await client.query(
        `SELECT 1 FROM approval_steps WHERE request_id=$1 AND step_order<$2 AND status<>'APPROVED'`,
        [id, stepOrder],
      )
    ).rowCount,
  );
}
export async function saveDecision(
  client: PoolClient,
  approvalId: string,
  status: string,
  comment: string,
) {
  await client.query(
    `UPDATE approval_steps SET status=$2,decision_comment=$3,decided_at=now() WHERE id=$1`,
    [approvalId, status, comment],
  );
}
export async function skipPending(client: PoolClient, id: string) {
  await client.query(
    `UPDATE approval_steps SET status='SKIPPED' WHERE request_id=$1 AND status='PENDING'`,
    [id],
  );
}
export async function hasPending(client: PoolClient, id: string) {
  return Boolean(
    (
      await client.query(
        `SELECT 1 FROM approval_steps WHERE request_id=$1 AND status='PENDING' LIMIT 1`,
        [id],
      )
    ).rowCount,
  );
}
