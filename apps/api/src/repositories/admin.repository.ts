import type { PoolClient } from "pg";
import { pool } from "../db.js";
import type { User } from "../types/user.js";
import type { EmployeeInput } from "../validators/admin.validation.js";
import { fields, joins } from "./request.repository.js";
import { requestWhere } from "./request-filters.js";

const employeeSelect = `SELECT e.*,to_char(e.hire_date,'YYYY-MM-DD') AS hire_date,u.email,u.is_active,
 d.name AS department_name,ARRAY(SELECT r.code FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id ORDER BY r.code) AS roles
 FROM employees e JOIN users u ON u.id=e.user_id JOIN departments d ON d.id=e.department_id`;
export async function metadata() {
  const [departments, approvers] = await Promise.all([
    pool.query("SELECT id,name,is_active FROM departments ORDER BY name,id"),
    pool.query(
      `${employeeSelect} WHERE u.is_active AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code='APPROVER') ORDER BY e.full_name,e.id`,
    ),
  ]);
  return { departments: departments.rows, approvers: approvers.rows };
}
export async function listEmployees(filter: {
  q?: string;
  department_id?: string;
  active?: string;
  page: number;
}) {
  const params: unknown[] = [];
  const where: string[] = [];
  if (filter.q) {
    params.push(`%${filter.q}%`);
    where.push(
      `(e.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR e.employee_number ILIKE $${params.length})`,
    );
  }
  if (filter.department_id) {
    params.push(filter.department_id);
    where.push(`e.department_id=$${params.length}`);
  }
  if (filter.active) {
    params.push(filter.active === "true");
    where.push(`u.is_active=$${params.length}`);
  }
  const sql = `${employeeSelect}${where.length ? " WHERE " + where.join(" AND ") : ""}`;
  const count = await pool.query(`SELECT count(*) FROM (${sql}) s`, params);
  params.push(20, (filter.page - 1) * 20);
  const rows = await pool.query(
    `${sql} ORDER BY e.full_name,e.id LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return {
    items: rows.rows,
    total: Number(count.rows[0].count),
    page: filter.page,
    page_size: 20,
  };
}
export async function findEmployee(
  id: string,
  client: Pick<PoolClient, "query"> = pool,
) {
  return (await client.query(`${employeeSelect} WHERE e.id=$1`, [id])).rows[0];
}
export async function lockAdministration(client: PoolClient) {
  await client.query("SELECT pg_advisory_xact_lock(71624006)");
}
export async function lockEmployee(client: PoolClient, id: string) {
  return (
    await client.query(
      "SELECT e.*,u.is_active FROM employees e JOIN users u ON u.id=e.user_id WHERE e.id=$1 FOR UPDATE OF e,u",
      [id],
    )
  ).rows[0];
}
export async function audit(
  client: PoolClient,
  user: User,
  action: string,
  entity: string,
  id: string,
  reason: string,
  details: object = {},
) {
  await client.query(
    `INSERT INTO admin_audit_log(actor_user_id,actor_name,action,entity_type,entity_id,reason,details) VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [
      user.id,
      user.full_name,
      action,
      entity,
      id,
      reason,
      JSON.stringify(details),
    ],
  );
}
export async function activeAdminCount(
  client: PoolClient,
  exceptUserId: string,
) {
  return Number(
    (
      await client.query(
        `SELECT count(*) FROM users u WHERE u.is_active AND u.id<>$1 AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code='ADMIN')`,
        [exceptUserId],
      )
    ).rows[0].count,
  );
}
export async function writeEmployee(
  client: PoolClient,
  input: EmployeeInput,
  id?: string,
  hash?: string,
) {
  let userId: string;
  if (id) {
    userId = (
      await client.query("SELECT user_id FROM employees WHERE id=$1", [id])
    ).rows[0].user_id;
    await client.query("UPDATE users SET email=$2,is_active=$3 WHERE id=$1", [
      userId,
      input.email,
      input.is_active,
    ]);
    await client.query(
      `UPDATE employees SET full_name=$2,employee_number=$3,position=$4,department_id=$5,phone=$6,hire_date=$7,version=version+1 WHERE id=$1`,
      [
        id,
        input.full_name,
        input.employee_number,
        input.position,
        input.department_id,
        input.phone,
        input.hire_date,
      ],
    );
  } else {
    userId = (
      await client.query(
        "INSERT INTO users(email,password_hash,is_active) VALUES($1,$2,$3) RETURNING id",
        [input.email, hash, input.is_active],
      )
    ).rows[0].id;
    id = (
      await client.query(
        `INSERT INTO employees(user_id,full_name,employee_number,position,department_id,phone,hire_date) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [
          userId,
          input.full_name,
          input.employee_number,
          input.position,
          input.department_id,
          input.phone,
          input.hire_date,
        ],
      )
    ).rows[0].id;
  }
  await client.query("DELETE FROM user_roles WHERE user_id=$1", [userId]);
  await client.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code=ANY($2::text[])",
    [userId, input.roles],
  );
  if (!input.is_active)
    await client.query("DELETE FROM sessions WHERE user_id=$1", [userId]);
  return id!;
}
export async function dependencies(
  client: Pick<PoolClient, "query">,
  id: string,
) {
  const result = await client.query(
    `SELECT
 (SELECT count(*) FROM travel_requests WHERE employee_id=$1)::int AS request_count,
 (SELECT count(*) FROM approval_steps a JOIN travel_requests r ON r.id=a.request_id WHERE a.approver_employee_id=$1 AND a.status='PENDING' AND r.employee_id<>$1)::int AS pending_count,
 (SELECT count(*) FROM approval_route_steps WHERE approver_employee_id=$1)::int AS route_count`,
    [id],
  );
  return result.rows[0] as {
    request_count: number;
    pending_count: number;
    route_count: number;
  };
}
export async function lockAffectedRequests(client: PoolClient, id: string) {
  await client.query(
    `SELECT id FROM travel_requests WHERE employee_id=$1 OR id IN(SELECT request_id FROM approval_steps WHERE approver_employee_id=$1 AND status='PENDING') ORDER BY id FOR UPDATE`,
    [id],
  );
}
export async function validApprover(client: PoolClient, id: string) {
  return (
    await client.query(
      `${employeeSelect} WHERE e.id=$1 AND u.is_active AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code='APPROVER')`,
      [id],
    )
  ).rows[0];
}
export async function replacementConflicts(
  client: PoolClient,
  id: string,
  replacement: string,
) {
  return Boolean(
    (
      await client.query(
        `SELECT 1 FROM approval_steps a JOIN travel_requests r ON r.id=a.request_id
 WHERE a.approver_employee_id=$1 AND a.status='PENDING' AND r.employee_id<>$1
 AND (r.employee_id=$2 OR EXISTS(SELECT 1 FROM approval_steps b WHERE b.request_id=r.id AND b.approver_employee_id=$2))
 UNION ALL SELECT 1 FROM approval_route_steps a JOIN approval_route_steps b ON b.route_id=a.route_id
 WHERE a.approver_employee_id=$1 AND b.approver_employee_id=$2 LIMIT 1`,
        [id, replacement],
      )
    ).rowCount,
  );
}
export async function replaceAssignments(
  client: PoolClient,
  id: string,
  replacement: string,
  name: string,
) {
  await client.query(
    `UPDATE travel_requests SET version=version+1,updated_at=now() WHERE employee_id<>$1 AND id IN(SELECT request_id FROM approval_steps WHERE approver_employee_id=$1 AND status='PENDING')`,
    [id],
  );
  await client.query(
    `UPDATE approval_steps SET approver_employee_id=$2,approver_name_snapshot=$3 WHERE approver_employee_id=$1 AND status='PENDING' AND request_id IN(SELECT id FROM travel_requests WHERE employee_id<>$1)`,
    [id, replacement, name],
  );
  await client.query(
    `UPDATE approval_routes SET version=version+1 WHERE id IN(SELECT route_id FROM approval_route_steps WHERE approver_employee_id=$1)`,
    [id],
  );
  await client.query(
    "UPDATE approval_route_steps SET approver_employee_id=$2 WHERE approver_employee_id=$1",
    [id, replacement],
  );
}
export async function eraseEmployee(
  client: PoolClient,
  id: string,
  userId: string,
) {
  const trips = await client.query(
    "DELETE FROM travel_requests WHERE employee_id=$1 RETURNING trip_id",
    [id],
  );
  await client.query("DELETE FROM trips WHERE id=ANY($1::bigint[])", [
    trips.rows.map((r) => r.trip_id),
  ]);
  await client.query("DELETE FROM employees WHERE id=$1", [id]);
  await client.query("DELETE FROM users WHERE id=$1", [userId]);
}
export async function listRequests(filter: {
  q?: string;
  employee_id?: string;
  department_id?: string;
  status?: string;
  from?: string;
  to?: string;
  page: number;
}) {
  const { params, where } = requestWhere(filter);
  const source = `${joins}${where}`;
  const count = await pool.query(`SELECT count(*) ${source}`, params);
  params.push(20, (filter.page - 1) * 20);
  const result = await pool.query(
    `SELECT ${fields} ${source} ORDER BY r.created_at DESC,r.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return {
    items: result.rows,
    total: Number(count.rows[0].count),
    page: filter.page,
    page_size: 20,
  };
}
export async function findRequest(
  client: Pick<PoolClient, "query">,
  id: string,
) {
  return (await client.query(`SELECT ${fields} ${joins} WHERE r.id=$1`, [id]))
    .rows[0];
}
export async function routes(client: Pick<PoolClient, "query"> = pool) {
  return (
    await client.query(`SELECT r.*,d.name AS department_name,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('employee_id',s.approver_employee_id::text,'full_name',e.full_name,'step_order',s.step_order) ORDER BY s.step_order) FROM approval_route_steps s JOIN employees e ON e.id=s.approver_employee_id WHERE s.route_id=r.id),'[]') AS steps
 FROM approval_routes r JOIN departments d ON d.id=r.department_id ORDER BY d.name,r.id`)
  ).rows;
}
export async function saveRoute(
  client: PoolClient,
  input: {
    department_id: string;
    name: string;
    is_active: boolean;
    version: number;
    approver_ids: string[];
  },
  id?: string,
) {
  if (id)
    await client.query(
      "UPDATE approval_routes SET name=$2,is_active=$3,version=version+1 WHERE id=$1",
      [id, input.name, input.is_active],
    );
  else
    id = (
      await client.query(
        "INSERT INTO approval_routes(department_id,name,is_active) VALUES($1,$2,$3) RETURNING id",
        [input.department_id, input.name, input.is_active],
      )
    ).rows[0].id;
  await client.query("DELETE FROM approval_route_steps WHERE route_id=$1", [
    id,
  ]);
  for (const [i, employee] of input.approver_ids.entries())
    await client.query(
      "INSERT INTO approval_route_steps(route_id,step_order,approver_employee_id) VALUES($1,$2,$3)",
      [id, i + 1, employee],
    );
  return id!;
}
export async function listAudit(page: number) {
  const [count, items] = await Promise.all([
    pool.query("SELECT count(*) FROM admin_audit_log"),
    pool.query(
      "SELECT * FROM admin_audit_log ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET $1",
      [(page - 1) * 20],
    ),
  ]);
  return {
    items: items.rows,
    total: Number(count.rows[0].count),
    page,
    page_size: 20,
  };
}
