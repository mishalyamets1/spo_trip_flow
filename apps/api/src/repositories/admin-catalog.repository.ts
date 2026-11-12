import type { PoolClient } from "pg";
import { pool } from "../db.js";
import type {
  CatalogKind,
  CatalogInput,
} from "../validators/catalog.validation.js";
export type CatalogEntry = {
  id: string;
  name: string;
  code?: string;
  is_active: boolean;
  version: number;
  reference_count: number;
};
// Table names and dependency predicates are static, never taken from HTTP input.
const definitions = {
  departments: {
    table: "departments",
    references:
      "(SELECT count(*) FROM employees e WHERE e.department_id=c.id)+(SELECT count(*) FROM approval_routes r WHERE r.department_id=c.id)",
  },
  "expense-categories": {
    table: "expense_categories",
    references:
      "(SELECT count(*) FROM expense_estimates x WHERE x.category_id=c.id)",
  },
} as const;
export async function list(
  kind: CatalogKind,
  client: Pick<PoolClient, "query"> = pool,
) {
  const def = definitions[kind];
  return (
    await client.query<CatalogEntry>(
      `SELECT c.*,c.id::text AS id,(${def.references})::int AS reference_count FROM ${def.table} c ORDER BY c.name,c.id`,
    )
  ).rows;
}
export async function lock(client: PoolClient, kind: CatalogKind, id: string) {
  return (
    await client.query<CatalogEntry>(
      `SELECT c.*,c.id::text AS id FROM ${definitions[kind].table} c WHERE id=$1 FOR UPDATE`,
      [id],
    )
  ).rows[0];
}
export async function save(
  client: PoolClient,
  kind: CatalogKind,
  input: CatalogInput,
  id?: string,
) {
  const table = definitions[kind].table;
  if (id) {
    if (kind === "expense-categories")
      await client.query(
        `UPDATE ${table} SET name=$2,code=$3,is_active=$4,version=version+1 WHERE id=$1`,
        [id, input.name, input.code, input.is_active],
      );
    else
      await client.query(
        `UPDATE ${table} SET name=$2,is_active=$3,version=version+1 WHERE id=$1`,
        [id, input.name, input.is_active],
      );
    return id;
  }
  const row =
    kind === "expense-categories"
      ? await client.query<{ id: string }>(
          `INSERT INTO ${table}(name,code,is_active) VALUES($1,$2,$3) RETURNING id::text`,
          [input.name, input.code, input.is_active],
        )
      : await client.query<{ id: string }>(
          `INSERT INTO ${table}(name,is_active) VALUES($1,$2) RETURNING id::text`,
          [input.name, input.is_active],
        );
  return row.rows[0].id;
}
export async function remove(
  client: PoolClient,
  kind: CatalogKind,
  id: string,
) {
  await client.query(`DELETE FROM ${definitions[kind].table} WHERE id=$1`, [
    id,
  ]);
}
export async function activeDepartment(client: PoolClient, id: string) {
  return Boolean(
    (
      await client.query(
        "SELECT 1 FROM departments WHERE id=$1 AND is_active",
        [id],
      )
    ).rowCount,
  );
}
