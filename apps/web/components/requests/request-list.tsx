"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback } from "react";
import { requestsApi } from "../../services/requests";
import { useResource } from "../../hooks/use-resource";
import { useAuth } from "../../providers/auth-provider";
import { ErrorAlert, Loading } from "../ui/feedback";
import { RequestFilters } from "./request-filters";
import { RequestTable } from "./request-table";
import type { RequestFilters as Filters } from "../../types";
export function RequestList() {
  const { user } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const query = params.toString();
  const load = useCallback(() => requestsApi.list(query), [query]);
  const { data, loading, error, reload } = useResource(load);
  const filters = {
    status: params.get("status") || "",
    from: params.get("from") || "",
    to: params.get("to") || "",
  };
  function apply(value: Filters) {
    const next = new URLSearchParams();
    for (const [key, field] of Object.entries(value))
      if (field) next.set(key, field);
    const search = next.toString();
    router.push(`/requests${search ? "?" + search : ""}`);
  }
  function pageHref(page: number) {
    const next = new URLSearchParams(query);
    next.set("page", String(page));
    return `/requests?${next}`;
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ВАШИ ПОЕЗДКИ</p>
          <h1>Мои заявки</h1>
          <p className="muted">
            Планируйте поездки и отслеживайте согласование.
          </p>
        </div>
        {user?.roles.includes("EMPLOYEE") && (
          <Link className="primary" href="/requests/new">
            + Новая заявка
          </Link>
        )}
      </div>
      <RequestFilters key={query} value={filters} onApply={apply} />
      <ErrorAlert message={error} onRetry={reload} />
      <section className="list-panel" aria-busy={loading}>
        <div className="list-caption">
          <strong>Все заявки</strong>
          {data && <span className="muted">{data.total}</span>}
        </div>
        {loading ? (
          <Loading>Загружаем заявки…</Loading>
        ) : data && !data.items.length ? (
          <div className="empty">
            <h2>Заявок пока нет</h2>
            <p className="muted">
              Создайте первую заявку или измените условия поиска.
            </p>
          </div>
        ) : (
          data && <RequestTable items={data.items} />
        )}
        {data && data.total > data.page_size && (
          <div className="pagination">
            {data.page > 1 ? (
              <Link className="secondary" href={pageHref(data.page - 1)}>
                Назад
              </Link>
            ) : (
              <span className="secondary is-disabled" aria-disabled="true">
                Назад
              </span>
            )}
            <span>
              Страница {data.page} из {Math.ceil(data.total / data.page_size)}
            </span>
            {data.page * data.page_size < data.total ? (
              <Link className="secondary" href={pageHref(data.page + 1)}>
                Далее
              </Link>
            ) : (
              <span className="secondary is-disabled" aria-disabled="true">
                Далее
              </span>
            )}
          </div>
        )}
      </section>
    </>
  );
}
