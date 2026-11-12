import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { TestContext } from "node:test";
import type { Pool } from "pg";

type Call = (
  path: string,
  method?: string,
  body?: unknown,
  cookie?: string,
  origin?: string,
) => Promise<{ status: number; data: any; cookie: string }>;
export async function runStage4Checks({
  t,
  call,
  pool,
  base,
  input,
  password,
}: {
  t: TestContext;
  call: Call;
  pool: Pool;
  base: string;
  input: Record<string, unknown>;
  password: string;
}) {
  async function login(email: string) {
    const result = await call("/auth/login", "POST", { email, password });
    assert.equal(result.status, 200);
    return result.cookie;
  }
  const employee = await login("maxim@example.test");
  const manager = await login("manager@example.test");
  const finance = await login("finance@example.test");
  async function sent() {
    const draft = await call("/requests", "POST", input, employee);
    assert.equal(draft.status, 201);
    const result = await call(
      `/requests/${draft.data.id}/submit`,
      "POST",
      { version: draft.data.version },
      employee,
    );
    assert.equal(result.status, 200);
    return result.data;
  }
  await t.test(
    "IV: обработанные решения остаются у назначенного согласующего и фильтруются",
    async () => {
      const approved = await call(
        "/approvals?view=processed&decision=APPROVED",
        "GET",
        undefined,
        manager,
      );
      assert.equal(approved.status, 200);
      assert.equal(approved.data.total, 1);
      assert.equal(approved.data.page_size, 20);
      assert.equal(approved.data.items[0].approval_status, "APPROVED");
      assert.ok(approved.data.items[0].approval_decided_at);
      const refused = await call(
        "/approvals?view=processed&decision=REJECTED",
        "GET",
        undefined,
        manager,
      );
      assert.equal(refused.data.total, 1);
      assert.equal(refused.data.items[0].approval_comment, "Уточните бюджет");
      const financeList = await call(
        "/approvals?view=processed",
        "GET",
        undefined,
        finance,
      );
      assert.ok(
        financeList.data.items.every((row: any) => row.id !== "1"),
        "Старая заявка без финансового этапа не назначается финансисту",
      );
      const pending = await call("/approvals", "GET", undefined, manager);
      assert.equal(pending.data.view, "pending");
      assert.ok(
        pending.data.items.every(
          (row: any) => row.approval_status === "PENDING",
        ),
      );
      for (const query of [
        "view=unknown",
        "view=pending&decision=APPROVED",
        "view=processed&decision=PENDING",
        "view=processed&page=0",
        "view=processed&from=2026-11-12&to=2026-11-10",
      ]) {
        assert.equal(
          (await call(`/approvals?${query}`, "GET", undefined, manager)).status,
          400,
        );
      }
    },
  );
  await t.test(
    "IV: отмена до решения атомарно закрывает этапы и сохраняет причину",
    async () => {
      const draft = await call(
        "/requests",
        "POST",
        { ...input, employee_id: "2", estimated_total: "999999" },
        employee,
      );
      assert.equal(draft.data.employee_id, "1");
      assert.equal(draft.data.estimated_total, "300.30");
      assert.equal(draft.data.can_cancel, false);
      assert.equal(
        (
          await call(
            `/requests/${draft.data.id}/cancel`,
            "POST",
            { version: draft.data.version, reason: "Планы изменились" },
            employee,
          )
        ).status,
        409,
      );
      const result = await call(
        `/requests/${draft.data.id}/submit`,
        "POST",
        { version: draft.data.version },
        employee,
      );
      const before = result.data;
      assert.equal(before.can_cancel, true);
      const canceled = await call(
        `/requests/${before.id}/cancel`,
        "POST",
        { version: before.version, reason: "  Рабочая встреча перенесена  " },
        employee,
      );
      assert.equal(canceled.status, 200);
      const card = canceled.data;
      assert.equal(card.status, "CANCELED");
      assert.equal(card.cancellation_reason, "Рабочая встреча перенесена");
      assert.ok(card.canceled_at);
      assert.equal(card.submitted_at, before.submitted_at);
      assert.equal(card.decided_at, null);
      assert.equal(card.version, before.version + 1);
      assert.equal(card.can_cancel, false);
      assert.ok(
        card.steps.every(
          (step: any) => step.status === "SKIPPED" && !step.actionable,
        ),
      );
      assert.equal(card.history.length, 3);
      assert.equal(card.history.at(-1).new_status, "CANCELED");
      assert.equal(card.history.at(-1).comment, "Рабочая встреча перенесена");
      for (const user of [manager, finance])
        for (const view of ["pending", "processed"]) {
          const list = await call(
            `/approvals?view=${view}`,
            "GET",
            undefined,
            user,
          );
          assert.ok(list.data.items.every((row: any) => row.id !== card.id));
        }
      for (const operation of ["cancel", "submit"])
        assert.equal(
          (
            await call(
              `/requests/${card.id}/${operation}`,
              "POST",
              { version: card.version, reason: "Повтор" },
              employee,
            )
          ).status,
          409,
        );
      assert.equal(
        (
          await call(
            `/approvals/${card.steps[0].id}/approve`,
            "POST",
            { version: card.version },
            manager,
          )
        ).status,
        409,
      );
    },
  );
  let pendingForAuth: any;
  await t.test(
    "IV: неверная отмена, чужая заявка и снятая роль не обходят правила",
    async () => {
      pendingForAuth = await sent();
      const r = pendingForAuth;
      assert.equal(
        (
          await call(
            `/requests/${r.id}/cancel`,
            "POST",
            { version: r.version, reason: "Чужая отмена" },
            manager,
          )
        ).status,
        404,
      );
      for (const body of [
        { version: r.version, reason: "" },
        { version: r.version, reason: "   " },
        { version: r.version, reason: "x".repeat(2001) },
        { reason: "Нет версии" },
        { version: 0, reason: "Неверная версия" },
      ]) {
        assert.equal(
          (await call(`/requests/${r.id}/cancel`, "POST", body, employee))
            .status,
          400,
        );
      }
      assert.equal(
        (
          await call(
            `/requests/${r.id}/cancel`,
            "POST",
            { version: r.version - 1, reason: "Старая версия" },
            employee,
          )
        ).status,
        409,
      );
      const unchanged = await call(
        `/requests/${r.id}`,
        "GET",
        undefined,
        employee,
      );
      assert.equal(unchanged.data.status, "SUBMITTED");
      assert.equal(unchanged.data.history.length, 2);
      await pool.query(
        "DELETE FROM user_roles USING roles WHERE user_roles.role_id=roles.id AND user_id=1 AND code='EMPLOYEE'",
      );
      try {
        assert.equal(
          (
            await call(
              `/requests/${r.id}/cancel`,
              "POST",
              { version: r.version, reason: "Нет роли" },
              employee,
            )
          ).status,
          403,
        );
      } finally {
        await pool.query(
          "INSERT INTO user_roles(user_id,role_id) SELECT 1,id FROM roles WHERE code='EMPLOYEE' ON CONFLICT DO NOTHING",
        );
      }
      await pool.query(
        "DELETE FROM user_roles USING roles WHERE user_roles.role_id=roles.id AND user_id=2 AND code='APPROVER'",
      );
      try {
        assert.equal(
          (await call("/approvals?view=processed", "GET", undefined, manager))
            .status,
          403,
        );
        assert.equal(
          (await call(`/requests/${r.id}`, "GET", undefined, manager)).status,
          404,
        );
        assert.equal(
          (await call(`/requests/${r.id}/history`, "GET", undefined, manager))
            .status,
          404,
        );
        assert.equal(
          (
            await call(
              `/approvals/${r.steps[0].id}/approve`,
              "POST",
              { version: r.version },
              manager,
            )
          ).status,
          403,
        );
      } finally {
        await pool.query(
          "INSERT INTO user_roles(user_id,role_id) SELECT 2,id FROM roles WHERE code='APPROVER' ON CONFLICT DO NOTHING",
        );
      }
    },
  );
  await t.test(
    "IV: после первого решения отмена запрещена, архив отделяет моё решение от итогового",
    async () => {
      const r = pendingForAuth;
      const approved = await call(
        `/approvals/${r.steps[0].id}/approve`,
        "POST",
        { version: r.version, comment: "Руководитель согласовал" },
        manager,
      );
      assert.equal(approved.status, 200);
      assert.equal(approved.data.can_cancel, false);
      assert.equal(
        (
          await call(
            `/requests/${r.id}/cancel`,
            "POST",
            { version: approved.data.version, reason: "Уже поздно" },
            employee,
          )
        ).status,
        409,
      );
      const rejected = await call(
        `/approvals/${r.steps[1].id}/reject`,
        "POST",
        { version: approved.data.version, comment: "Бюджет не подтверждён" },
        finance,
      );
      assert.equal(rejected.status, 200);
      const archive = await call(
        "/approvals?view=processed&decision=APPROVED",
        "GET",
        undefined,
        manager,
      );
      const item = archive.data.items.find((row: any) => row.id === r.id);
      assert.equal(item.approval_status, "APPROVED");
      assert.equal(item.status, "REJECTED");
      assert.equal(item.approval_comment, "Руководитель согласовал");
    },
  );
  await t.test(
    "IV: конкурентные отмена и решение дают только один допустимый результат",
    async () => {
      const r = await sent();
      const results = await Promise.all([
        call(
          `/requests/${r.id}/cancel`,
          "POST",
          { version: r.version, reason: "Отмена одновременно с решением" },
          employee,
        ),
        call(
          `/approvals/${r.steps[0].id}/approve`,
          "POST",
          { version: r.version },
          manager,
        ),
      ]);
      assert.deepEqual(
        results.map((result) => result.status).sort(),
        [200, 409],
      );
      const card = (await call(`/requests/${r.id}`, "GET", undefined, employee))
        .data;
      assert.equal(card.version, r.version + 1);
      assert.equal(card.history.length, 3);
      if (card.status === "CANCELED") {
        assert.ok(card.steps.every((step: any) => step.status === "SKIPPED"));
      } else {
        assert.equal(card.status, "UNDER_REVIEW");
        assert.equal(card.steps[0].status, "APPROVED");
        assert.equal(card.steps[1].status, "PENDING");
        assert.equal(card.canceled_at, null);
      }
    },
  );
  await t.test(
    "IV: CHECK защищает метаданные отмены независимо от API",
    async () => {
      const draft = (await call("/requests", "POST", input, employee)).data;
      await assert.rejects(
        pool.query(
          "UPDATE travel_requests SET status='CANCELED',submitted_at=now() WHERE id=$1",
          [draft.id],
        ),
        { code: "23514" },
      );
      await assert.rejects(
        pool.query(
          "UPDATE travel_requests SET cancellation_reason='Не отменена' WHERE id=$1",
          [draft.id],
        ),
        { code: "23514" },
      );
      assert.equal(
        (await call(`/requests/${draft.id}`, "GET", undefined, employee)).data
          .status,
        "DRAFT",
      );
    },
  );
  await t.test(
    "IV: пагинация обработанных не теряет записи и не раскрывает чужие назначения",
    async () => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (let i = 0; i < 21; i++) {
          const trip = (
            await client.query(`INSERT INTO trips(destination_country,destination_city,purpose,start_date,end_date,transport_type)
          VALUES ('Россия','Архив','Синтетическая проверка пагинации','2030-01-01','2030-01-02','RAIL') RETURNING id`)
          ).rows[0];
          const time = new Date(Date.now() - i * 1000).toISOString();
          const request = (
            await client.query(
              `INSERT INTO travel_requests(number,employee_id,trip_id,status,estimated_total,submitted_at,decided_at)
          VALUES ($1,1,$2,'REJECTED',1,now()-interval '1 hour',$3) RETURNING id`,
              [`ARCHIVE-${Date.now()}-${i}`, trip.id, time],
            )
          ).rows[0];
          await client.query(
            "INSERT INTO expense_estimates(request_id,category_id,amount) VALUES ($1,1,1)",
            [request.id],
          );
          await client.query(
            `INSERT INTO approval_steps(request_id,step_order,approver_employee_id,status,decided_at,decision_comment)
          VALUES ($1,1,2,'REJECTED',$2,'Проверка пагинации')`,
            [request.id, time],
          );
          await client.query(
            `INSERT INTO request_status_history(request_id,old_status,new_status,changed_by_employee_id,comment)
          VALUES ($1,NULL,'DRAFT',1,'Создана'),($1,'DRAFT','SUBMITTED',1,'Отправлена'),($1,'SUBMITTED','REJECTED',2,'Проверка пагинации')`,
            [request.id],
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      const query =
        "/approvals?view=processed&decision=REJECTED&from=2030-01-01&to=2030-01-02";
      const first = (await call(query + "&page=1", "GET", undefined, manager))
        .data;
      const second = (await call(query + "&page=2", "GET", undefined, manager))
        .data;
      assert.equal(first.total, 21);
      assert.equal(first.items.length, 20);
      assert.equal(second.items.length, 1);
      const ids = [...first.items, ...second.items].map((row) => row.id);
      assert.equal(new Set(ids).size, 21);
      const other = (await call(query, "GET", undefined, finance)).data;
      assert.equal(other.total, 0);
      assert.equal(
        (
          await call(
            `/requests/${first.items[0].id}`,
            "GET",
            undefined,
            finance,
          )
        ).status,
        404,
      );
      const times = first.items.map((row: any) => row.approval_decided_at);
      assert.deepEqual(times, [...times].sort().reverse());
    },
  );
  await t.test(
    "IV: истёкшая, удалённая сессия и отключённая учётная запись отклоняются",
    async () => {
      const expired = await login("maxim@example.test");
      const hash = (cookie: string) =>
        createHash("sha256")
          .update(cookie.slice(cookie.indexOf("=") + 1))
          .digest("hex");
      await pool.query(
        "UPDATE sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
        [hash(expired)],
      );
      assert.equal(
        (await call("/auth/me", "GET", undefined, expired)).status,
        401,
      );
      const revoked = await login("maxim@example.test");
      await pool.query("DELETE FROM sessions WHERE token_hash=$1", [
        hash(revoked),
      ]);
      assert.equal(
        (await call("/auth/me", "GET", undefined, revoked)).status,
        401,
      );
      await pool.query("UPDATE users SET is_active=false WHERE id=2");
      try {
        assert.equal(
          (await call("/auth/me", "GET", undefined, manager)).status,
          401,
        );
        assert.equal(
          (
            await call("/auth/login", "POST", {
              email: "manager@example.test",
              password,
            })
          ).status,
          401,
        );
      } finally {
        await pool.query("UPDATE users SET is_active=true WHERE id=2");
      }
      const response = await fetch(base + "/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email: "maxim@example.test", password }),
      });
      assert.equal(response.status, 200);
      const setCookie = response.headers.get("set-cookie")!;
      assert.match(setCookie, /HttpOnly/);
      assert.match(setCookie, /SameSite=Lax/);
      assert.match(setCookie, /Max-Age=28800/);
      const user = await response.json();
      assert.equal("password_hash" in user, false);
      assert.equal("token_hash" in user, false);
      await call("/auth/logout", "POST", {}, setCookie.split(";")[0]);
    },
  );
  await t.test(
    "IV: CSRF, тип запроса, SQL-ввод и логи не обходят защиту",
    async (sub) => {
      const messages: string[] = [];
      sub.mock.method(console, "log", (...args: unknown[]) =>
        messages.push(args.join(" ")),
      );
      const response = await fetch(base + "/requests", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          Origin: "http://localhost:3000",
          Cookie: employee,
        },
        body: "{}",
      });
      assert.equal(response.status, 415);
      assert.equal(
        (await call("/requests", "POST", input, employee, "")).status,
        403,
      );
      assert.equal(
        (
          await call(
            "/requests",
            "POST",
            input,
            employee,
            "http://localhost:9999",
          )
        ).status,
        403,
      );
      const malformed = await fetch(base + "/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          Cookie: employee,
        },
        body: '{"bad":',
      });
      assert.equal(malformed.status, 400);
      assert.equal(
        (await call("/requests/1%20OR%201=1", "GET", undefined, employee))
          .status,
        400,
      );
      assert.equal(
        (
          await call(
            "/approvals?view=processed&decision=APPROVED%27%20OR%201=1--",
            "GET",
            undefined,
            manager,
          )
        ).status,
        400,
      );
      const count = (await pool.query("SELECT count(*) FROM users")).rows[0]
        .count;
      const text =
        "Рабочая встреча <script>alert('x')</script>; DROP TABLE users; --";
      const stored = await call(
        "/requests",
        "POST",
        { ...input, purpose: text },
        employee,
      );
      assert.equal(stored.status, 201);
      assert.equal(stored.data.purpose, text);
      assert.equal(
        (await pool.query("SELECT count(*) FROM users")).rows[0].count,
        count,
      );
      assert.equal(messages.join("\n").includes(password), false);
      assert.equal(messages.join("\n").includes(employee), false);
      assert.equal(
        messages.join("\n").includes(process.env.TEST_DATABASE_URL!),
        false,
      );
      assert.ok(messages.some((line) => line.includes("requestId")));
    },
  );
  await t.test("IV: ограничение попыток входа возвращает 429", async () => {
    let result;
    for (let i = 0; i < 35; i++) {
      result = await call("/auth/login", "POST", {
        email: "maxim@example.test",
        password: "wrong",
      });
      if (result.status === 429) break;
    }
    assert.equal(result?.status, 429);
    assert.match(result?.data.error.message, /попыток/);
    assert.equal((await call("/health/live")).status, 200);
  });
}
