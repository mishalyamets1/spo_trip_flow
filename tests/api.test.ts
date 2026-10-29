import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

test(
  "API и PostgreSQL: полный цикл и ограничения",
  { skip: !process.env.TEST_DATABASE_URL },
  async (t) => {
    assert.match(
      new URL(process.env.TEST_DATABASE_URL!).pathname,
      /^\/tripflow_test_[a-z0-9_]+$/,
    );
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    delete process.env.PGHOST;
    process.env.APP_ORIGIN = "http://localhost:3000";
    process.env.NODE_ENV = "test";
    const { app } = await import("../apps/api/src/app.js");
    const { pool } = await import("../apps/api/src/db.js");
    const { hashPassword } = await import("../apps/api/src/utils/crypto.js");
    const connected = await pool.query("SELECT current_database() AS name");
    assert.equal(
      connected.rows[0].name,
      new URL(process.env.TEST_DATABASE_URL!).pathname.slice(1),
    );
    const password = "TripFlow-test-password!";
    await pool.query("UPDATE users SET password_hash=$1", [
      await hashPassword(password),
    ]);
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
    t.after(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await pool.end();
    });
    async function call(
      path: string,
      method = "GET",
      body?: unknown,
      cookie = "",
      origin = "http://localhost:3000",
    ) {
      const response = await fetch(base + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          Origin: origin,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = response.status === 204 ? null : await response.json();
      return {
        status: response.status,
        data,
        cookie: response.headers.get("set-cookie")?.split(";")[0] || "",
      };
    }
    const input = {
      destination_country: "Россия",
      destination_city: "Казань",
      purpose: "Встреча с командой проекта",
      start_date: "2026-11-10",
      end_date: "2026-11-12",
      transport_type: "RAIL",
      accommodation_required: true,
      currency: "RUB",
      employee_comment: "",
      expenses: [
        { category_id: "1", amount: "100.10", description: "" },
        { category_id: "2", amount: "200.20", description: "" },
      ],
    };
    let employee = "",
      manager = "",
      finance = "";
    let request: any;
    await t.test("роль приложения не может менять схему", async () => {
      await assert.rejects(
        pool.query("CREATE TABLE trip_app.forbidden_table(id int)"),
        { code: "42501" },
      );
    });
    await t.test(
      "готовность, вход, неверный пароль, CSRF и доступ без сессии",
      async () => {
        assert.equal((await call("/health/ready")).status, 200);
        assert.equal((await call("/requests")).status, 401);
        assert.equal(
          (
            await call(
              "/auth/login",
              "POST",
              { email: "maxim@example.test", password: "wrong" },
              "",
              "http://localhost:3001",
            )
          ).status,
          401,
        );
        assert.equal(
          (
            await call(
              "/auth/login",
              "POST",
              { email: "maxim@example.test", password },
              "",
              "http://localhost:9999",
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await call("/auth/login", "POST", {
              email: "maxim@example.test",
              password: "wrong",
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await call(
              "/auth/login",
              "POST",
              { email: "maxim@example.test", password },
              "",
              "https://foreign.test",
            )
          ).status,
          403,
        );
        for (const [email, assign] of [
          [
            "maxim@example.test",
            (x: string) => {
              employee = x;
            },
          ],
          [
            "manager@example.test",
            (x: string) => {
              manager = x;
            },
          ],
          [
            "finance@example.test",
            (x: string) => {
              finance = x;
            },
          ],
        ] as const) {
          const login = await call("/auth/login", "POST", { email, password });
          assert.equal(login.status, 200);
          assert.ok(login.cookie);
          assign(login.cookie);
        }
        assert.equal((await call("/health/live")).status, 200);
        assert.equal(
          (await call("/auth/me", "GET", undefined, employee)).status,
          200,
        );
        const categories = await call(
          "/expense-categories",
          "GET",
          undefined,
          employee,
        );
        assert.equal(categories.status, 200);
        assert.equal(categories.data.items.length, 4);
      },
    );
    await t.test(
      "создание и обновление черновика, точная сумма и конфликт версии",
      async () => {
        const created = await call("/requests", "POST", input, employee);
        assert.equal(created.status, 201);
        request = created.data;
        assert.equal(typeof request.expenses[0].category_id, "string");
        assert.equal(request.estimated_total, "300.30");
        assert.equal(request.history.length, 1);
        assert.equal(
          (await call(`/requests/${request.id}`, "GET", undefined, manager))
            .status,
          404,
        );
        const updated = await call(
          `/requests/${request.id}`,
          "PATCH",
          { ...input, version: request.version, destination_city: "Самара" },
          employee,
        );
        assert.equal(updated.status, 200);
        assert.equal(
          (
            await call(
              `/requests/${request.id}`,
              "PATCH",
              { ...input, version: request.version },
              employee,
            )
          ).status,
          409,
        );
        request = updated.data;
      },
    );
    await t.test(
      "ошибочные данные и откат частично выполненной записи",
      async () => {
        assert.equal(
          (
            await call(
              "/requests",
              "POST",
              { ...input, end_date: "2026-11-09" },
              employee,
            )
          ).status,
          400,
        );
        const before = (await pool.query("SELECT count(*) FROM trips")).rows[0]
          .count;
        const bad = await call(
          "/requests",
          "POST",
          {
            ...input,
            expenses: [{ category_id: "999999", amount: "1", description: "" }],
          },
          employee,
        );
        assert.equal(bad.status, 400);
        assert.equal(
          (await pool.query("SELECT count(*) FROM trips")).rows[0].count,
          before,
        );
        assert.equal(
          (await call("/approvals", "GET", undefined, employee)).status,
          403,
        );
      },
    );
    await t.test(
      "отправка создаёт снимок двух этапов, повторы запрещены",
      async () => {
        const sent = await call(
          `/requests/${request.id}/submit`,
          "POST",
          { version: request.version },
          employee,
        );
        assert.equal(sent.status, 200);
        request = sent.data;
        assert.equal(request.status, "SUBMITTED");
        assert.equal(request.steps.length, 2);
        await pool.query(
          "UPDATE approval_route_steps SET step_order=99 WHERE step_order=2",
        );
        const snapshot = await call(
          `/requests/${request.id}`,
          "GET",
          undefined,
          employee,
        );
        assert.equal(snapshot.data.steps[1].step_order, 2);
        await pool.query(
          "UPDATE approval_route_steps SET step_order=2 WHERE step_order=99",
        );
        assert.equal(
          (
            await call(
              `/requests/${request.id}/submit`,
              "POST",
              { version: request.version },
              employee,
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await call(
              `/requests/${request.id}`,
              "PATCH",
              { ...input, version: request.version },
              employee,
            )
          ).status,
          409,
        );
        assert.equal(
          (await call("/approvals", "GET", undefined, finance)).data.items
            .length,
          0,
        );
        assert.equal(
          (
            await call(
              `/approvals/${request.steps[1].id}/approve`,
              "POST",
              { version: request.version },
              finance,
            )
          ).status,
          409,
        );
      },
    );
    await t.test(
      "конкурентное решение выполняется один раз, последний этап завершает заявку",
      async () => {
        const results = await Promise.all(
          Array.from({ length: 2 }, () =>
            call(
              `/approvals/${request.steps[0].id}/approve`,
              "POST",
              { version: request.version },
              manager,
            ),
          ),
        );
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
        request = results.find((r) => r.status === 200)!.data;
        assert.equal(request.status, "UNDER_REVIEW");
        assert.equal(
          (await call("/approvals", "GET", undefined, finance)).data.items
            .length,
          1,
        );
        const final = await call(
          `/approvals/${request.steps[1].id}/approve`,
          "POST",
          { version: request.version },
          finance,
        );
        assert.equal(final.status, 200);
        assert.equal(final.data.status, "APPROVED");
        assert.equal(final.data.history.length, 4);
        assert.ok(final.data.decided_at);
      },
    );
    await t.test(
      "отказ требует причину и прекращает последующие этапы",
      async () => {
        request = (await call("/requests", "POST", input, employee)).data;
        request = (
          await call(
            `/requests/${request.id}/submit`,
            "POST",
            { version: request.version },
            employee,
          )
        ).data;
        assert.equal(
          (
            await call(
              `/approvals/${request.steps[0].id}/reject`,
              "POST",
              { version: request.version, comment: "   " },
              manager,
            )
          ).status,
          400,
        );
        const rejected = await call(
          `/approvals/${request.steps[0].id}/reject`,
          "POST",
          { version: request.version, comment: "Уточните бюджет" },
          manager,
        );
        assert.equal(rejected.status, 200);
        assert.equal(rejected.data.status, "REJECTED");
        assert.equal(rejected.data.steps[1].status, "SKIPPED");
        assert.equal(rejected.data.history.at(-1).comment, "Уточните бюджет");
      },
    );
    await t.test("самосогласование, удаление черновика и выход", async () => {
      const own = await call("/requests", "POST", input, manager);
      assert.equal(
        (
          await call(
            `/requests/${own.data.id}/submit`,
            "POST",
            { version: own.data.version },
            manager,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await call(
            `/requests/${own.data.id}`,
            "DELETE",
            { version: own.data.version },
            manager,
          )
        ).status,
        204,
      );
      assert.equal(
        (await call(`/requests/${own.data.id}`, "GET", undefined, manager))
          .status,
        404,
      );
      assert.equal(
        (
          await call(
            "/requests?status=APPROVED&page=1",
            "GET",
            undefined,
            employee,
          )
        ).data.total,
        1,
      );
      assert.equal(
        (await call("/auth/logout", "POST", {}, employee)).status,
        204,
      );
      assert.equal(
        (await call("/auth/me", "GET", undefined, employee)).status,
        401,
      );
    });
  },
);
