import {
  describe,
  test,
  beforeAll,
  beforeEach,
  afterAll,
  expect,
  jest,
} from "@jest/globals";
import type { Server } from "node:http";
import type { Pool } from "pg";
import { once } from "node:events";
import { registerStage4Checks } from "./helpers/stage4.js";
import { registerAdminChecks } from "./helpers/admin.js";
const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;
integration("API и PostgreSQL: полный цикл и ограничения", () => {
  let pool: Pool;
  let server: Server | undefined;
  let base: string;
  const password = "TripFlow-test-password!";
  // Keep request logs out of Jest output; the logging scenario installs its own capture.
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  beforeAll(async () => {
    expect(new URL(process.env.TEST_DATABASE_URL!).pathname).toMatch(
      /^\/tripflow_test_[a-z0-9_]+$/,
    );
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    delete process.env.PGHOST;
    process.env.APP_ORIGIN = "http://localhost:3000";
    process.env.NODE_ENV = "test";
    const { app } = await import("../apps/api/src/app.js");
    ({ pool } = await import("../apps/api/src/db.js"));
    const { hashPassword } = await import("../apps/api/src/utils/crypto.js");
    const connected = await pool.query("SELECT current_database() AS name");
    expect(connected.rows[0].name).toBe(
      new URL(process.env.TEST_DATABASE_URL!).pathname.slice(1),
    );
    await pool.query("UPDATE users SET password_hash=$1", [
      await hashPassword(password),
    ]);
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    base = `http://127.0.0.1:${
      (
        server.address() as {
          port: number;
        }
      ).port
    }/api`;
  });
  afterAll(async () => {
    try {
      if (server)
        await new Promise<void>((resolve, reject) =>
          server!.close((error) => (error ? reject(error) : resolve())),
        );
    } finally {
      await pool?.end();
      jest.restoreAllMocks();
    }
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
  test("роль приложения не может менять схему", async () => {
    await expect(
      pool.query("CREATE TABLE trip_app.forbidden_table(id int)"),
    ).rejects.toMatchObject({ code: "42501" });
  });
  test("готовность, вход, неверный пароль, CSRF и доступ без сессии", async () => {
    expect((await call("/health/ready")).status).toBe(200);
    expect((await call("/requests")).status).toBe(401);
    expect(
      (
        await call(
          "/auth/login",
          "POST",
          { email: "maxim@example.test", password: "wrong" },
          "",
          "http://localhost:3001",
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await call(
          "/auth/login",
          "POST",
          { email: "maxim@example.test", password },
          "",
          "http://localhost:9999",
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call("/auth/login", "POST", {
          email: "maxim@example.test",
          password: "wrong",
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await call(
          "/auth/login",
          "POST",
          { email: "maxim@example.test", password },
          "",
          "https://foreign.test",
        )
      ).status,
    ).toBe(403);
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
      expect(login.status).toBe(200);
      expect(login.cookie).toBeTruthy();
      assign(login.cookie);
    }
    expect((await call("/health/live")).status).toBe(200);
    expect((await call("/auth/me", "GET", undefined, employee)).status).toBe(
      200,
    );
    const categories = await call(
      "/expense-categories",
      "GET",
      undefined,
      employee,
    );
    expect(categories.status).toBe(200);
    expect(categories.data.items.length).toBe(4);
  });
  test("создание и обновление черновика, точная сумма и конфликт версии", async () => {
    const created = await call("/requests", "POST", input, employee);
    expect(created.status).toBe(201);
    request = created.data;
    expect(typeof request.expenses[0].category_id).toBe("string");
    expect(request.estimated_total).toBe("300.30");
    expect(request.history.length).toBe(1);
    expect(
      (await call(`/requests/${request.id}`, "GET", undefined, manager)).status,
    ).toBe(404);
    const updated = await call(
      `/requests/${request.id}`,
      "PATCH",
      { ...input, version: request.version, destination_city: "Самара" },
      employee,
    );
    expect(updated.status).toBe(200);
    expect(
      (
        await call(
          `/requests/${request.id}`,
          "PATCH",
          { ...input, version: request.version },
          employee,
        )
      ).status,
    ).toBe(409);
    request = updated.data;
  });
  test("ошибочные данные и откат частично выполненной записи", async () => {
    expect(
      (
        await call(
          "/requests",
          "POST",
          { ...input, end_date: "2026-11-09" },
          employee,
        )
      ).status,
    ).toBe(400);
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
    expect(bad.status).toBe(400);
    expect((await pool.query("SELECT count(*) FROM trips")).rows[0].count).toBe(
      before,
    );
    expect((await call("/approvals", "GET", undefined, employee)).status).toBe(
      403,
    );
  });
  test("отправка создаёт снимок двух этапов, повторы запрещены", async () => {
    const sent = await call(
      `/requests/${request.id}/submit`,
      "POST",
      { version: request.version },
      employee,
    );
    expect(sent.status).toBe(200);
    request = sent.data;
    expect(request.status).toBe("SUBMITTED");
    expect(request.steps.length).toBe(2);
    await pool.query(
      "UPDATE approval_route_steps SET step_order=99 WHERE step_order=2",
    );
    const snapshot = await call(
      `/requests/${request.id}`,
      "GET",
      undefined,
      employee,
    );
    expect(snapshot.data.steps[1].step_order).toBe(2);
    await pool.query(
      "UPDATE approval_route_steps SET step_order=2 WHERE step_order=99",
    );
    expect(
      (
        await call(
          `/requests/${request.id}/submit`,
          "POST",
          { version: request.version },
          employee,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          `/requests/${request.id}`,
          "PATCH",
          { ...input, version: request.version },
          employee,
        )
      ).status,
    ).toBe(409);
    expect(
      (await call("/approvals", "GET", undefined, finance)).data.items.length,
    ).toBe(0);
    expect(
      (
        await call(
          `/approvals/${request.steps[1].id}/approve`,
          "POST",
          { version: request.version },
          finance,
        )
      ).status,
    ).toBe(409);
  });
  test("конкурентное решение выполняется один раз, последний этап завершает заявку", async () => {
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
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    request = results.find((r) => r.status === 200)!.data;
    expect(request.status).toBe("UNDER_REVIEW");
    expect(
      (await call("/approvals", "GET", undefined, finance)).data.items.length,
    ).toBe(1);
    const final = await call(
      `/approvals/${request.steps[1].id}/approve`,
      "POST",
      { version: request.version },
      finance,
    );
    expect(final.status).toBe(200);
    expect(final.data.status).toBe("APPROVED");
    expect(final.data.history.length).toBe(4);
    expect(final.data.decided_at).toBeTruthy();
  });
  test("отказ требует причину и прекращает последующие этапы", async () => {
    request = (await call("/requests", "POST", input, employee)).data;
    request = (
      await call(
        `/requests/${request.id}/submit`,
        "POST",
        { version: request.version },
        employee,
      )
    ).data;
    expect(
      (
        await call(
          `/approvals/${request.steps[0].id}/reject`,
          "POST",
          { version: request.version, comment: "   " },
          manager,
        )
      ).status,
    ).toBe(400);
    const rejected = await call(
      `/approvals/${request.steps[0].id}/reject`,
      "POST",
      { version: request.version, comment: "Уточните бюджет" },
      manager,
    );
    expect(rejected.status).toBe(200);
    expect(rejected.data.status).toBe("REJECTED");
    expect(rejected.data.steps[1].status).toBe("SKIPPED");
    expect(rejected.data.history.at(-1).comment).toBe("Уточните бюджет");
  });
  test("самосогласование, удаление черновика и выход", async () => {
    const own = await call("/requests", "POST", input, manager);
    expect(
      (
        await call(
          `/requests/${own.data.id}/submit`,
          "POST",
          { version: own.data.version },
          manager,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          `/requests/${own.data.id}`,
          "DELETE",
          { version: own.data.version },
          manager,
        )
      ).status,
    ).toBe(204);
    expect(
      (await call(`/requests/${own.data.id}`, "GET", undefined, manager))
        .status,
    ).toBe(404);
    expect(
      (
        await call(
          "/requests?status=APPROVED&page=1",
          "GET",
          undefined,
          employee,
        )
      ).data.total,
    ).toBe(1);
    expect((await call("/auth/logout", "POST", {}, employee)).status).toBe(204);
    expect((await call("/auth/me", "GET", undefined, employee)).status).toBe(
      401,
    );
  });
  registerAdminChecks(() => ({ call, pool, input, password }));
  registerStage4Checks(() => ({ call, pool, base, input, password }));
});
