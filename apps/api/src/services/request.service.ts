import type { PoolClient } from "pg";
import { transaction } from "../db.js";
import type { User } from "../types/user.js";
import { ensure, HttpError } from "../errors.js";
import type { RequestInput } from "../types/request.js";
import { totalAmount } from "./estimate.service.js";
import * as requests from "../repositories/request.repository.js";
import * as approvals from "../repositories/approval.repository.js";

export async function listRequests(
  user: User,
  filter: { status?: string; from?: string; to?: string; page: number },
) {
  return requests.listOwn(user.employee_id, filter);
}

export async function getRequest(user: User, id: string) {
  const request = await requests.findVisible(id, user.employee_id);
  ensure(request, 404, "Заявка не найдена");
  const [expenses, steps, history] = await Promise.all([
    requests.listExpenses(id),
    approvals.listSteps(id),
    requests.listHistory(id),
  ]);
  return { ...request, expenses, steps, history };
}

async function lockOwn(
  client: PoolClient,
  user: User,
  id: string,
  version: number,
) {
  ensure(
    user.roles.includes("EMPLOYEE"),
    403,
    "Изменение заявок доступно сотрудникам",
  );
  const request = await requests.findOwnForUpdate(client, id, user.employee_id);
  ensure(request, 404, "Заявка не найдена");
  ensure(
    request.version === version,
    409,
    "Заявка уже изменена. Обновите карточку",
  );
  ensure(request.status === "DRAFT", 409, "Изменять можно только черновик");
  return request;
}

export async function saveRequest(
  user: User,
  input: RequestInput,
  id?: string,
) {
  ensure(
    user.roles.includes("EMPLOYEE"),
    403,
    "Создание заявок доступно сотрудникам",
  );
  let total: string;
  try {
    total = totalAmount(input.expenses);
  } catch {
    throw new HttpError(400, "Итоговая сумма слишком велика");
  }
  const savedId = await transaction(async (client) => {
    if (id) {
      ensure(input.version, 400, "Укажите версию заявки");
      const request = await lockOwn(client, user, id, input.version);
      await requests.updateTrip(client, request.trip_id, input);
      await requests.updateDraft(client, id, input, total);
      await requests.replaceExpenses(client, id, input.expenses);
      return id;
    }
    const tripId = await requests.createTrip(client, input);
    // Identity allocation is atomic; gaps after rollback are expected.
    const requestId = await requests.allocateId(client);
    const number = `TR-${new Date().getUTCFullYear()}-${requestId.padStart(6, "0")}`;
    await requests.insertDraft(
      client,
      requestId,
      number,
      user.employee_id,
      tripId,
      input,
      total,
    );
    await requests.replaceExpenses(client, requestId, input.expenses);
    await requests.addHistory(
      client,
      requestId,
      null,
      "DRAFT",
      user.employee_id,
      "Заявка создана",
    );
    return requestId;
  });
  return getRequest(user, savedId);
}

export async function deleteRequest(user: User, id: string, version: number) {
  await transaction(async (client) => {
    const request = await lockOwn(client, user, id, version);
    await requests.deleteById(client, id);
    await requests.deleteTrip(client, request.trip_id);
  });
}

export async function submitRequest(user: User, id: string, version: number) {
  await transaction(async (client) => {
    await lockOwn(client, user, id, version);
    ensure(
      (await requests.countExpenses(client, id)) > 0,
      400,
      "Добавьте хотя бы одну позицию сметы",
    );
    const route = await approvals.findActiveRoute(client, user.employee_id);
    ensure(route, 409, "Для подразделения не настроен маршрут согласования");
    const steps = await approvals.listRouteSteps(client, route.id);
    ensure(steps.length, 409, "Маршрут согласования пуст");
    ensure(
      steps.every(
        (s) =>
          s.is_active &&
          s.can_approve &&
          s.approver_employee_id !== user.employee_id,
      ),
      409,
      "Маршрут содержит недоступного согласующего или автора заявки",
    );
    for (const step of steps) {
      await approvals.insertStep(
        client,
        id,
        step.step_order,
        step.approver_employee_id,
      );
    }
    await requests.markSubmitted(client, id, route.id);
    await requests.addHistory(
      client,
      id,
      "DRAFT",
      "SUBMITTED",
      user.employee_id,
      "Заявка отправлена на согласование",
    );
  });
  return getRequest(user, id);
}
