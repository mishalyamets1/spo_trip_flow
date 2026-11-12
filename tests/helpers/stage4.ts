import { createHash } from "node:crypto";
import { describe, test, beforeAll, expect, jest } from "@jest/globals";
import type { Pool } from "pg";
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
type Stage4Context = {
  call: Call;
  pool: Pool;
  base: string;
  input: Record<string, unknown>;
  password: string;
};
export function registerStage4Checks(getContext: () => Stage4Context) {
  describe("Отмена, архив и безопасность", () => {
    let call: Call,
      pool: Pool,
      base: string,
      input: Record<string, unknown>,
      password: string;
    let employee: string, manager: string, finance: string;
    beforeAll(async () => {
      ({ call, pool, base, input, password } = getContext());
      employee = await login("maxim@example.test");
      manager = await login("manager@example.test");
      finance = await login("finance@example.test");
    });
    async function login(email: string) {
      const result = await call("/auth/login", "POST", { email, password });
      expect(result.status).toBe(200);
      return result.cookie;
    }
    async function sent() {
      const draft = await call("/requests", "POST", input, employee);
      expect(draft.status).toBe(201);
      const result = await call(
        `/requests/${draft.data.id}/submit`,
        "POST",
        { version: draft.data.version },
        employee,
      );
      expect(result.status).toBe(200);
      return result.data;
    }
    test("IV: обработанные решения остаются у назначенного согласующего и фильтруются", async () => {
      const approved = await call(
        "/approvals?view=processed&decision=APPROVED",
        "GET",
        undefined,
        manager,
      );
      expect(approved.status).toBe(200);
      expect(approved.data.total).toBe(1);
      expect(approved.data.page_size).toBe(20);
      expect(approved.data.items[0].approval_status).toBe("APPROVED");
      expect(approved.data.items[0].approval_decided_at).toBeTruthy();
      const refused = await call(
        "/approvals?view=processed&decision=REJECTED",
        "GET",
        undefined,
        manager,
      );
      expect(refused.data.total).toBe(1);
      expect(refused.data.items[0].approval_comment).toBe("Уточните бюджет");
      const financeList = await call(
        "/approvals?view=processed",
        "GET",
        undefined,
        finance,
      );
      expect(
        financeList.data.items.every((row: any) => row.id !== "1"),
      ).toBeTruthy();
      const pending = await call("/approvals", "GET", undefined, manager);
      expect(pending.data.view).toBe("pending");
      expect(
        pending.data.items.every(
          (row: any) => row.approval_status === "PENDING",
        ),
      ).toBeTruthy();
      for (const query of [
        "view=unknown",
        "view=pending&decision=APPROVED",
        "view=processed&decision=PENDING",
        "view=processed&page=0",
        "view=processed&from=2026-11-12&to=2026-11-10",
      ]) {
        expect(
          (await call(`/approvals?${query}`, "GET", undefined, manager)).status,
        ).toBe(400);
      }
    });
    test("IV: отмена до решения атомарно закрывает этапы и сохраняет причину", async () => {
      const draft = await call(
        "/requests",
        "POST",
        { ...input, employee_id: "2", estimated_total: "999999" },
        employee,
      );
      expect(draft.data.employee_id).toBe("1");
      expect(draft.data.estimated_total).toBe("300.30");
      expect(draft.data.can_cancel).toBe(false);
      expect(
        (
          await call(
            `/requests/${draft.data.id}/cancel`,
            "POST",
            { version: draft.data.version, reason: "Планы изменились" },
            employee,
          )
        ).status,
      ).toBe(409);
      const result = await call(
        `/requests/${draft.data.id}/submit`,
        "POST",
        { version: draft.data.version },
        employee,
      );
      const before = result.data;
      expect(before.can_cancel).toBe(true);
      const canceled = await call(
        `/requests/${before.id}/cancel`,
        "POST",
        { version: before.version, reason: "  Рабочая встреча перенесена  " },
        employee,
      );
      expect(canceled.status).toBe(200);
      const card = canceled.data;
      expect(card.status).toBe("CANCELED");
      expect(card.cancellation_reason).toBe("Рабочая встреча перенесена");
      expect(card.canceled_at).toBeTruthy();
      expect(card.submitted_at).toBe(before.submitted_at);
      expect(card.decided_at).toBe(null);
      expect(card.version).toBe(before.version + 1);
      expect(card.can_cancel).toBe(false);
      expect(
        card.steps.every(
          (step: any) => step.status === "SKIPPED" && !step.actionable,
        ),
      ).toBeTruthy();
      expect(card.history.length).toBe(3);
      expect(card.history.at(-1).new_status).toBe("CANCELED");
      expect(card.history.at(-1).comment).toBe("Рабочая встреча перенесена");
      for (const user of [manager, finance])
        for (const view of ["pending", "processed"]) {
          const list = await call(
            `/approvals?view=${view}`,
            "GET",
            undefined,
            user,
          );
          expect(
            list.data.items.every((row: any) => row.id !== card.id),
          ).toBeTruthy();
        }
      for (const operation of ["cancel", "submit"])
        expect(
          (
            await call(
              `/requests/${card.id}/${operation}`,
              "POST",
              { version: card.version, reason: "Повтор" },
              employee,
            )
          ).status,
        ).toBe(409);
      expect(
        (
          await call(
            `/approvals/${card.steps[0].id}/approve`,
            "POST",
            { version: card.version },
            manager,
          )
        ).status,
      ).toBe(409);
    });
    let pendingForAuth: any;
    test("IV: неверная отмена, чужая заявка и снятая роль не обходят правила", async () => {
      pendingForAuth = await sent();
      const r = pendingForAuth;
      expect(
        (
          await call(
            `/requests/${r.id}/cancel`,
            "POST",
            { version: r.version, reason: "Чужая отмена" },
            manager,
          )
        ).status,
      ).toBe(404);
      for (const body of [
        { version: r.version, reason: "" },
        { version: r.version, reason: "   " },
        { version: r.version, reason: "x".repeat(2001) },
        { reason: "Нет версии" },
        { version: 0, reason: "Неверная версия" },
      ]) {
        expect(
          (await call(`/requests/${r.id}/cancel`, "POST", body, employee))
            .status,
        ).toBe(400);
      }
      expect(
        (
          await call(
            `/requests/${r.id}/cancel`,
            "POST",
            { version: r.version - 1, reason: "Старая версия" },
            employee,
          )
        ).status,
      ).toBe(409);
      const unchanged = await call(
        `/requests/${r.id}`,
        "GET",
        undefined,
        employee,
      );
      expect(unchanged.data.status).toBe("SUBMITTED");
      expect(unchanged.data.history.length).toBe(2);
      await pool.query(
        "DELETE FROM user_roles USING roles WHERE user_roles.role_id=roles.id AND user_id=1 AND code='EMPLOYEE'",
      );
      try {
        expect(
          (
            await call(
              `/requests/${r.id}/cancel`,
              "POST",
              { version: r.version, reason: "Нет роли" },
              employee,
            )
          ).status,
        ).toBe(403);
      } finally {
        await pool.query(
          "INSERT INTO user_roles(user_id,role_id) SELECT 1,id FROM roles WHERE code='EMPLOYEE' ON CONFLICT DO NOTHING",
        );
      }
      await pool.query(
        "DELETE FROM user_roles USING roles WHERE user_roles.role_id=roles.id AND user_id=2 AND code='APPROVER'",
      );
      try {
        expect(
          (await call("/approvals?view=processed", "GET", undefined, manager))
            .status,
        ).toBe(403);
        expect(
          (await call(`/requests/${r.id}`, "GET", undefined, manager)).status,
        ).toBe(404);
        expect(
          (await call(`/requests/${r.id}/history`, "GET", undefined, manager))
            .status,
        ).toBe(404);
        expect(
          (
            await call(
              `/approvals/${r.steps[0].id}/approve`,
              "POST",
              { version: r.version },
              manager,
            )
          ).status,
        ).toBe(403);
      } finally {
        await pool.query(
          "INSERT INTO user_roles(user_id,role_id) SELECT 2,id FROM roles WHERE code='APPROVER' ON CONFLICT DO NOTHING",
        );
      }
    });
    test("IV: после первого решения отмена запрещена, архив отделяет моё решение от итогового", async () => {
      const r = pendingForAuth;
      const approved = await call(
        `/approvals/${r.steps[0].id}/approve`,
        "POST",
        { version: r.version, comment: "Руководитель согласовал" },
        manager,
      );
      expect(approved.status).toBe(200);
      expect(approved.data.can_cancel).toBe(false);
      expect(
        (
          await call(
            `/requests/${r.id}/cancel`,
            "POST",
            { version: approved.data.version, reason: "Уже поздно" },
            employee,
          )
        ).status,
      ).toBe(409);
      const rejected = await call(
        `/approvals/${r.steps[1].id}/reject`,
        "POST",
        { version: approved.data.version, comment: "Бюджет не подтверждён" },
        finance,
      );
      expect(rejected.status).toBe(200);
      const archive = await call(
        "/approvals?view=processed&decision=APPROVED",
        "GET",
        undefined,
        manager,
      );
      const item = archive.data.items.find((row: any) => row.id === r.id);
      expect(item.approval_status).toBe("APPROVED");
      expect(item.status).toBe("REJECTED");
      expect(item.approval_comment).toBe("Руководитель согласовал");
    });
    test("IV: конкурентные отмена и решение дают только один допустимый результат", async () => {
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
      expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
      const card = (await call(`/requests/${r.id}`, "GET", undefined, employee))
        .data;
      expect(card.version).toBe(r.version + 1);
      expect(card.history.length).toBe(3);
      if (card.status === "CANCELED") {
        expect(
          card.steps.every((step: any) => step.status === "SKIPPED"),
        ).toBeTruthy();
      } else {
        expect(card.status).toBe("UNDER_REVIEW");
        expect(card.steps[0].status).toBe("APPROVED");
        expect(card.steps[1].status).toBe("PENDING");
        expect(card.canceled_at).toBe(null);
      }
    });
    test("IV: CHECK защищает метаданные отмены независимо от API", async () => {
      const draft = (await call("/requests", "POST", input, employee)).data;
      await expect(
        pool.query(
          "UPDATE travel_requests SET status='CANCELED',submitted_at=now() WHERE id=$1",
          [draft.id],
        ),
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        pool.query(
          "UPDATE travel_requests SET cancellation_reason='Не отменена' WHERE id=$1",
          [draft.id],
        ),
      ).rejects.toMatchObject({ code: "23514" });
      expect(
        (await call(`/requests/${draft.id}`, "GET", undefined, employee)).data
          .status,
      ).toBe("DRAFT");
    });
    test("IV: пагинация обработанных не теряет записи и не раскрывает чужие назначения", async () => {
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
      expect(first.total).toBe(21);
      expect(first.items.length).toBe(20);
      expect(second.items.length).toBe(1);
      const ids = [...first.items, ...second.items].map((row) => row.id);
      expect(new Set(ids).size).toBe(21);
      const other = (await call(query, "GET", undefined, finance)).data;
      expect(other.total).toBe(0);
      expect(
        (
          await call(
            `/requests/${first.items[0].id}`,
            "GET",
            undefined,
            finance,
          )
        ).status,
      ).toBe(404);
      const times = first.items.map((row: any) => row.approval_decided_at);
      expect(times).toEqual([...times].sort().reverse());
    });
    test("IV: истёкшая, удалённая сессия и отключённая учётная запись отклоняются", async () => {
      const expired = await login("maxim@example.test");
      const hash = (cookie: string) =>
        createHash("sha256")
          .update(cookie.slice(cookie.indexOf("=") + 1))
          .digest("hex");
      await pool.query(
        "UPDATE sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
        [hash(expired)],
      );
      expect((await call("/auth/me", "GET", undefined, expired)).status).toBe(
        401,
      );
      const revoked = await login("maxim@example.test");
      await pool.query("DELETE FROM sessions WHERE token_hash=$1", [
        hash(revoked),
      ]);
      expect((await call("/auth/me", "GET", undefined, revoked)).status).toBe(
        401,
      );
      await pool.query("UPDATE users SET is_active=false WHERE id=2");
      try {
        expect((await call("/auth/me", "GET", undefined, manager)).status).toBe(
          401,
        );
        expect(
          (
            await call("/auth/login", "POST", {
              email: "manager@example.test",
              password,
            })
          ).status,
        ).toBe(401);
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
      expect(response.status).toBe(200);
      const setCookie = response.headers.get("set-cookie")!;
      expect(setCookie).toMatch(/HttpOnly/);
      expect(setCookie).toMatch(/SameSite=Lax/);
      expect(setCookie).toMatch(/Max-Age=28800/);
      const user = await response.json();
      expect("password_hash" in user).toBe(false);
      expect("token_hash" in user).toBe(false);
      await call("/auth/logout", "POST", {}, setCookie.split(";")[0]);
    });
    test("IV: CSRF, тип запроса, SQL-ввод и логи не обходят защиту", async () => {
      const messages: string[] = [];
      jest.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
        messages.push(args.join(" "));
      });
      const response = await fetch(base + "/requests", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          Origin: "http://localhost:3000",
          Cookie: employee,
        },
        body: "{}",
      });
      expect(response.status).toBe(415);
      expect(
        (await call("/requests", "POST", input, employee, "")).status,
      ).toBe(403);
      expect(
        (
          await call(
            "/requests",
            "POST",
            input,
            employee,
            "http://localhost:9999",
          )
        ).status,
      ).toBe(403);
      const malformed = await fetch(base + "/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          Cookie: employee,
        },
        body: '{"bad":',
      });
      expect(malformed.status).toBe(400);
      expect(
        (await call("/requests/1%20OR%201=1", "GET", undefined, employee))
          .status,
      ).toBe(400);
      expect(
        (
          await call(
            "/approvals?view=processed&decision=APPROVED%27%20OR%201=1--",
            "GET",
            undefined,
            manager,
          )
        ).status,
      ).toBe(400);
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
      expect(stored.status).toBe(201);
      expect(stored.data.purpose).toBe(text);
      expect(
        (await pool.query("SELECT count(*) FROM users")).rows[0].count,
      ).toBe(count);
      expect(messages.join("\n").includes(password)).toBe(false);
      expect(messages.join("\n").includes(employee)).toBe(false);
      expect(messages.join("\n").includes(process.env.TEST_DATABASE_URL!)).toBe(
        false,
      );
      expect(messages.some((line) => line.includes("requestId"))).toBeTruthy();
    });
    test("IV: ограничение попыток входа возвращает 429", async () => {
      let result;
      for (let i = 0; i < 35; i++) {
        result = await call("/auth/login", "POST", {
          email: "maxim@example.test",
          password: "wrong",
        });
        if (result.status === 429) break;
      }
      expect(result?.status).toBe(429);
      expect(result?.data.error.message).toMatch(/попыток/);
      expect((await call("/health/live")).status).toBe(200);
    });
  });
}
