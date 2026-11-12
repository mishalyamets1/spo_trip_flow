"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "../../services/admin";
import type { AdminEmployee, EmployeePreview } from "../../types/admin";
import { useApiAction } from "../../hooks/use-api-action";
import { ErrorAlert } from "../ui/feedback";
export function EmployeeDelete({
  preview,
  approvers,
  onRefresh,
}: {
  preview: EmployeePreview;
  approvers: AdminEmployee[];
  onRefresh: () => void;
}) {
  const [opened, setOpened] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const action = useApiAction();
  const router = useRouter();
  const { employee, request_count, pending_count, route_count } = preview;
  const replacementRequired = pending_count > 0 || route_count > 0;
  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmation !== employee.employee_number) return;
    const form = new FormData(event.currentTarget);
    const replacement = String(form.get("replacement") || "");
    await action.run(async () => {
      await adminApi.deleteEmployee(employee.id, {
        version: employee.version,
        expected_request_count: request_count,
        reason: String(form.get("reason")),
        ...(replacement ? { replacement_employee_id: replacement } : {}),
      });
      router.replace("/admin/employees");
    });
  }
  return (
    <section className="section-panel admin-danger">
      <h2>Удаление сотрудника</h2>
      <p>
        Будут удалены учётная запись и все созданные сотрудником заявки:{" "}
        <strong>{request_count}</strong>. Вместе с заявками удалятся сметы,
        поездки, этапы и история. Восстановления через интерфейс нет.
      </p>
      <p className="muted">
        Решения в чужих заявках сохранятся с именем сотрудника.
      </p>
      {!opened ? (
        <button className="danger" onClick={() => setOpened(true)}>
          Удалить сотрудника и его заявки
        </button>
      ) : (
        <form className="actions" onSubmit={remove}>
          <fieldset disabled={action.busy}>
            {replacementRequired && (
              <>
                <p>
                  Нужна замена: ожидающих этапов в чужих заявках —{" "}
                  {pending_count}, назначений в шаблонах — {route_count}.
                </p>
                <label>
                  Новый согласующий
                  <select name="replacement" required defaultValue="">
                    <option value="" disabled>
                      Выберите сотрудника
                    </option>
                    {approvers
                      .filter((p) => p.id !== employee.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name}
                        </option>
                      ))}
                  </select>
                </label>
              </>
            )}
            <label>
              Причина удаления
              <textarea name="reason" required maxLength={2000} rows={2} />
            </label>
            <label>
              Для подтверждения введите табельный номер «
              {employee.employee_number}»
              <input
                required
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
              />
            </label>
            <div className="admin-actions">
              <button
                className="danger"
                disabled={confirmation !== employee.employee_number}
              >
                {action.busy
                  ? "Удаляем…"
                  : `Удалить сотрудника и заявки (${request_count})`}
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  setOpened(false);
                  setConfirmation("");
                  action.clearError();
                }}
              >
                Не удалять
              </button>
            </div>
          </fieldset>
          <ErrorAlert
            message={action.error}
            onRetry={() => {
              action.clearError();
              setOpened(false);
              onRefresh();
            }}
            retryLabel="Обновить данные"
          />
        </form>
      )}
    </section>
  );
}
