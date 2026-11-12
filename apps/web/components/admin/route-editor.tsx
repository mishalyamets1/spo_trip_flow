"use client";
import { useState, type FormEvent } from "react";
import type { AdminRoute, AdminMetadata } from "../../types/admin";
import { adminApi } from "../../services/admin";
import { useApiAction } from "../../hooks/use-api-action";
import { ErrorAlert } from "../ui/feedback";
export function RouteEditor({
  route,
  metadata,
  onSaved,
  onClose,
}: {
  route?: AdminRoute;
  metadata: AdminMetadata;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [ids, setIds] = useState(
    route?.steps.map((s) => s.employee_id) || [""],
  );
  const action = useApiAction();
  function move(index: number, offset: number) {
    const next = [...ids];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setIds(next);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.run(async () => {
      await adminApi.saveRoute(route?.id, {
        version: route?.version ?? 0,
        department_id:
          route?.department_id || String(form.get("department_id")),
        name: String(form.get("name")),
        is_active: form.has("is_active"),
        approver_ids: ids,
      });
      onSaved();
      onClose();
    });
  }
  return (
    <section className="section-panel">
      <h2>{route ? "Редактирование маршрута" : "Новый маршрут"}</h2>
      <form onSubmit={save}>
        <fieldset disabled={action.busy}>
          <div className="form-grid">
            <label>
              Название
              <input
                name="name"
                required
                maxLength={150}
                defaultValue={route?.name}
              />
            </label>
            <label>
              Подразделение
              <select
                name="department_id"
                required
                disabled={!!route}
                defaultValue={
                  route?.department_id || metadata.departments[0]?.id
                }
              >
                {metadata.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="admin-check">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={route?.is_active ?? true}
            />
            Маршрут активен
          </label>
          <p className="muted small">
            В подразделении может быть один активный маршрут. Изменения
            применяются к новым отправкам; отправленные заявки сохраняют свои
            этапы. Автор не должен быть участником собственного маршрута.
          </p>
          <ol className="admin-route-steps">
            {ids.map((id, index) => (
              <li key={index}>
                <label>
                  Согласующий, этап {index + 1}
                  <select
                    required
                    value={id}
                    onChange={(event) =>
                      setIds(
                        ids.map((value, i) =>
                          i === index ? event.target.value : value,
                        ),
                      )
                    }
                  >
                    <option value="" disabled>
                      Выберите сотрудника
                    </option>
                    {id && !metadata.approvers.some((e) => e.id === id) && (
                      <option value={id}>
                        {route?.steps.find((s) => s.employee_id === id)
                          ?.full_name || "Недоступный сотрудник"}{" "}
                        (недоступен)
                      </option>
                    )}
                    {metadata.approvers.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="admin-actions">
                  <button
                    type="button"
                    className="secondary"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={`Этап ${index + 1} вверх`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={index === ids.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={`Этап ${index + 1} вниз`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={ids.length <= 1}
                    onClick={() => setIds(ids.filter((_, i) => i !== index))}
                  >
                    Убрать этап
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="secondary"
            disabled={ids.length >= 20}
            onClick={() => setIds([...ids, ""])}
          >
            + Добавить этап
          </button>
          <div className="admin-actions">
            <button className="primary">
              {action.busy ? "Сохраняем…" : "Сохранить маршрут"}
            </button>
            <button className="secondary" type="button" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </fieldset>
        <ErrorAlert
          message={action.error}
          onRetry={() => {
            onSaved();
            onClose();
          }}
          retryLabel="Обновить список"
        />
      </form>
    </section>
  );
}
