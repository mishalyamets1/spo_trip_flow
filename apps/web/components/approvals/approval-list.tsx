"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, type FormEvent } from "react";
import { approvalsApi } from "../../services/approvals";
import { useResource } from "../../hooks/use-resource";
import { useAuth } from "../../providers/auth-provider";
import { ErrorAlert, Loading } from "../ui/feedback";
import { RequestTable } from "../requests/request-table";

function Queue() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.toString();
  const processed = params.get("view") === "processed";
  const load = useCallback(() => approvalsApi.list(query), [query]);
  const { data, loading, error, reload } = useResource(load);
  const returnTo = `/approvals${query ? "?" + query : ""}`;
  function href(view: "pending" | "processed", page = 1) {
    const next = new URLSearchParams(query);
    next.set("view", view);
    next.set("page", String(page));
    if (view === "pending") next.delete("decision");
    return `/approvals?${next}`;
  }
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams({
      view: processed ? "processed" : "pending",
    });
    for (const key of ["decision", "from", "to"]) {
      const value = form.get(key);
      if (value) next.set(key, String(value));
    }
    router.push(`/approvals?${next}`);
  }
  return (
    <>
      <nav className="view-tabs" aria-label="Списки согласования">
        <Link
          className={!processed ? "tab-active" : ""}
          aria-current={!processed ? "page" : undefined}
          href={href("pending")}
        >
          Ожидают решения
        </Link>
        <Link
          className={processed ? "tab-active" : ""}
          aria-current={processed ? "page" : undefined}
          href={href("processed")}
        >
          Обработанные мной
        </Link>
      </nav>
      <p className="muted">
        {processed
          ? "Здесь сохраняются ваши решения, даже если заявка уже перешла к следующему согласующему."
          : "Показываем только текущие этапы. Заявка появится у следующего согласующего после вашего одобрения."}
      </p>
      <form className="filters" key={query} onSubmit={apply}>
        {processed && (
          <label>
            Моё решение
            <select name="decision" defaultValue={params.get("decision") || ""}>
              <option value="">Все решения</option>
              <option value="APPROVED">Согласовано</option>
              <option value="REJECTED">Отклонено</option>
            </select>
          </label>
        )}
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
        <button className="secondary">Применить</button>
      </form>
      <ErrorAlert message={error} onRetry={reload} />
      <section className="list-panel" aria-busy={loading}>
        <div className="list-caption">
          <strong>{processed ? "Ваши решения" : "Доступные заявки"}</strong>
          {data && <span className="muted">{data.total}</span>}
        </div>
        {loading ? (
          <Loading>Загружаем согласование…</Loading>
        ) : data && !data.items.length ? (
          <div className="empty">
            <h2>
              {processed
                ? "Решений пока нет"
                : "Нет заявок, ожидающих вашего решения"}
            </h2>
            <p className="muted">
              {processed
                ? "Здесь появятся заявки, которые вы согласовали или отклонили."
                : "Проверьте вкладку обработанных или дождитесь назначения текущего этапа."}
            </p>
          </div>
        ) : (
          data && (
            <RequestTable
              items={data.items}
              approvals
              processed={processed}
              approvalsReturnTo={returnTo}
            />
          )
        )}
        {data && data.total > data.page_size && (
          <div className="pagination">
            {data.page > 1 ? (
              <Link className="secondary" href={href(data.view, data.page - 1)}>
                Назад
              </Link>
            ) : (
              <span className="secondary is-disabled">Назад</span>
            )}
            <span>
              Страница {data.page} из {Math.ceil(data.total / data.page_size)}
            </span>
            {data.page * data.page_size < data.total ? (
              <Link className="secondary" href={href(data.view, data.page + 1)}>
                Далее
              </Link>
            ) : (
              <span className="secondary is-disabled">Далее</span>
            )}
          </div>
        )}
      </section>
    </>
  );
}
export function ApprovalList() {
  const { user } = useAuth();
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ПРИНЯТИЕ РЕШЕНИЙ</p>
          <h1>Согласование</h1>
          <p className="muted">Текущие этапы и история ваших решений.</p>
        </div>
      </div>
      {user?.roles.includes("APPROVER") ? (
        <Queue />
      ) : (
        <ErrorAlert message="Этот раздел доступен только согласующим" />
      )}
    </>
  );
}
