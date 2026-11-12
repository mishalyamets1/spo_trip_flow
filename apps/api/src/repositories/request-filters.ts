export type RequestFilters = {
  q?: string;
  employee_id?: string;
  department_id?: string;
  status?: string;
  from?: string;
  to?: string;
};
// Only values come from the caller; SQL columns/operators are fixed here.
export function requestWhere(filter: RequestFilters, ownerId?: string) {
  const params: unknown[] = [];
  const conditions: string[] = [];
  if (filter.q) {
    params.push(`%${filter.q}%`);
    conditions.push(
      `(r.number ILIKE $${params.length} OR e.full_name ILIKE $${params.length})`,
    );
  }
  for (const [expression, value] of [
    ["r.employee_id =", ownerId || filter.employee_id],
    ["e.department_id =", filter.department_id],
    ["r.status =", filter.status],
    ["t.start_date >=", filter.from],
    ["t.end_date <=", filter.to],
  ] as const) {
    if (value) {
      params.push(value);
      conditions.push(`${expression}$${params.length}`);
    }
  }
  return {
    params,
    where: conditions.length ? " WHERE " + conditions.join(" AND ") : "",
  };
}
