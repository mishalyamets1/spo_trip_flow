"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useAuth } from "../../providers/auth-provider";
import { useResource } from "../../hooks/use-resource";
import { useApiAction } from "../../hooks/use-api-action";
import { requestsApi } from "../../services/requests";
import { approvalsApi } from "../../services/approvals";
import { period } from "../../lib/format";
import { Badge } from "../ui/badge";
import { ErrorAlert, Loading, Notice } from "../ui/feedback";
import { TripSummary } from "./trip-summary";
import { ExpenseSummary } from "./expense-summary";
import { RequestHistory } from "./request-history";
import { DraftActions } from "./draft-actions";
import { ApprovalSteps } from "../approvals/approval-steps";
import { ApprovalDecision } from "../approvals/approval-decision";
export function RequestDetail({
  id,
  fromApprovals = false,
}: {
  id: string;
  fromApprovals?: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const load = useCallback(() => requestsApi.get(id), [id]);
  const { data: request, loading, error, reload, setData } = useResource(load);
  const action = useApiAction();
  const [notice, setNotice] = useState("");
  const currentStep = request?.steps.find(
    (step) =>
      step.actionable && step.approver_employee_id === user?.employee_id,
  );
  const ownDraft =
    request?.status === "DRAFT" &&
    request.employee_id === user?.employee_id &&
    user?.roles.includes("EMPLOYEE");
  async function submit() {
    if (!request) return;
    setNotice("");
    await action.run(async () => {
      setData(await requestsApi.submit(id, request.version));
      setNotice("Заявка отправлена на согласование");
    });
  }
  async function remove() {
    if (
      !request ||
      !window.confirm("Удалить черновик? Это действие нельзя отменить.")
    )
      return;
    setNotice("");
    await action.run(async () => {
      await requestsApi.remove(id, request.version);
      router.replace("/requests");
    });
  }
  async function decide(approved: boolean, comment: string) {
    if (!currentStep || !request) return;
    setNotice("");
    await action.run(async () => {
      setData(
        await approvalsApi.decide(
          currentStep.id,
          request.version,
          approved,
          comment,
        ),
      );
      setNotice(approved ? "Решение сохранено" : "Заявка отклонена");
    });
  }
  return (
    <>
      <Link
        className="text-button back"
        href={fromApprovals ? "/approvals" : "/requests"}
      >
        {fromApprovals ? "← К очереди согласования" : "← К списку заявок"}
      </Link>
      <ErrorAlert
        message={error || action.error}
        onRetry={() => {
          action.clearError();
          setNotice("");
          reload();
        }}
        retryLabel="Обновить карточку"
      />
      {notice && <Notice>{notice}</Notice>}
      {loading ? (
        <Loading>Загружаем карточку…</Loading>
      ) : (
        request && (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">{request.number}</p>
                <h1>Командировка в {request.destination_city}</h1>
                <p className="muted">
                  {request.employee_name} · {period(request)}
                </p>
              </div>
              <Badge status={request.status} />
            </div>
            <div className="detail-grid">
              <div>
                <TripSummary request={request} />
                <ExpenseSummary request={request} />
                <RequestHistory request={request} />
              </div>
              <aside>
                <ApprovalSteps steps={request.steps} />
                {ownDraft && (
                  <DraftActions
                    id={id}
                    busy={action.busy}
                    onSubmit={submit}
                    onDelete={remove}
                  />
                )}
                {currentStep && user?.roles.includes("APPROVER") && (
                  <ApprovalDecision
                    key={currentStep.id}
                    busy={action.busy}
                    onDecide={decide}
                  />
                )}
              </aside>
            </div>
          </>
        )
      )}
    </>
  );
}
