"use client";
import { useState } from "react";
import { adminApi } from "../../services/admin";
import type { AdminRoute } from "../../types/admin";
import { useResource } from "../../hooks/use-resource";
import { ErrorAlert, Loading } from "../ui/feedback";
import { RouteEditor } from "./route-editor";
export function AdminRoutes() {
  const { data, loading, error, reload } = useResource(adminApi.routes);
  const metadata = useResource(adminApi.metadata);
  const [editing, setEditing] = useState<AdminRoute | null | undefined>();
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">АДМИНИСТРИРОВАНИЕ</p>
          <h1>Маршруты согласования</h1>
          <p className="muted">
            Порядок согласующих для каждого подразделения.
          </p>
        </div>
        <button className="primary" onClick={() => setEditing(null)}>
          + Новый маршрут
        </button>
      </div>
      <ErrorAlert
        message={error || metadata.error}
        onRetry={() => {
          setEditing(undefined);
          reload();
          metadata.reload();
        }}
      />
      {loading || metadata.loading ? (
        <Loading>Загружаем маршруты…</Loading>
      ) : (
        <>
          {editing !== undefined && metadata.data && (
            <RouteEditor
              key={editing?.id || "new"}
              route={editing || undefined}
              metadata={metadata.data}
              onSaved={reload}
              onClose={() => setEditing(undefined)}
            />
          )}
          {data && !data.items.length && (
            <div className="empty">
              Маршрутов пока нет. Создайте первый маршрут.
            </div>
          )}
          {data?.items.map((route) => (
            <section key={route.id} className="section-panel">
              <div className="page-heading">
                <div>
                  <h2>{route.name}</h2>
                  <p className="muted">
                    {route.department_name} ·{" "}
                    {route.is_active ? "Активен" : "Отключён"}
                  </p>
                </div>
                <button className="secondary" onClick={() => setEditing(route)}>
                  Редактировать
                </button>
              </div>
              <ol>
                {route.steps.map((step) => (
                  <li key={step.employee_id}>{step.full_name}</li>
                ))}
              </ol>
            </section>
          ))}
        </>
      )}
    </>
  );
}
