import dotenv from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dockerSql, isolatedUrl } from "./lib/database-tools.mjs";
dotenv.config({ quiet: true });
const database = `tripflow_test_preview_${Date.now()}`;
const password = "TripFlow-checks-2026!";
let created = false,
  pool,
  server,
  web,
  stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  if (web) {
    web.kill("SIGTERM");
    await new Promise((resolve) => {
      web.once("exit", resolve);
      setTimeout(resolve, 3000);
    });
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
  if (created)
    dockerSql(`DROP DATABASE "${database}" WITH (FORCE);`, "postgres");
}
process.on("SIGINT", () => void stop().then(() => process.exit()));
process.on("SIGTERM", () => void stop().then(() => process.exit()));
try {
  dockerSql(`CREATE DATABASE "${database}";`);
  created = true;
  for (const file of readdirSync("database/migrations")
    .filter((f) => f.endsWith(".up.sql"))
    .sort())
    dockerSql(readFileSync("database/migrations/" + file, "utf8"), database);
  process.env.DATABASE_URL = isolatedUrl(database);
  delete process.env.PGHOST;
  process.env.APP_ORIGIN = "http://127.0.0.1:3105";
  process.env.NODE_ENV = "development";
  ({ pool } = await import("../apps/api/src/db.js"));
  const { prepareDemo } =
    await import("../apps/api/src/services/demo.service.js");
  await prepareDemo(password);
  const { hashPassword } = await import("../apps/api/src/utils/crypto.js");
  const { transaction } = await import("../apps/api/src/db.js");
  const repo = await import("../apps/api/src/repositories/admin.repository.js");
  const auth = await import("../apps/api/src/repositories/auth.repository.js");
  const adminHash = await hashPassword(password);
  const rootId = await transaction((client) =>
    repo.writeEmployee(
      client,
      {
        full_name: "Учебный администратор",
        email: "admin@example.test",
        department_id: "1",
        employee_number: "CHECK-ADMIN",
        position: "Администратор",
        phone: "",
        hire_date: "2026-11-01",
        roles: ["ADMIN", "APPROVER"],
        is_active: true,
      },
      undefined,
      adminHash,
    ),
  );
  const route = (
    await pool.query(
      "SELECT id FROM approval_routes WHERE department_id=1 AND is_active",
    )
  ).rows[0];
  await pool.query(
    "INSERT INTO approval_route_steps(route_id,step_order,approver_employee_id) VALUES($1,3,$2)",
    [route.id, rootId],
  );
  const actors = (
    await pool.query(
      "SELECT e.id,e.user_id,u.email FROM employees e JOIN users u ON u.id=e.user_id",
    )
  ).rows;
  const person = (email) => actors.find((a) => a.email === email);
  const author = await auth.findUserById(person("maxim@example.test").user_id);
  const requests = await import("../apps/api/src/services/request.service.js");
  const approvals =
    await import("../apps/api/src/services/approval.service.js");
  const input = {
    destination_country: "Россия",
    destination_city: "Учебная проверка V",
    purpose: "Проверка каждого решения в истории трёх этапов",
    start_date: "2026-12-01",
    end_date: "2026-12-02",
    transport_type: "RAIL",
    accommodation_required: false,
    currency: "RUB",
    employee_comment: "Тестовые данные отдельной БД",
    expenses: [
      { category_id: "1", amount: "100.00", description: "Учебные расходы" },
    ],
  };
  let card = await requests.saveRequest(author, input);
  card = await requests.submitRequest(author, card.id, card.version);
  for (const [i, email] of [
    "manager@example.test",
    "finance@example.test",
    "admin@example.test",
  ].entries()) {
    const actor = await auth.findUserById(person(email).user_id);
    card = await approvals.decide(
      actor,
      card.steps[i].id,
      card.version,
      true,
      `Учебное решение этапа ${i + 1}`,
    );
  }
  const completedId = card.id;
  let pending = await requests.saveRequest(author, {
    ...input,
    destination_city: "Для ручного согласования V",
  });
  pending = await requests.submitRequest(author, pending.id, pending.version);
  const { app } = await import("../apps/api/src/app.js");
  server = app.listen(4105, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  web = spawn(
    process.execPath,
    [
      "../../node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3105",
    ],
    {
      cwd: "apps/web",
      env: { ...process.env, API_ORIGIN: "http://127.0.0.1:4105" },
      stdio: "inherit",
    },
  );
  web.once("error", () => void stop());
  web.once("exit", () => void stop());
  console.log(
    `Проверочный стенд: http://127.0.0.1:3105. Готовая история: /requests/${completedId}; для ручного согласования: /requests/${pending.id}.`,
  );
  console.log(
    `Учебные аккаунты maxim/manager/finance/admin@example.test. Пароль только этого стенда: ${password}`,
  );
  console.log(
    "Рабочая БД не менялась. Ctrl+C остановит стенд и удалит только его временную БД.",
  );
} catch (error) {
  console.error(error.message);
  await stop();
  process.exitCode = 1;
}
