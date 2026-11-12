"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, type FormEvent } from "react";
import { adminApi } from "../../services/admin";
import { useResource } from "../../hooks/use-resource";
import { ErrorAlert, Loading } from "../ui/feedback";
import { AdminPagination } from "./admin-pagination";
export function EmployeeList() {
  const params = useSearchParams();
  const query = params.toString();
  const router = useRouter();
  const load = useCallback(() => adminApi.employees(query), [query]);
  const { data, loading, error, reload } = useResource(load);
  const metadata = useResource(adminApi.metadata);
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const key of ["q", "department_id", "active"]) {
      const value = fields.get(key);
      if (value) next.set(key, String(value));
    }
    router.push(`/admin/employees?${next}`);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">АДМИНИСТРИРОВАНИЕ</p>
          <h1>Сотрудники</h1>
          <p className="muted">Учётные записи, роли и доступ к системе.</p>
        </div>
        <Link className="primary" href="/admin/employees/new">
          + Новый сотрудник
        </Link>
      </div>
      <form className="filters" key={query} onSubmit={filter}>
        <label>
          Поиск
          <input
            name="q"
            defaultValue={params.get("q") || ""}
            placeholder="ФИО, почта или табельный номер"
            maxLength={200}
          />
        </label>
        <label>
          Подразделение
          <select
            name="department_id"
            defaultValue={params.get("department_id") || ""}
          >
            <option value="">Все подразделения</option>
            {metadata.data?.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Доступ
          <select name="active" defaultValue={params.get("active") || ""}>
            <option value="">Все сотрудники</option>
            <option value="true">Активные</option>
            <option value="false">Заблокированные</option>
          </select>
        </label>
        <button className="secondary">Найти</button>
      </form>
      <ErrorAlert
        message={error || metadata.error}
        onRetry={() => {
          reload();
          metadata.reload();
        }}
      />
      <section className="list-panel" aria-busy={loading}>
        <div className="list-caption">
          <strong>Сотрудники</strong>
          <span>{data?.total ?? ""}</span>
        </div>
        {loading ? (
          <Loading>Загружаем сотрудников…</Loading>
        ) : data && !data.items.length ? (
          <div className="empty">
            Сотрудники не найдены. Измените условия поиска.
          </div>
        ) : (
          data && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Подразделение</th>
                    <th>Роли</th>
                    <th>Доступ</th>
                    <th>Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <Link
                          className="request-link"
                          href={`/admin/employees/${e.id}`}
                        >
                          {e.full_name}
                        </Link>
                        <span className="cell-subtitle">
                          {e.email} · {e.employee_number}
                        </span>
                      </td>
                      <td>
                        {e.department_name}
                        <span className="cell-subtitle">{e.position}</span>
                      </td>
                      <td>
                        {e.roles
                          .map(
                            (r) =>
                              ({
                                EMPLOYEE: "Сотрудник",
                                APPROVER: "Согласующий",
                                ADMIN: "Администратор",
                              })[r] || r,
                          )
                          .join(", ")}
                      </td>
                      <td>{e.is_active ? "Активен" : "Заблокирован"}</td>
                      <td>
                        <Link
                          href={`/admin/employees/${e.id}`}
                          className="text-button"
                        >
                          Открыть →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        {data && (
          <AdminPagination
            base="/admin/employees"
            query={query}
            page={data.page}
            total={data.total}
          />
        )}
      </section>
    </>
  );
}
