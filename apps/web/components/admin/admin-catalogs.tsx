"use client";
import { useCallback, useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import { useResource } from "../../hooks/use-resource";
import { useApiAction } from "../../hooks/use-api-action";
import { ErrorAlert, Loading, Notice } from "../ui/feedback";
type Entry = {
  id: string;
  name: string;
  code?: string;
  is_active: boolean;
  version: number;
  reference_count: number;
};
type Kind = "departments" | "expense-categories";
function Catalog({ kind }: { kind: Kind }) {
  const load = useCallback(
    () => api<{ items: Entry[] }>(`/admin/catalogs/${kind}`),
    [kind],
  );
  const { data, loading, error, reload } = useResource(load);
  const action = useApiAction();
  const [editing, setEditing] = useState<Entry | null | undefined>();
  const [notice, setNotice] = useState("");
  const categories = kind === "expense-categories";
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    const fields = new FormData(event.currentTarget);
    await action.run(async () => {
      await api(
        `/admin/catalogs/${kind}${editing ? "/" + editing.id : ""}`,
        editing ? "PATCH" : "POST",
        {
          name: String(fields.get("name")),
          is_active: fields.has("is_active"),
          ...(categories ? { code: String(fields.get("code")) } : {}),
          ...(editing ? { version: editing.version } : {}),
        },
      );
      setEditing(undefined);
      setNotice("Справочник сохранён");
      reload();
    });
  }
  async function remove(entry: Entry) {
    if (
      !window.confirm(`Удалить «${entry.name}»? Это действие нельзя отменить.`)
    )
      return;
    setNotice("");
    await action.run(async () => {
      await api(`/admin/catalogs/${kind}/${entry.id}`, "DELETE", {
        version: entry.version,
      });
      setNotice("Значение удалено");
      reload();
    });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h2>{categories ? "Категории расходов" : "Подразделения"}</h2>
          <p className="muted">
            Отключённые значения сохраняются в существующих данных.
          </p>
        </div>
        <button
          className="primary"
          disabled={action.busy}
          onClick={() => {
            setEditing(null);
            action.clearError();
          }}
        >
          + Добавить
        </button>
      </div>
      <ErrorAlert
        message={error || action.error}
        onRetry={() => {
          action.clearError();
          setEditing(undefined);
          reload();
        }}
        retryLabel="Обновить список"
      />
      {notice && <Notice>{notice}</Notice>}
      {editing !== undefined && (
        <form
          className="section-panel"
          key={editing?.id || "new"}
          onSubmit={save}
        >
          <h3>{editing ? "Редактирование" : "Новое значение"}</h3>
          <fieldset disabled={action.busy}>
            <div className="form-grid">
              <label>
                Название
                <input
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={editing?.name}
                />
              </label>
              {categories && (
                <label>
                  Код категории
                  <input
                    name="code"
                    required
                    pattern="[A-Z][A-Z0-9_]*"
                    maxLength={30}
                    placeholder="Например, TAXI"
                    defaultValue={editing?.code}
                  />
                </label>
              )}
            </div>
            <label className="admin-check">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={editing?.is_active ?? true}
              />
              Активно
            </label>
            <div className="admin-actions">
              <button className="primary">
                {action.busy ? "Сохраняем…" : "Сохранить"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setEditing(undefined)}
              >
                Закрыть
              </button>
            </div>
          </fieldset>
        </form>
      )}
      <section className="list-panel" aria-busy={loading}>
        {loading ? (
          <Loading>Загружаем справочник…</Loading>
        ) : data && !data.items.length ? (
          <div className="empty">Значений пока нет.</div>
        ) : (
          data && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Название</th>
                    {categories && <th>Код</th>}
                    <th>Доступность</th>
                    <th>Используется</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((e) => (
                    <tr key={e.id}>
                      <td>{e.name}</td>
                      {categories && <td>{e.code}</td>}
                      <td>{e.is_active ? "Активно" : "Отключено"}</td>
                      <td>
                        {e.reference_count > 0
                          ? "Да, связей: " + e.reference_count
                          : "Нет"}
                      </td>
                      <td>
                        <div className="admin-actions">
                          <button
                            className="text-button"
                            disabled={action.busy}
                            onClick={() => {
                              setEditing(e);
                              action.clearError();
                            }}
                          >
                            Редактировать
                          </button>
                          <button
                            className="text-button"
                            disabled={action.busy || e.reference_count > 0}
                            title={
                              e.reference_count
                                ? "Используется: можно отключить в редакторе"
                                : undefined
                            }
                            onClick={() => remove(e)}
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </section>
    </>
  );
}
export function AdminCatalogs() {
  const [kind, setKind] = useState<Kind>("departments");
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">АДМИНИСТРИРОВАНИЕ</p>
          <h1>Справочники</h1>
        </div>
      </div>
      <div className="admin-actions">
        <button
          className={kind === "departments" ? "primary" : "secondary"}
          onClick={() => setKind("departments")}
        >
          Подразделения
        </button>
        <button
          className={kind === "expense-categories" ? "primary" : "secondary"}
          onClick={() => setKind("expense-categories")}
        >
          Категории расходов
        </button>
      </div>
      <Catalog key={kind} kind={kind} />
    </>
  );
}
