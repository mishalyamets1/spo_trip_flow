"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { adminApi } from "../../services/admin";
import { useResource } from "../../hooks/use-resource";
import { useApiAction } from "../../hooks/use-api-action";
import { useAuth } from "../../providers/auth-provider";
import { ErrorAlert, Loading, Notice } from "../ui/feedback";
import { EmployeeDelete } from "./employee-delete";
export function EmployeeEditor({ id }: { id?: string }) {
  const router = useRouter();
  const { user, retry: refreshSession } = useAuth();
  const [notice, setNotice] = useState("");
  const action = useApiAction();
  const load = useCallback(async () => {
    const [metadata, preview] = await Promise.all([
      adminApi.metadata(),
      id ? adminApi.employee(id) : Promise.resolve(null),
    ]);
    return { metadata, preview };
  }, [id]);
  const { data, loading, error, reload } = useResource(load);
  const employee = data?.preview?.employee;
  const self = employee?.user_id === user?.id;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    const form = new FormData(event.currentTarget);
    const body = {
      full_name: form.get("full_name"),
      email: form.get("email"),
      employee_number: form.get("employee_number"),
      position: form.get("position"),
      department_id: form.get("department_id"),
      phone: form.get("phone"),
      hire_date: form.get("hire_date"),
      is_active: form.has("is_active"),
      roles: form.getAll("roles"),
      ...(id
        ? { version: employee?.version }
        : { password: form.get("password") }),
    };
    await action.run(async () => {
      const result = await adminApi.saveEmployee(id, body);
      if (id) {
        setNotice("Данные сотрудника сохранены");
        if (self) refreshSession();
        reload();
      } else router.replace(`/admin/employees/${result.id}`);
    });
  }
  return (
    <>
      <Link className="text-button back" href="/admin/employees">
        ← К сотрудникам
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">УЧЁТНАЯ ЗАПИСЬ</p>
          <h1>{id ? "Карточка сотрудника" : "Новый сотрудник"}</h1>
        </div>
        {employee && (
          <Link
            className="secondary"
            href={`/admin/requests?employee_id=${employee.id}`}
          >
            Заявки сотрудника ({data?.preview?.request_count ?? 0})
          </Link>
        )}
      </div>
      {notice && <Notice>{notice}</Notice>}
      <ErrorAlert
        message={error || action.error}
        onRetry={() => {
          action.clearError();
          reload();
        }}
        retryLabel="Обновить данные"
      />
      {loading ? (
        <Loading>Загружаем сотрудника…</Loading>
      ) : (
        data && (
          <>
            <form
              key={employee ? `${employee.id}:${employee.version}` : "new"}
              className="request-form"
              onSubmit={save}
            >
              <fieldset disabled={action.busy}>
                <section className="section-panel">
                  <div className="form-grid">
                    <label>
                      ФИО
                      <input
                        name="full_name"
                        required
                        minLength={5}
                        maxLength={200}
                        defaultValue={employee?.full_name}
                      />
                    </label>
                    <label>
                      Электронная почта
                      <input
                        name="email"
                        type="email"
                        required
                        maxLength={254}
                        defaultValue={employee?.email}
                        autoComplete="off"
                      />
                    </label>
                    <label>
                      Табельный номер
                      <input
                        name="employee_number"
                        required
                        maxLength={30}
                        defaultValue={employee?.employee_number}
                      />
                    </label>
                    <label>
                      Должность
                      <input
                        name="position"
                        required
                        maxLength={150}
                        defaultValue={employee?.position}
                      />
                    </label>
                    <label>
                      Подразделение
                      <select
                        name="department_id"
                        required
                        defaultValue={
                          employee?.department_id ||
                          data.metadata.departments[0]?.id
                        }
                      >
                        {data.metadata.departments.map((d) => (
                          <option
                            key={d.id}
                            value={d.id}
                            disabled={
                              !d.is_active && employee?.department_id !== d.id
                            }
                          >
                            {d.name}
                            {d.is_active ? "" : " (отключено)"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Телефон
                      <input
                        name="phone"
                        maxLength={30}
                        defaultValue={employee?.phone || ""}
                      />
                    </label>
                    <label>
                      Дата приёма
                      <input
                        name="hire_date"
                        type="date"
                        required
                        defaultValue={
                          employee?.hire_date.slice(0, 10) ||
                          new Date().toISOString().slice(0, 10)
                        }
                      />
                    </label>
                    {!id && (
                      <label>
                        Начальный пароль
                        <input
                          name="password"
                          type="password"
                          required
                          minLength={12}
                          maxLength={128}
                          autoComplete="new-password"
                        />
                        <span className="muted small">
                          От 12 символов. Передайте пароль сотруднику отдельно.
                        </span>
                      </label>
                    )}
                  </div>
                  <h2>Роли</h2>
                  <p className="muted small">
                    Сотрудник создаёт свои заявки. Согласующий принимает решения
                    по назначениям. Администратор управляет системой.
                  </p>
                  <div className="admin-checkboxes">
                    {[
                      ["EMPLOYEE", "Сотрудник"],
                      ["APPROVER", "Согласующий"],
                      ["ADMIN", "Администратор"],
                    ].map(([value, label]) => (
                      <label key={value}>
                        <input
                          type="checkbox"
                          name="roles"
                          value={value}
                          defaultChecked={
                            employee
                              ? employee.roles.includes(value)
                              : value === "EMPLOYEE"
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <label className="admin-check">
                    <input
                      type="checkbox"
                      name="is_active"
                      defaultChecked={employee?.is_active ?? true}
                    />
                    Вход в систему разрешён
                  </label>
                  {self && (
                    <p className="muted small">
                      Собственную учётную запись администратора нельзя
                      отключить, удалить или лишить роли ADMIN.
                    </p>
                  )}
                </section>
                <div className="form-footer">
                  <span className="muted">
                    {employee?.full_name || "Новая учётная запись"}
                  </span>
                  <button className="primary">
                    {action.busy ? "Сохраняем…" : "Сохранить сотрудника"}
                  </button>
                </div>
              </fieldset>
            </form>
            {id && data.preview && !self && (
              <EmployeeDelete
                key={`delete-${employee?.version}`}
                preview={data.preview}
                approvers={data.metadata.approvers}
                onRefresh={reload}
              />
            )}
            {id && self && (
              <Notice>Вы просматриваете свою учётную запись.</Notice>
            )}
          </>
        )
      )}
    </>
  );
}
