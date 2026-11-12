import { transaction, pool } from "../db.js";
import { ensure } from "../errors.js";
import { hashPassword } from "../utils/crypto.js";
import type { User } from "../types/user.js";
import * as repo from "../repositories/admin.repository.js";
import * as requests from "../repositories/request.repository.js";
import * as approvals from "../repositories/approval.repository.js";
import type { PoolClient } from "pg";
import type { z } from "zod";
import type {
  createEmployeeSchema,
  updateEmployeeSchema,
  deleteEmployeeSchema,
  routeSchema,
} from "../validators/admin.validation.js";

async function adminTransaction<T>(
  user: User,
  work: (client: PoolClient) => Promise<T>,
) {
  return transaction(async (client) => {
    await repo.lockAdministration(client);
    ensure(
      (
        await client.query(
          `SELECT 1 FROM users u WHERE u.id=$1 AND u.is_active AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code='ADMIN')`,
          [user.id],
        )
      ).rowCount,
      403,
      "Нет прав администратора",
    );
    return work(client);
  });
}
export async function createEmployee(
  user: User,
  input: z.infer<typeof createEmployeeSchema>,
) {
  const hash = await hashPassword(input.password);
  const id = await adminTransaction(user, async (client) => {
    const id = await repo.writeEmployee(client, input, undefined, hash);
    await repo.audit(
      client,
      user,
      "employee.create",
      "employee",
      id,
      "Создание сотрудника",
      { roles: input.roles },
    );
    return id;
  });
  return repo.findEmployee(id);
}
export async function updateEmployee(
  user: User,
  id: string,
  input: z.infer<typeof updateEmployeeSchema>,
) {
  await adminTransaction(user, async (client) => {
    const locked = await repo.lockEmployee(client, id);
    ensure(locked, 404, "Сотрудник не найден");
    ensure(
      locked.version === input.version,
      409,
      "Сотрудник уже изменён. Обновите данные",
    );
    const old = await repo.findEmployee(id, client);
    if (
      old.roles.includes("ADMIN") &&
      (!input.roles.includes("ADMIN") || !input.is_active)
    ) {
      ensure(
        old.user_id !== user.id,
        409,
        "Нельзя отключить собственную учётную запись или снять с себя роль администратора",
      );
      ensure(
        (await repo.activeAdminCount(client, old.user_id)) > 0,
        409,
        "Нельзя отключить последнего активного администратора",
      );
    }
    if (!input.is_active || !input.roles.includes("APPROVER")) {
      const deps = await repo.dependencies(client, id);
      ensure(
        !deps.pending_count && !deps.route_count,
        409,
        "Сначала передайте ожидающие этапы и замените сотрудника в маршрутах согласования",
      );
    }
    await repo.writeEmployee(client, input, id);
    await repo.audit(
      client,
      user,
      "employee.update",
      "employee",
      id,
      "Изменение сотрудника",
      { roles: input.roles, is_active: input.is_active },
    );
  });
  return repo.findEmployee(id);
}
export async function employeePreview(id: string) {
  const employee = await repo.findEmployee(id);
  ensure(employee, 404, "Сотрудник не найден");
  const deps = await repo.dependencies(pool, id);
  return { employee, ...deps };
}
export async function deleteEmployee(
  user: User,
  id: string,
  input: z.infer<typeof deleteEmployeeSchema>,
) {
  return adminTransaction(user, async (client) => {
    const old = await repo.lockEmployee(client, id);
    ensure(old, 404, "Сотрудник не найден");
    ensure(
      old.user_id !== user.id,
      409,
      "Нельзя удалить собственную учётную запись администратора",
    );
    ensure(
      old.version === input.version,
      409,
      "Сотрудник уже изменён. Обновите данные",
    );
    ensure(
      (await repo.activeAdminCount(client, old.user_id)) > 0,
      409,
      "Нельзя удалить последнего активного администратора",
    );
    await repo.lockAffectedRequests(client, id);
    const deps = await repo.dependencies(client, id);
    ensure(
      deps.request_count === input.expected_request_count,
      409,
      "Количество заявок изменилось. Повторно откройте подтверждение удаления",
    );
    if (deps.pending_count || deps.route_count) {
      const replacement = input.replacement_employee_id;
      ensure(
        replacement && replacement !== id,
        400,
        "Выберите другого согласующего для замены",
      );
      const person = await repo.validApprover(client, replacement);
      ensure(person, 400, "Замена должна быть активным согласующим");
      ensure(
        !(await repo.replacementConflicts(client, id, replacement)),
        409,
        "Замена уже участвует в одном из маршрутов или является автором заявки. Выберите другого согласующего",
      );
      await repo.replaceAssignments(client, id, replacement, person.full_name);
    }
    await repo.audit(
      client,
      user,
      "employee.delete",
      "employee",
      id,
      input.reason,
      {
        ...deps,
        full_name: old.full_name,
        replacement_employee_id: input.replacement_employee_id,
      },
    );
    await repo.eraseEmployee(client, id, old.user_id);
    return { deleted_request_count: deps.request_count };
  });
}
export async function getRequest(id: string) {
  const request = await repo.findRequest(pool, id);
  ensure(request, 404, "Заявка не найдена");
  const [expenses, steps, history] = await Promise.all([
    requests.listExpenses(id),
    approvals.listSteps(id),
    requests.listHistory(id),
  ]);
  return { ...request, expenses, steps, history, can_cancel: false };
}
export async function cancelRequest(
  user: User,
  id: string,
  version: number,
  reason: string,
) {
  await adminTransaction(user, async (client) => {
    const request = await requests.findForUpdate(client, id);
    ensure(request, 404, "Заявка не найдена");
    ensure(
      request.version === version,
      409,
      "Заявка уже изменена. Обновите карточку",
    );
    ensure(
      ["DRAFT", "SUBMITTED", "UNDER_REVIEW"].includes(request.status),
      409,
      "Завершённую заявку отменить нельзя",
    );
    // markCanceled updates the status and required timestamps in one statement.
    await requests.markCanceled(client, id, reason);
    await approvals.skipPending(client, id);
    await requests.addHistory(
      client,
      id,
      request.status,
      "CANCELED",
      user.employee_id,
      `Администратор: ${reason}`,
    );
    await repo.audit(client, user, "request.cancel", "request", id, reason);
  });
  return getRequest(id);
}
export async function reassign(
  user: User,
  id: string,
  version: number,
  approverId: string,
  reason: string,
) {
  await adminTransaction(user, async (client) => {
    const request = await requests.findForUpdate(client, id);
    ensure(request, 404, "Заявка не найдена");
    ensure(
      request.version === version,
      409,
      "Заявка уже изменена. Обновите карточку",
    );
    ensure(
      ["SUBMITTED", "UNDER_REVIEW"].includes(request.status),
      409,
      "Переназначение доступно только незавершённым заявкам",
    );
    ensure(
      request.employee_id !== approverId,
      409,
      "Автор не может согласовывать свою заявку",
    );
    const person = await repo.validApprover(client, approverId);
    ensure(person, 400, "Выберите активного согласующего");
    const step = (
      await client.query(
        "SELECT * FROM approval_steps WHERE request_id=$1 AND status='PENDING' ORDER BY step_order LIMIT 1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    ensure(step, 409, "Нет ожидающего этапа");
    ensure(
      !(
        await client.query(
          "SELECT 1 FROM approval_steps WHERE request_id=$1 AND approver_employee_id=$2",
          [id, approverId],
        )
      ).rowCount,
      409,
      "Этот сотрудник уже участвует в согласовании заявки",
    );
    await client.query(
      "UPDATE approval_steps SET approver_employee_id=$2,approver_name_snapshot=$3 WHERE id=$1",
      [step.id, approverId, person.full_name],
    );
    await client.query(
      "UPDATE travel_requests SET version=version+1,updated_at=now() WHERE id=$1",
      [id],
    );
    await repo.audit(client, user, "request.reassign", "request", id, reason, {
      step_id: step.id,
      from_employee_id: step.approver_employee_id,
      to_employee_id: approverId,
    });
  });
  return getRequest(id);
}
export async function saveRoute(
  user: User,
  input: z.infer<typeof routeSchema>,
  id?: string,
) {
  await adminTransaction(user, async (client) => {
    if (id) {
      const old = (
        await client.query(
          "SELECT * FROM approval_routes WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      ensure(old, 404, "Маршрут не найден");
      ensure(
        old.version === input.version,
        409,
        "Маршрут уже изменён. Обновите список",
      );
      ensure(
        old.department_id === input.department_id,
        400,
        "Подразделение существующего маршрута нельзя менять",
      );
    } else
      ensure(input.version === 0, 400, "Новый маршрут должен иметь version=0");
    for (const employeeId of input.approver_ids)
      ensure(
        await repo.validApprover(client, employeeId),
        400,
        "Все участники маршрута должны быть активными согласующими",
      );
    const saved = await repo.saveRoute(client, input, id);
    await repo.audit(
      client,
      user,
      "route.save",
      "route",
      saved,
      "Настройка маршрута",
      {
        department_id: input.department_id,
        approver_ids: input.approver_ids,
        is_active: input.is_active,
      },
    );
  });
  return repo.routes();
}
