import { transaction } from "../db.js";
import type { User } from "../types/user.js";
import { ensure } from "../errors.js";
import * as approvals from "../repositories/approval.repository.js";
import * as requests from "../repositories/request.repository.js";
import { getRequest } from "./request.service.js";

export async function listApprovals(user: User) {
  ensure(user.roles.includes("APPROVER"), 403, "Нет роли согласующего");
  return { items: await approvals.listPendingForApprover(user.employee_id) };
}

export async function decide(
  user: User,
  approvalId: string,
  version: number,
  approved: boolean,
  comment: string,
) {
  ensure(user.roles.includes("APPROVER"), 403, "Нет роли согласующего");
  ensure(
    approved || comment.trim().length > 0,
    400,
    "Укажите причину отклонения",
  );
  const requestId = await transaction(async (client) => {
    const assigned = await approvals.findAssignedStep(
      client,
      approvalId,
      user.employee_id,
    );
    ensure(assigned, 404, "Этап согласования не найден");
    const id = assigned.request_id as string;
    // Lock the request before the step, preserving the original locking order.
    const request = await requests.findForUpdate(client, id);
    ensure(
      request.version === version,
      409,
      "Заявка уже изменена. Обновите карточку",
    );
    ensure(
      ["SUBMITTED", "UNDER_REVIEW"].includes(request.status),
      409,
      "Заявка уже обработана",
    );
    ensure(
      request.employee_id !== user.employee_id,
      403,
      "Нельзя согласовывать собственную заявку",
    );
    const step = await approvals.findStepForUpdate(client, approvalId);
    ensure(step.status === "PENDING", 409, "Решение по этапу уже принято");
    ensure(
      !(await approvals.hasUnapprovedPrevious(client, id, step.step_order)),
      409,
      "Сначала должен завершиться предыдущий этап",
    );
    await approvals.saveDecision(
      client,
      approvalId,
      approved ? "APPROVED" : "REJECTED",
      comment.trim(),
    );
    if (!approved) await approvals.skipPending(client, id);
    const remaining = await approvals.hasPending(client, id);
    const newStatus = !approved
      ? "REJECTED"
      : remaining
        ? "UNDER_REVIEW"
        : "APPROVED";
    await requests.updateDecisionStatus(client, id, newStatus);
    // Decisions without a status transition remain in approval_steps.
    if (request.status !== newStatus) {
      await requests.addHistory(
        client,
        id,
        request.status,
        newStatus,
        user.employee_id,
        comment.trim() ||
          (approved ? "Заявка согласована" : "Заявка отклонена"),
      );
    }
    return id;
  });
  return getRequest(user, requestId);
}
