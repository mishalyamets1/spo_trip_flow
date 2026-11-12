"use client";
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { adminApi } from "../../services/admin";
import { useResource } from "../../hooks/use-resource";
import { ErrorAlert, Loading } from "../ui/feedback";
import { AdminPagination } from "./admin-pagination";
const labels: Record<string, string> = {
  "employee.create": "Создан сотрудник",
  "employee.update": "Изменён сотрудник",
  "employee.delete": "Удалён сотрудник и его заявки",
  "request.cancel": "Заявка отменена администратором",
  "request.reassign": "Заменён согласующий",
  "route.save": "Сохранён маршрут",
};
export function AdminAudit() {
  const params = useSearchParams();
  const query = params.toString();
  const load = useCallback(() => adminApi.audit(query), [query]);
  const { data, loading, error, reload } = useResource(load);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">АДМИНИСТРИРОВАНИЕ</p>
          <h1>Журнал действий</h1>
          <p className="muted">Кто и почему изменил данные или доступ.</p>
        </div>
      </div>
      <ErrorAlert message={error} onRetry={reload} />
      <section className="list-panel" aria-busy={loading}>
        {loading ? (
          <Loading>Загружаем журнал…</Loading>
        ) : data && !data.items.length ? (
          <div className="empty">Действий администратора пока нет.</div>
        ) : (
          data && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Администратор</th>
                    <th>Действие</th>
                    <th>Объект</th>
                    <th>Причина</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {new Date(item.created_at).toLocaleString("ru-RU")}
                      </td>
                      <td>{item.actor_name}</td>
                      <td>{labels[item.action] || item.action}</td>
                      <td>
                        {{
                          employee: "Сотрудник",
                          request: "Заявка",
                          route: "Маршрут",
                        }[item.entity_type] || item.entity_type}{" "}
                        №{item.entity_id}
                      </td>
                      <td className="decision-comment">{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        {data && (
          <AdminPagination
            base="/admin/audit"
            query={query}
            page={data.page}
            total={data.total}
          />
        )}
      </section>
    </>
  );
}
