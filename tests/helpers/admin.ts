import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import type { Pool } from "pg";
type Call = (
  path: string,
  method?: string,
  body?: unknown,
  cookie?: string,
  origin?: string,
) => Promise<{ status: number; data: any; cookie: string }>;
export async function runAdminChecks({
  t,
  call,
  pool,
  input,
  password,
}: {
  t: TestContext;
  call: Call;
  pool: Pool;
  input: Record<string, unknown>;
  password: string;
}) {
  const hash = (
    await pool.query(
      "SELECT password_hash FROM users WHERE email='maxim@example.test'",
    )
  ).rows[0].password_hash;
  const rootUser = (
    await pool.query(
      "INSERT INTO users(email,password_hash) VALUES('admin-test@example.test',$1) RETURNING id",
      [hash],
    )
  ).rows[0].id;
  const root = (
    await pool.query(
      "INSERT INTO employees(user_id,department_id,employee_number,full_name,position,hire_date) VALUES($1,2,'TEST-ADMIN','Тестовый администратор','Администратор',CURRENT_DATE) RETURNING id",
      [rootUser],
    )
  ).rows[0].id;
  await pool.query(
    "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'",
    [rootUser],
  );
  const login = async (email: string) => {
    const result = await call("/auth/login", "POST", { email, password });
    assert.equal(result.status, 200);
    return result.cookie;
  };
  const admin = await login("admin-test@example.test");
  const employee = await login("maxim@example.test");
  const manager = await login("manager@example.test");
  const finance = await login("finance@example.test");
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
    return (await call(`/admin/employees/${id}`, "GET", undefined, admin)).data;
  }
  async function createDraft(cookie: string) {
    const result = await call("/requests", "POST", input, cookie);
    assert.equal(result.status, 201);
    return result.data;
  }
  async function submit(draft: any, cookie: string) {
    const result = await call(
      `/requests/${draft.id}/submit`,
      "POST",
      { version: draft.version },
      cookie,
    );
    assert.equal(result.status, 200);
    return result.data;
  }
  await t.test(
    "ADMIN: закрытые маршруты, метаданные и создание сотрудника",
    async () => {
      for (const path of [
        "/admin/employees",
        "/admin/requests",
        "/admin/routes",
        "/admin/metadata",
        "/admin/audit",
      ]) {
        assert.equal((await call(path)).status, 401);
        assert.equal(
          (await call(path, "GET", undefined, employee)).status,
          403,
        );
      }
      assert.equal(
        (
          await call(
            "/admin/employees",
            "POST",
            profile("forbidden@example.test", "FORBIDDEN"),
            employee,
          )
        ).status,
        403,
      );
      const created = await call(
        "/admin/employees",
        "POST",
        profile("victim@example.test", "DELETE-ME", ["EMPLOYEE", "APPROVER"]),
        admin,
      );
      assert.equal(created.status, 201);
      victim = created.data;
      assert.equal(victim.password_hash, undefined);
      assert.equal(victim.hire_date, "2026-11-01");
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
      assert.equal(
        (
          await call("/admin/metadata", "GET", undefined, admin)
        ).data.approvers.some((e: any) => e.id === victim.id),
        true,
      );
    },
  );
  await t.test(
    "ADMIN: редактирование, версия, блокировка сессии и откат дубликата",
    async () => {
      const count = (await pool.query("SELECT count(*) FROM users")).rows[0]
        .count;
      assert.equal(
        (
          await call(
            "/admin/employees",
            "POST",
            profile("victim@example.test", "DUPLICATE"),
            admin,
          )
        ).status,
        409,
      );
      assert.equal(
        (await pool.query("SELECT count(*) FROM users")).rows[0].count,
        count,
      );
      const changed = await call(
        `/admin/employees/${replacement.id}`,
        "PATCH",
        { ...replacement, is_active: false },
        admin,
      );
      assert.equal(changed.status, 200);
      assert.equal(
        (
          await call(
            `/admin/employees/${replacement.id}`,
            "PATCH",
            replacement,
            admin,
          )
        ).status,
        409,
      );
      const blocked = await call(
        `/admin/employees/${victim.id}`,
        "PATCH",
        { ...victim, is_active: false },
        admin,
      );
      assert.equal(blocked.status, 200);
      assert.equal(
        (await call("/auth/me", "GET", undefined, victimCookie)).status,
        401,
      );
      assert.equal(
        (
          await call("/auth/login", "POST", {
            email: "victim@example.test",
            password,
          })
        ).status,
        401,
      );
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
      assert.equal(
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
        409,
      );
      assert.equal(
        (
          await call(
            `/admin/employees/${root}`,
            "PATCH",
            { ...preview.employee, phone: "", is_active: false },
            admin,
          )
        ).status,
        409,
      );
    },
  );
  await t.test(
    "ADMIN: маршруты, повтор участника, активность и снимок отправленной заявки",
    async () => {
      const body = {
        name: "Учебный маршрут удаления",
        department_id: "2",
        is_active: true,
        version: 0,
        approver_ids: ["2", "3"],
      };
      assert.equal(
        (
          await call(
            "/admin/routes",
            "POST",
            { ...body, approver_ids: ["2", "2"] },
            admin,
          )
        ).status,
        400,
      );
      const saved = await call("/admin/routes", "POST", body, admin);
      assert.equal(saved.status, 201);
      route = saved.data.items.find((r: any) => r.department_id === "2");
      assert.equal(
        (await call("/admin/routes", "POST", body, admin)).status,
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
      assert.equal(updated.status, 200);
      route = updated.data.items.find((r: any) => r.id === route.id);
      assert.equal(
        (
          await call(
            `/admin/routes/${route.id}`,
            "PATCH",
            { ...body, version: 1 },
            admin,
          )
        ).status,
        409,
      );
      assert.deepEqual(
        (
          await call(
            `/requests/${ownApproved.id}`,
            "GET",
            undefined,
            victimCookie,
          )
        ).data.steps.map((s: any) => s.approver_employee_id),
        before,
      );
      const first = await call(
        `/approvals/${ownApproved.steps[0].id}/approve`,
        "POST",
        { version: ownApproved.version, comment: "Подтверждено" },
        manager,
      );
      assert.equal(first.status, 200);
      const last = await call(
        `/approvals/${first.data.steps[1].id}/approve`,
        "POST",
        { version: first.data.version, comment: "Финальное решение" },
        finance,
      );
      assert.equal(last.status, 200);
      ownApproved = last.data;
      const routeMember = await call(
        `/admin/employees/${victim.id}`,
        "PATCH",
        { ...victim, is_active: false },
        admin,
      );
      assert.equal(routeMember.status, 409);
    },
  );
  await t.test(
    "ADMIN: все заявки, замена этапа, запрет самосогласования и сохранение решения",
    async () => {
      foreignDecision = await submit(await createDraft(employee), employee);
      const path = `/admin/requests/${foreignDecision.id}/reassign`;
      assert.equal(
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
        409,
      );
      assert.equal(
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
        409,
      );
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
      assert.equal(reassigned.status, 200);
      assert.equal(
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
        409,
      );
      const decided = await call(
        `/approvals/${reassigned.data.steps[0].id}/approve`,
        "POST",
        {
          version: reassigned.data.version,
          comment: "Решение удаляемого сотрудника",
        },
        victimCookie,
      );
      assert.equal(decided.status, 200);
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
      assert.equal(pending.status, 200);
      foreignPending = pending.data;
      const all = await call(
        "/admin/requests?q=DELETE-ME",
        "GET",
        undefined,
        admin,
      );
      assert.equal(all.status, 200);
      assert.equal(
        (
          await call(
            `/admin/requests?employee_id=${victim.id}&status=APPROVED`,
            "GET",
            undefined,
            admin,
          )
        ).data.items[0].id,
        ownApproved.id,
      );
      assert.equal(
        (await call(`/requests/${ownDraft.id}`, "GET", undefined, employee))
          .status,
        404,
      );
    },
  );
  await t.test(
    "ADMIN: удаление требует свежего подтверждения, причины и допустимой замены",
    async () => {
      const preview = await fresh(victim.id);
      assert.equal(preview.request_count, 2);
      assert.equal(preview.pending_count, 1);
      assert.equal(preview.route_count, 1);
      const body = {
        version: preview.employee.version,
        reason: "Учебная проверка удаления",
        expected_request_count: preview.request_count,
      };
      assert.equal(
        (
          await call(
            `/admin/employees/${victim.id}`,
            "DELETE",
            { ...body, reason: " " },
            admin,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await call(
            `/admin/employees/${victim.id}`,
            "DELETE",
            { ...body, expected_request_count: 1 },
            admin,
          )
        ).status,
        409,
      );
      assert.equal(
        (await call(`/admin/employees/${victim.id}`, "DELETE", body, admin))
          .status,
        400,
      );
      assert.equal(
        (
          await call(
            `/admin/employees/${victim.id}`,
            "DELETE",
            { ...body, replacement_employee_id: "1" },
            admin,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await call(
            `/admin/employees/${victim.id}`,
            "DELETE",
            { ...body, replacement_employee_id: "3" },
            admin,
          )
        ).status,
        409,
      );
      assert.equal((await fresh(victim.id)).request_count, 2);
    },
  );
  await t.test(
    "ADMIN: удаление всех своих заявок, передача назначений и сохранение чужой истории",
    async () => {
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
      assert.equal(result.status, 200);
      assert.equal(result.data.deleted_request_count, 2);
      assert.equal(
        (await call("/auth/me", "GET", undefined, victimCookie)).status,
        401,
      );
      assert.equal(
        (await call(`/admin/employees/${victim.id}`, "GET", undefined, admin))
          .status,
        404,
      );
      assert.equal(
        (
          await pool.query("SELECT count(*) FROM users WHERE id=$1", [
            victim.user_id,
          ])
        ).rows[0].count,
        "0",
      );
      for (const r of [ownDraft, ownApproved]) {
        for (const [table, column, id] of [
          ["travel_requests", "id", r.id],
          ["trips", "id", r.trip_id],
          ["expense_estimates", "request_id", r.id],
          ["approval_steps", "request_id", r.id],
          ["request_status_history", "request_id", r.id],
        ])
          assert.equal(
            (
              await pool.query(
                `SELECT count(*) FROM ${table} WHERE ${column}=$1`,
                [id],
              )
            ).rows[0].count,
            "0",
          );
      }
      const preserved = (
        await call(
          `/admin/requests/${foreignDecision.id}`,
          "GET",
          undefined,
          admin,
        )
      ).data;
      assert.equal(preserved.status, "UNDER_REVIEW");
      assert.equal(preserved.steps[0].approver_employee_id, null);
      assert.equal(preserved.steps[0].approver_name, victim.full_name);
      assert.equal(
        preserved.steps[0].decision_comment,
        "Решение удаляемого сотрудника",
      );
      assert.ok(
        preserved.history.some(
          (h: any) => h.changed_by_name === victim.full_name,
        ),
      );
      const pending = (
        await call(
          `/admin/requests/${foreignPending.id}`,
          "GET",
          undefined,
          admin,
        )
      ).data;
      assert.equal(pending.steps[0].approver_employee_id, replacement.id);
      assert.equal(pending.version, foreignPending.version + 1);
      assert.equal(
        (await call("/admin/routes", "GET", undefined, admin)).data.items.find(
          (r: any) => r.id === route.id,
        ).steps[0].employee_id,
        replacement.id,
      );
    },
  );
  await t.test(
    "ADMIN: принудительная отмена, версия, закрытые этапы и журнал без секретов",
    async () => {
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
      assert.equal(result.status, 200);
      assert.equal(result.data.status, "CANCELED");
      assert.equal(result.data.steps[0].status, "APPROVED");
      assert.equal(result.data.steps[1].status, "SKIPPED");
      assert.equal(
        (
          await call(
            `/admin/requests/${card.id}/cancel`,
            "POST",
            { version: card.version, reason: "Повтор" },
            admin,
          )
        ).status,
        409,
      );
      const draft = await createDraft(employee);
      const canceled = await call(
        `/admin/requests/${draft.id}/cancel`,
        "POST",
        { version: draft.version, reason: "Отмена черновика" },
        admin,
      );
      assert.equal(canceled.status, 200);
      assert.ok(canceled.data.submitted_at);
      const log = await call("/admin/audit", "GET", undefined, admin);
      assert.equal(log.status, 200);
      assert.ok(
        log.data.items.some((a: any) => a.action === "employee.delete"),
      );
      assert.equal(JSON.stringify(log.data).includes(password), false);
      assert.equal(JSON.stringify(log.data).includes(hash), false);
    },
  );
  // Keep the following stage-IV test expectations independent of these fixtures.
  await pool.query("DELETE FROM travel_requests WHERE id=ANY($1::bigint[])", [
    [foreignDecision.id, foreignPending.id],
  ]);
  await pool.query("DELETE FROM trips WHERE id=ANY($1::bigint[])", [
    [foreignDecision.trip_id, foreignPending.trip_id],
  ]);
}
