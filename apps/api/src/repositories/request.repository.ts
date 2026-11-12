import type { PoolClient } from "pg";
import { pool } from "../db.js";
import { requestWhere } from "./request-filters.js";
import type { RequestInput } from "../types/request.js";

export const fields = `r.*, e.full_name AS employee_name, t.destination_country, t.destination_city,
  t.purpose, to_char(t.start_date,'YYYY-MM-DD') AS start_date,
  to_char(t.end_date,'YYYY-MM-DD') AS end_date, t.transport_type, t.accommodation_required`;
export const joins = `FROM travel_requests r JOIN employees e ON e.id=r.employee_id JOIN trips t ON t.id=r.trip_id`;

export async function listOwn(
  employeeId: string,
  filter: { status?: string; from?: string; to?: string; page: number },
) {
  const { params, where } = requestWhere(filter, employeeId);
  const count = await pool.query(`SELECT count(*) ${joins}${where}`, params);
  params.push(20, (filter.page - 1) * 20);
  const data = await pool.query(
    `SELECT ${fields} ${joins}${where}
    ORDER BY r.created_at DESC,r.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return {
    items: data.rows,
    total: Number(count.rows[0].count),
    page: filter.page,
    page_size: 20,
  };
}

export async function findVisible(
  id: string,
  employeeId: string,
  canApprove: boolean,
) {
  return (
    await pool.query(
      `SELECT ${fields} ${joins} WHERE r.id=$1 AND
    (r.employee_id=$2 OR ($3::boolean AND EXISTS (SELECT 1 FROM approval_steps a WHERE a.request_id=r.id AND a.approver_employee_id=$2)))`,
      [id, employeeId, canApprove],
    )
  ).rows[0];
}
export async function listExpenses(id: string) {
  return (
    await pool.query(
      `SELECT x.*, x.category_id::text AS category_id, c.name AS category_name FROM expense_estimates x
      JOIN expense_categories c ON c.id=x.category_id WHERE request_id=$1 ORDER BY x.id`,
      [id],
    )
  ).rows;
}
export async function listHistory(id: string) {
  return (
    await pool.query(
      `SELECT * FROM (
       SELECT h.id::text AS id,h.request_id,h.old_status,h.new_status,h.changed_by_employee_id,
        h.comment,h.changed_at,h.changed_by_name_snapshot AS changed_by_name,
        'STATUS_CHANGE' AS event_type,NULL::smallint AS step_order
       FROM request_status_history h WHERE h.request_id=$1
       UNION ALL
       SELECT 'approval-'||a.id,a.request_id,NULL::varchar,
        CASE WHEN a.status='REJECTED' THEN 'REJECTED'
         WHEN EXISTS(SELECT 1 FROM approval_steps later WHERE later.request_id=a.request_id AND later.step_order>a.step_order) THEN 'UNDER_REVIEW'
         ELSE 'APPROVED' END,a.approver_employee_id,a.decision_comment,a.decided_at,
        a.approver_name_snapshot,'APPROVAL_DECISION',a.step_order
       FROM approval_steps a WHERE a.request_id=$1 AND a.status IN ('APPROVED','REJECTED')
        AND NOT EXISTS(SELECT 1 FROM request_status_history h WHERE h.request_id=a.request_id
         AND h.changed_at=a.decided_at AND h.changed_by_employee_id IS NOT DISTINCT FROM a.approver_employee_id)
       ) events ORDER BY changed_at,event_type,CASE WHEN id LIKE 'approval-%' THEN substring(id FROM 10)::bigint ELSE id::bigint END`,
      [id],
    )
  ).rows;
}
export async function addHistory(
  client: PoolClient,
  id: string,
  oldStatus: string | null,
  newStatus: string,
  employeeId: string,
  comment: string,
) {
  await client.query(
    `INSERT INTO request_status_history(request_id,old_status,new_status,changed_by_employee_id,comment,changed_by_name_snapshot)
    SELECT $1,$2,$3,$4,$5,full_name FROM employees WHERE id=$4`,
    [id, oldStatus, newStatus, employeeId, comment],
  );
}
export async function replaceExpenses(
  client: PoolClient,
  id: string,
  expenses: RequestInput["expenses"],
) {
  await client.query("DELETE FROM expense_estimates WHERE request_id=$1", [id]);
  for (const item of expenses) {
    await client.query(
      `INSERT INTO expense_estimates(request_id,category_id,amount,description) VALUES ($1,$2,$3,$4)`,
      [id, item.category_id, item.amount, item.description],
    );
  }
}
export async function usableCategories(
  client: PoolClient,
  ids: string[],
  requestId?: string,
) {
  const unique = [...new Set(ids)];
  const result = await client.query<{ count: string }>(
    `SELECT count(*) FROM expense_categories c WHERE c.id=ANY($1::smallint[]) AND (c.is_active OR EXISTS(SELECT 1 FROM expense_estimates x WHERE x.request_id=$2 AND x.category_id=c.id))`,
    [unique, requestId || null],
  );
  return Number(result.rows[0].count) === unique.length;
}
export async function findOwnForUpdate(
  client: PoolClient,
  id: string,
  employeeId: string,
) {
  return (
    await client.query(
      "SELECT * FROM travel_requests WHERE id=$1 AND employee_id=$2 FOR UPDATE",
      [id, employeeId],
    )
  ).rows[0];
}
function tripValues(input: RequestInput) {
  return [
    input.destination_country,
    input.destination_city,
    input.purpose,
    input.start_date,
    input.end_date,
    input.transport_type,
    input.accommodation_required,
  ];
}
export async function updateTrip(
  client: PoolClient,
  tripId: string,
  input: RequestInput,
) {
  await client.query(
    `UPDATE trips SET destination_country=$1,destination_city=$2,purpose=$3,
        start_date=$4,end_date=$5,transport_type=$6,accommodation_required=$7 WHERE id=$8`,
    [...tripValues(input), tripId],
  );
}
export async function updateDraft(
  client: PoolClient,
  id: string,
  input: RequestInput,
  total: string,
) {
  await client.query(
    `UPDATE travel_requests SET estimated_total=$1,currency=$2,employee_comment=$3,
        version=version+1,updated_at=now() WHERE id=$4`,
    [total, input.currency, input.employee_comment, id],
  );
}
export async function createTrip(client: PoolClient, input: RequestInput) {
  return (
    await client.query(
      `INSERT INTO trips(destination_country,destination_city,purpose,start_date,end_date,
      transport_type,accommodation_required) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      tripValues(input),
    )
  ).rows[0].id as string;
}
export async function allocateId(client: PoolClient) {
  return (
    await client.query(
      `SELECT nextval(pg_get_serial_sequence('trip_app.travel_requests','id'))::text AS id`,
    )
  ).rows[0].id as string;
}
export async function insertDraft(
  client: PoolClient,
  requestId: string,
  number: string,
  employeeId: string,
  tripId: string,
  input: RequestInput,
  total: string,
) {
  await client.query(
    `INSERT INTO travel_requests(id,number,employee_id,trip_id,estimated_total,currency,employee_comment)
      OVERRIDING SYSTEM VALUE VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      requestId,
      number,
      employeeId,
      tripId,
      total,
      input.currency,
      input.employee_comment,
    ],
  );
}
export async function deleteById(client: PoolClient, id: string) {
  await client.query("DELETE FROM travel_requests WHERE id=$1", [id]);
}
export async function deleteTrip(client: PoolClient, tripId: string) {
  await client.query("DELETE FROM trips WHERE id=$1", [tripId]);
}
export async function countExpenses(client: PoolClient, id: string) {
  return Number(
    (
      await client.query(
        "SELECT count(*) FROM expense_estimates WHERE request_id=$1",
        [id],
      )
    ).rows[0].count,
  );
}
export async function markSubmitted(
  client: PoolClient,
  id: string,
  routeId: string,
) {
  await client.query(
    `UPDATE travel_requests SET status='SUBMITTED',submitted_at=now(),approval_route_id=$2,
      updated_at=now(),version=version+1 WHERE id=$1`,
    [id, routeId],
  );
}
export async function findForUpdate(client: PoolClient, id: string) {
  return (
    await client.query("SELECT * FROM travel_requests WHERE id=$1 FOR UPDATE", [
      id,
    ])
  ).rows[0];
}
export async function updateDecisionStatus(
  client: PoolClient,
  id: string,
  newStatus: string,
) {
  await client.query(
    `UPDATE travel_requests SET status=$2::varchar,decided_at=CASE WHEN $2::varchar IN ('APPROVED','REJECTED') THEN now() ELSE NULL END,
      version=version+1,updated_at=now() WHERE id=$1`,
    [id, newStatus],
  );
}

export async function markCanceled(
  client: PoolClient,
  id: string,
  reason: string,
) {
  await client.query(
    `UPDATE travel_requests SET status='CANCELED', submitted_at=COALESCE(submitted_at,now()), canceled_at=now(), cancellation_reason=$2,
      updated_at=now(), version=version+1 WHERE id=$1`,
    [id, reason],
  );
}
