import { describe, test, beforeAll, afterAll, expect } from "@jest/globals";
import type { Pool } from "pg";
import { registerStage5Checks } from "./stage5.js";
type Call = (
  path: string,
  method?: string,
  body?: unknown,
  cookie?: string,
  origin?: string,
) => Promise<{
  status: number;
  data: any;
  cookie: string;
}>;
type AdminContext = {
  call: Call;
  pool: Pool;
  input: Record<string, unknown>;
  password: string;
};
export function registerAdminChecks(getContext: () => AdminContext) {
  describe("Администрирование", () => {
    let call: Call,
      pool: Pool,
      input: Record<string, unknown>,
      password: string;
    let hash: string,
      rootUser: string,
      root: string,
      admin: string,
      employee: string,
      manager: string,
      finance: string;
    const login = async (email: string) => {
      const result = await call("/auth/login", "POST", { email, password });
      expect(result.status).toBe(200);
      return result.cookie;
    };
    beforeAll(async () => {
      ({ call, pool, input, password } = getContext());
      hash = (
        await pool.query(
          "SELECT password_hash FROM users WHERE email='maxim@example.test'",
        )
      ).rows[0].password_hash;
      rootUser = (
        await pool.query(
          "INSERT INTO users(email,password_hash) VALUES('admin-test@example.test',$1) RETURNING id",
          [hash],
        )
      ).rows[0].id;
      root = (
        await pool.query(
          "INSERT INTO employees(user_id,department_id,employee_number,full_name,position,hire_date) VALUES($1,2,'TEST-ADMIN','Тестовый администратор','Администратор',CURRENT_DATE) RETURNING id",
          [rootUser],
        )
      ).rows[0].id;
      await pool.query(
        "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'",
        [rootUser],
      );
      admin = await login("admin-test@example.test");
      employee = await login("maxim@example.test");
      manager = await login("manager@example.test");
      finance = await login("finance@example.test");
    });
    const profile = (email: string, number: string, roles = ["EMPLOYEE"]) => ({
      full_name: `Учебный сотрудник ${number}`,
      email,
      employee_number: number,
      position: "Специалист",
      department_id: "2",
      phone: "",
      hire_date: "2026-11-01",
      roles,
      is_active: true,
      password,
    });
    let victim: any,
      replacement: any,
      ownDraft: any,
      ownApproved: any,
      foreignDecision: any,
      foreignPending: any,
      route: any,
      victimCookie = "";
    async function fresh(id: string) {
      return (await call(`/admin/employees/${id}`, "GET", undefined, admin))
        .data;
    }
    async function createDraft(cookie: string) {
      const result = await call("/requests", "POST", input, cookie);
      expect(result.status).toBe(201);
      return result.data;
    }
    async function submit(draft: any, cookie: string) {
      const result = await call(
        `/requests/${draft.id}/submit`,
        "POST",
        { version: draft.version },
        cookie,
      );
      expect(result.status).toBe(200);
      return result.data;
    }
    test("ADMIN: закрытые маршруты, метаданные и создание сотрудника", async () => {
      for (const path of [
        "/admin/employees",
        "/admin/requests",
        "/admin/routes",
        "/admin/metadata",
        "/admin/audit",
      ]) {
        expect((await call(path)).status).toBe(401);
        expect((await call(path, "GET", undefined, employee)).status).toBe(403);
      }
      expect(
        (
          await call(
            "/admin/employees",
            "POST",
            profile("forbidden@example.test", "FORBIDDEN"),
            employee,
          )
        ).status,
      ).toBe(403);
      const created = await call(
        "/admin/employees",
        "POST",
        profile("victim@example.test", "DELETE-ME", ["EMPLOYEE", "APPROVER"]),
        admin,
      );
      expect(created.status).toBe(201);
      victim = created.data;
      expect(victim.password_hash).toBe(undefined);
      expect(victim.hire_date).toBe("2026-11-01");
      replacement = (
        await call(
          "/admin/employees",
          "POST",
          profile("replacement@example.test", "REPLACEMENT", [
            "EMPLOYEE",
            "APPROVER",
          ]),
          admin,
        )
      ).data;
      victimCookie = await login("victim@example.test");
      expect(
        (
          await call("/admin/metadata", "GET", undefined, admin)
        ).data.approvers.some((e: any) => e.id === victim.id),
      ).toBe(true);
    });
    test("ADMIN: редактирование, версия, блокировка сессии и откат дубликата", async () => {
      const count = (await pool.query("SELECT count(*) FROM users")).rows[0]
        .count;
      expect(
        (
          await call(
            "/admin/employees",
            "POST",
            profile("victim@example.test", "DUPLICATE"),
            admin,
          )
        ).status,
      ).toBe(409);
      expect(
        (await pool.query("SELECT count(*) FROM users")).rows[0].count,
      ).toBe(count);
      const changed = await call(
        `/admin/employees/${replacement.id}`,
        "PATCH",
        { ...replacement, is_active: false },
        admin,
      );
      expect(changed.status).toBe(200);
      expect(
        (
          await call(
            `/admin/employees/${replacement.id}`,
            "PATCH",
            replacement,
            admin,
          )
        ).status,
      ).toBe(409);
      const blocked = await call(
        `/admin/employees/${victim.id}`,
        "PATCH",
        { ...victim, is_active: false },
        admin,
      );
      expect(blocked.status).toBe(200);
      expect(
        (await call("/auth/me", "GET", undefined, victimCookie)).status,
      ).toBe(401);
      expect(
        (
          await call("/auth/login", "POST", {
            email: "victim@example.test",
            password,
          })
        ).status,
      ).toBe(401);
      victim = (
        await call(
          `/admin/employees/${victim.id}`,
          "PATCH",
          { ...blocked.data, is_active: true },
          admin,
        )
      ).data;
      replacement = (
        await call(
          `/admin/employees/${replacement.id}`,
          "PATCH",
          { ...changed.data, is_active: true },
          admin,
        )
      ).data;
      victimCookie = await login("victim@example.test");
      const preview = await fresh(root);
      expect(
        (
          await call(
            `/admin/employees/${root}`,
            "DELETE",
            {
              version: preview.employee.version,
              reason: "Тест удаления",
              expected_request_count: 0,
            },
            admin,
          )
        ).status,
      ).toBe(409);
      expect(
        (
          await call(
            `/admin/employees/${root}`,
            "PATCH",
            { ...preview.employee, phone: "", is_active: false },
            admin,
          )
        ).status,
      ).toBe(409);
    });
    test("ADMIN: маршруты, повтор участника, активность и снимок отправленной заявки", async () => {
      const body = {
        name: "Учебный маршрут удаления",
        department_id: "2",
        is_active: true,
        version: 0,
        approver_ids: ["2", "3"],
      };
      expect(
        (
          await call(
            "/admin/routes",
            "POST",
            { ...body, approver_ids: ["2", "2"] },
            admin,
          )
        ).status,
      ).toBe(400);
      const saved = await call("/admin/routes", "POST", body, admin);
      expect(saved.status).toBe(201);
      route = saved.data.items.find((r: any) => r.department_id === "2");
      expect((await call("/admin/routes", "POST", body, admin)).status).toBe(
        409,
      );
      ownDraft = await createDraft(victimCookie);
      ownApproved = await submit(await createDraft(victimCookie), victimCookie);
      const before = ownApproved.steps.map((s: any) => s.approver_employee_id);
      const updated = await call(
        `/admin/routes/${route.id}`,
        "PATCH",
        { ...body, version: route.version, approver_ids: [victim.id] },
        admin,
      );
      expect(updated.status).toBe(200);
      route = updated.data.items.find((r: any) => r.id === route.id);
      expect(
        (
          await call(
            `/admin/routes/${route.id}`,
            "PATCH",
            { ...body, version: 1 },
            admin,
          )
        ).status,
      ).toBe(409);
      expect(
        (
          await call(
            `/requests/${ownApproved.id}`,
            "GET",
            undefined,
            victimCookie,
          )
        ).data.steps.map((s: any) => s.approver_employee_id),
      ).toEqual(before);
      const first = await call(
        `/approvals/${ownApproved.steps[0].id}/approve`,
        "POST",
        { version: ownApproved.version, comment: "Подтверждено" },
        manager,
      );
      expect(first.status).toBe(200);
      const last = await call(
        `/approvals/${first.data.steps[1].id}/approve`,
        "POST",
        { version: first.data.version, comment: "Финальное решение" },
        finance,
      );
      expect(last.status).toBe(200);
      ownApproved = last.data;
      const routeMember = await call(
        `/admin/employees/${victim.id}`,
        "PATCH",
        { ...victim, is_active: false },
        admin,
      );
      expect(routeMember.status).toBe(409);
    });
    test("ADMIN: все заявки, замена этапа, запрет самосогласования и сохранение решения", async () => {
      foreignDecision = await submit(await createDraft(employee), employee);
      const path = `/admin/requests/${foreignDecision.id}/reassign`;
      expect(
        (
          await call(
            path,
            "POST",
            {
              version: foreignDecision.version,
              reason: "Замена",
              approver_employee_id: "1",
            },
            admin,
          )
        ).status,
      ).toBe(409);
      expect(
        (
          await call(
            path,
            "POST",
            {
              version: foreignDecision.version,
              reason: "Замена",
              approver_employee_id: "3",
            },
            admin,
          )
        ).status,
      ).toBe(409);
      const reassigned = await call(
        path,
        "POST",
        {
          version: foreignDecision.version,
          reason: "Замена отсутствующего руководителя",
          approver_employee_id: victim.id,
        },
        admin,
      );
      expect(reassigned.status).toBe(200);
      expect(
        (
          await call(
            path,
            "POST",
            {
              version: foreignDecision.version,
              reason: "Повтор",
              approver_employee_id: replacement.id,
            },
            admin,
          )
        ).status,
      ).toBe(409);
      const decided = await call(
        `/approvals/${reassigned.data.steps[0].id}/approve`,
        "POST",
        {
          version: reassigned.data.version,
          comment: "Решение удаляемого сотрудника",
        },
        victimCookie,
      );
      expect(decided.status).toBe(200);
      foreignDecision = decided.data;
      foreignPending = await submit(await createDraft(employee), employee);
      const pending = await call(
        `/admin/requests/${foreignPending.id}/reassign`,
        "POST",
        {
          version: foreignPending.version,
          reason: "Назначение для теста замены",
          approver_employee_id: victim.id,
        },
        admin,
      );
      expect(pending.status).toBe(200);
      foreignPending = pending.data;
      const all = await call(
        "/admin/requests?q=DELETE-ME",
        "GET",
        undefined,
        admin,
      );
      expect(all.status).toBe(200);
      expect(
        (
          await call(
            `/admin/requests?employee_id=${victim.id}&status=APPROVED`,
            "GET",
            undefined,
            admin,
          )
        ).data.items[0].id,
      ).toBe(ownApproved.id);
      expect(
        (await call(`/requests/${ownDraft.id}`, "GET", undefined, employee))
          .status,
      ).toBe(404);
    });
    test("ADMIN: удаление требует свежего подтверждения, причины и допустимой замены", async () => {
      const preview = await fresh(victim.id);
      expect(preview.request_count).toBe(2);
      expect(preview.pending_count).toBe(1);
      expect(preview.route_count).toBe(1);
      const body = {
        version: preview.employee.version,
        reason: "Учебная проверка удаления",
        expected_request_count: preview.request_count,
      };
      expect(
        (
          await call(
            `/admin/employees/${victim.id}`,
            "DELETE",
            { ...body, reason: " " },
            admin,
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await call(
            `/admin/employees/${victim.id}`,
            "DELETE",
            { ...body, expected_request_count: 1 },
            admin,
          )
        ).status,
      ).toBe(409);
      expect(
        (await call(`/admin/employees/${victim.id}`, "DELETE", body, admin))
          .status,
      ).toBe(400);
      expect(
        (
          await call(
            `/admin/employees/${victim.id}`,
            "DELETE",
            { ...body, replacement_employee_id: "1" },
            admin,
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await call(
            `/admin/employees/${victim.id}`,
            "DELETE",
            { ...body, replacement_employee_id: "3" },
            admin,
          )
        ).status,
      ).toBe(409);
      expect((await fresh(victim.id)).request_count).toBe(2);
    });
    test("ADMIN: удаление всех своих заявок, передача назначений и сохранение чужой истории", async () => {
      const preview = await fresh(victim.id);
      const result = await call(
        `/admin/employees/${victim.id}`,
        "DELETE",
        {
          version: preview.employee.version,
          expected_request_count: preview.request_count,
          reason: "Учебная проверка удаления",
          replacement_employee_id: replacement.id,
        },
        admin,
      );
      expect(result.status).toBe(200);
      expect(result.data.deleted_request_count).toBe(2);
      expect(
        (await call("/auth/me", "GET", undefined, victimCookie)).status,
      ).toBe(401);
      expect(
        (await call(`/admin/employees/${victim.id}`, "GET", undefined, admin))
          .status,
      ).toBe(404);
      expect(
        (
          await pool.query("SELECT count(*) FROM users WHERE id=$1", [
            victim.user_id,
          ])
        ).rows[0].count,
      ).toBe("0");
      for (const r of [ownDraft, ownApproved]) {
        for (const [table, column, id] of [
          ["travel_requests", "id", r.id],
          ["trips", "id", r.trip_id],
          ["expense_estimates", "request_id", r.id],
          ["approval_steps", "request_id", r.id],
          ["request_status_history", "request_id", r.id],
        ])
          expect(
            (
              await pool.query(
                `SELECT count(*) FROM ${table} WHERE ${column}=$1`,
                [id],
              )
            ).rows[0].count,
          ).toBe("0");
      }
      const preserved = (
        await call(
          `/admin/requests/${foreignDecision.id}`,
          "GET",
          undefined,
          admin,
        )
      ).data;
      expect(preserved.status).toBe("UNDER_REVIEW");
      expect(preserved.steps[0].approver_employee_id).toBe(null);
      expect(preserved.steps[0].approver_name).toBe(victim.full_name);
      expect(preserved.steps[0].decision_comment).toBe(
        "Решение удаляемого сотрудника",
      );
      expect(
        preserved.history.some(
          (h: any) => h.changed_by_name === victim.full_name,
        ),
      ).toBeTruthy();
      const pending = (
        await call(
          `/admin/requests/${foreignPending.id}`,
          "GET",
          undefined,
          admin,
        )
      ).data;
      expect(pending.steps[0].approver_employee_id).toBe(replacement.id);
      expect(pending.version).toBe(foreignPending.version + 1);
      expect(
        (await call("/admin/routes", "GET", undefined, admin)).data.items.find(
          (r: any) => r.id === route.id,
        ).steps[0].employee_id,
      ).toBe(replacement.id);
    });
    test("ADMIN: принудительная отмена, версия, закрытые этапы и журнал без секретов", async () => {
      const card = (
        await call(
          `/admin/requests/${foreignDecision.id}`,
          "GET",
          undefined,
          admin,
        )
      ).data;
      const result = await call(
        `/admin/requests/${card.id}/cancel`,
        "POST",
        { version: card.version, reason: "Административная проверка" },
        admin,
      );
      expect(result.status).toBe(200);
      expect(result.data.status).toBe("CANCELED");
      expect(result.data.steps[0].status).toBe("APPROVED");
      expect(result.data.steps[1].status).toBe("SKIPPED");
      expect(
        (
          await call(
            `/admin/requests/${card.id}/cancel`,
            "POST",
            { version: card.version, reason: "Повтор" },
            admin,
          )
        ).status,
      ).toBe(409);
      const draft = await createDraft(employee);
      const canceled = await call(
        `/admin/requests/${draft.id}/cancel`,
        "POST",
        { version: draft.version, reason: "Отмена черновика" },
        admin,
      );
      expect(canceled.status).toBe(200);
      expect(canceled.data.submitted_at).toBeTruthy();
      const log = await call("/admin/audit", "GET", undefined, admin);
      expect(log.status).toBe(200);
      expect(
        log.data.items.some((a: any) => a.action === "employee.delete"),
      ).toBeTruthy();
      expect(JSON.stringify(log.data).includes(password)).toBe(false);
      expect(JSON.stringify(log.data).includes(hash)).toBe(false);
    });
    registerStage5Checks(() => ({
      call,
      pool,
      admin,
      employee,
      manager,
      finance,
      root,
      input,
      password,
    }));
    // Run after the nested stage-V suite, before the stage-IV fixtures are prepared.
    afterAll(async () => {
      await pool.query(
        "DELETE FROM travel_requests WHERE id=ANY($1::bigint[])",
        [[foreignDecision.id, foreignPending.id]],
      );
      await pool.query("DELETE FROM trips WHERE id=ANY($1::bigint[])", [
        [foreignDecision.trip_id, foreignPending.trip_id],
      ]);
    });
  });
}
