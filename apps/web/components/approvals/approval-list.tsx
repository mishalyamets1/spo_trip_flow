"use client";
import { approvalsApi } from "../../services/approvals";
import { useResource } from "../../hooks/use-resource";
import { useAuth } from "../../providers/auth-provider";
import { ErrorAlert, Loading } from "../ui/feedback";
import { RequestTable } from "../requests/request-table";
function Queue() {
  const { data, loading, error, reload } = useResource(approvalsApi.list);
  return (
    <>
      <ErrorAlert message={error} onRetry={reload} />
      <section className="list-panel" aria-busy={loading}>
        <div className="list-caption">
          <strong>Доступные заявки</strong>
          {data && <span className="muted">{data.items.length}</span>}
        </div>
        {loading ? (
          <Loading>Загружаем очередь…</Loading>
        ) : data && !data.items.length ? (
          <div className="empty">
            <h2>Сейчас всё согласовано</h2>
            <p className="muted">
              Новые заявки появятся здесь, когда наступит ваш этап.
            </p>
          </div>
        ) : (
          data && <RequestTable items={data.items} approvals />
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
          <h1>На согласовании</h1>
          <p className="muted">
            Заявки, по которым сейчас требуется ваше решение.
          </p>
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
