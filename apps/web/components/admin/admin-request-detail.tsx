"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, type FormEvent } from "react";
import { adminApi } from "../../services/admin";
import { useResource } from "../../hooks/use-resource";
import { useApiAction } from "../../hooks/use-api-action";
import { safeReturnPath } from "../../lib/navigation";
import { ErrorAlert, Loading } from "../ui/feedback";
import { Badge } from "../ui/badge";
import { TripSummary } from "../requests/trip-summary";
import { ExpenseSummary } from "../requests/expense-summary";
import { RequestHistory } from "../requests/request-history";
import { CancellationSummary } from "../requests/cancel-request";
import { ApprovalSteps } from "../approvals/approval-steps";
export function AdminRequestDetail({ id }: { id: string }) {
  const params = useSearchParams();
  const candidate = safeReturnPath(params.get("returnTo"));
  const back =
    candidate.split("?")[0] === "/admin/requests"
      ? candidate
      : "/admin/requests";
  const load = useCallback(() => adminApi.request(id), [id]);
  const { data, loading, error, reload, setData } = useResource(load);
  const metadata = useResource(adminApi.metadata);
  const action = useApiAction();
  async function cancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason"));
    if (!data) return;
    await action.run(async () =>
      setData(await adminApi.cancel(id, data.version, reason)),
    );
  }
  async function reassign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!data) return;
    await action.run(async () =>
      setData(
        await adminApi.reassign(
          id,
          data.version,
          String(form.get("approver")),
          String(form.get("reason")),
        ),
      ),
    );
  }
  const active = data && ["SUBMITTED", "UNDER_REVIEW"].includes(data.status);
  return (
    <>
      <Link className="text-button back" href={back}>
        ← Ко всем заявкам
      </Link>
      <ErrorAlert
        message={error || action.error || metadata.error}
        onRetry={() => {
          action.clearError();
          reload();
          metadata.reload();
        }}
        retryLabel="Обновить карточку"
      />
      {loading ? (
        <Loading>Загружаем карточку…</Loading>
      ) : (
        data && (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">{data.number}</p>
                <h1>Командировка в {data.destination_city}</h1>
                <p className="muted">{data.employee_name}</p>
              </div>
              <Badge status={data.status} />
            </div>
            <div className="detail-grid">
              <div>
                <CancellationSummary request={data} />
                <TripSummary request={data} />
                <ExpenseSummary request={data} />
                <RequestHistory request={data} />
              </div>
              <aside>
                <ApprovalSteps steps={data.steps} />
                {active && (
                  <section className="section-panel">
                    <h2>Замена согласующего</h2>
                    <p className="muted small">
                      Будет заменён первый ожидающий этап. Принятые решения
                      сохраняются.
                    </p>
                    <form
                      key={`reassign-${data.version}`}
                      className="actions"
                      onSubmit={reassign}
                    >
                      <fieldset disabled={action.busy}>
                        <label>
                          Новый согласующий
                          <select name="approver" required defaultValue="">
                            <option value="" disabled>
                              Выберите сотрудника
                            </option>
                            {metadata.data?.approvers
                              .filter(
                                (e) =>
                                  e.id !== data.employee_id &&
                                  !data.steps.some(
                                    (s) => s.approver_employee_id === e.id,
                                  ),
                              )
                              .map((e) => (
                                <option key={e.id} value={e.id}>
                                  {e.full_name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          Причина замены
                          <textarea
                            name="reason"
                            required
                            maxLength={2000}
                            rows={2}
                          />
                        </label>
                        <button className="secondary">
                          {action.busy ? "Сохраняем…" : "Заменить согласующего"}
                        </button>
                      </fieldset>
                    </form>
                  </section>
                )}
                {(active || data.status === "DRAFT") && (
                  <section className="section-panel admin-danger">
                    <h2>Административная отмена</h2>
                    <p className="muted small">
                      Заявка завершится отменой, ожидающие этапы закроются. Уже
                      принятые решения останутся в истории.
                    </p>
                    <form className="actions" onSubmit={cancel}>
                      <fieldset disabled={action.busy}>
                        <label>
                          Причина отмены
                          <textarea
                            name="reason"
                            required
                            maxLength={2000}
                            rows={3}
                          />
                        </label>
                        <button className="danger">
                          {action.busy ? "Отменяем…" : "Отменить заявку"}
                        </button>
                      </fieldset>
                    </form>
                  </section>
                )}
              </aside>
            </div>
          </>
        )
      )}
    </>
  );
}
