import type { PoolClient } from "pg";
import { pool } from "../db.js";
import type { ApprovalFilters } from "../types/approval.js";
import { fields, joins } from "./request.repository.js";
export async function listSteps(id: string) {
  return (
    await pool.query(
      `SELECT a.*, a.approver_name_snapshot AS approver_name,
      (a.status='PENDING' AND r.status IN ('SUBMITTED','UNDER_REVIEW') AND NOT EXISTS
        (SELECT 1 FROM approval_steps p WHERE p.request_id=a.request_id AND p.step_order<a.step_order AND p.status<>'APPROVED')) AS actionable
      FROM approval_steps a
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
    `INSERT INTO approval_steps(request_id,step_order,approver_employee_id,approver_name_snapshot) SELECT $1,$2,$3,full_name FROM employees WHERE id=$3`,
    [id, stepOrder, employeeId],
  );
}
export async function listForApprover(
  employeeId: string,
  filter: ApprovalFilters,
) {
  const processed = filter.view === "processed";
  const params: unknown[] = [employeeId];
  const where = [
    "a.approver_employee_id=$1",
    processed
      ? "a.status IN ('APPROVED','REJECTED')"
      : `a.status='PENDING' AND r.status IN ('SUBMITTED','UNDER_REVIEW')
       AND NOT EXISTS (SELECT 1 FROM approval_steps p WHERE p.request_id=r.id
         AND p.step_order<a.step_order AND p.status<>'APPROVED')`,
  ];
  for (const [column, value] of [
    ["a.status =", filter.decision],
    ["t.start_date >=", filter.from],
    ["t.end_date <=", filter.to],
  ] as const) {
    if (value) {
      params.push(value);
      where.push(`${column}$${params.length}`);
    }
  }
  const source = `${joins} JOIN approval_steps a ON a.request_id=r.id WHERE ${where.join(" AND ")}`;
  const count = await pool.query(`SELECT count(*) ${source}`, params);
  params.push(20, (filter.page - 1) * 20);
  const order = processed
    ? "a.decided_at DESC,a.id DESC"
    : "r.submitted_at,r.id,a.step_order";
  const result = await pool.query(
    `SELECT ${fields}, a.id AS approval_id, a.step_order,
    a.status AS approval_status, a.decided_at AS approval_decided_at, a.decision_comment AS approval_comment
    ${source} ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return {
    items: result.rows,
    total: Number(count.rows[0].count),
    page: filter.page,
    page_size: 20,
    view: filter.view,
  };
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

export async function hasDecisions(client: PoolClient, id: string) {
  const result = await client.query(
    "SELECT 1 FROM approval_steps WHERE request_id=$1 AND status IN ('APPROVED','REJECTED') LIMIT 1",
    [id],
  );
  return Boolean(result.rowCount);
}
