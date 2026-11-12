"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, type FormEvent } from "react";
import { adminApi } from "../../services/admin";
import { useResource } from "../../hooks/use-resource";
import { ErrorAlert, Loading } from "../ui/feedback";
import { RequestTable } from "../requests/request-table";
import { AdminPagination } from "./admin-pagination";
export function AdminRequests() {
  const params = useSearchParams();
  const query = params.toString();
  const router = useRouter();
  const load = useCallback(() => adminApi.requests(query), [query]);
  const { data, loading, error, reload } = useResource(load);
  const metadata = useResource(adminApi.metadata);
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    if (params.get("employee_id"))
      next.set("employee_id", params.get("employee_id")!);
    for (const key of ["q", "department_id", "status", "from", "to"]) {
      const value = fields.get(key);
      if (value) next.set(key, String(value));
    }
    router.push(`/admin/requests?${next}`);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">АДМИНИСТРИРОВАНИЕ</p>
          <h1>Все заявки</h1>
          <p className="muted">
            Поездки всех сотрудников, маршруты и история решений.
          </p>
        </div>
      </div>
      {params.has("employee_id") && (
        <p>
          Выбраны заявки одного сотрудника.{" "}
          <Link className="text-button" href="/admin/requests">
            Показать всех сотрудников
          </Link>
        </p>
      )}
      <form className="filters" key={query} onSubmit={filter}>
        <label>
          Поиск
          <input
            name="q"
            defaultValue={params.get("q") || ""}
            placeholder="Номер заявки или ФИО"
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
          Статус
          <select name="status" defaultValue={params.get("status") || ""}>
            <option value="">Все статусы</option>
            {[
              ["DRAFT", "Черновик"],
              ["SUBMITTED", "Отправлена"],
              ["UNDER_REVIEW", "На согласовании"],
              ["APPROVED", "Согласована"],
              ["REJECTED", "Отклонена"],
              ["CANCELED", "Отменена"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Начало поездки от
          <input
            name="from"
            type="date"
            defaultValue={params.get("from") || ""}
          />
        </label>
        <label>
          Окончание до
          <input name="to" type="date" defaultValue={params.get("to") || ""} />
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
          <strong>Все заявки</strong>
          <span>{data?.total ?? ""}</span>
        </div>
        {loading ? (
          <Loading>Загружаем заявки…</Loading>
        ) : data && !data.items.length ? (
          <div className="empty">
            Заявки не найдены. Измените условия поиска.
          </div>
        ) : (
          data && (
            <RequestTable
              items={data.items}
              admin
              adminReturnTo={`/admin/requests${query ? "?" + query : ""}`}
            />
          )
        )}
        {data && (
          <AdminPagination
            base="/admin/requests"
            query={query}
            page={data.page}
            total={data.total}
          />
        )}
      </section>
    </>
  );
}
