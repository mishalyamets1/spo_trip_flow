import dotenv from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { cp, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { dockerSql, isolatedUrl } from "./lib/database-tools.mjs";

dotenv.config({ quiet: true });
const database = `tripflow_test_e2e_${process.pid}_${Date.now()}`;
let created = false,
  pool,
  server,
  web,
  runtime,
  stopping;
async function stop() {
  if (stopping) return stopping;
  stopping = (async () => {
    try {
      if (web && web.exitCode === null && web.signalCode === null) {
        const exited = once(web, "exit");
        const signal = (name) => {
          try {
            if (process.platform === "win32") web.kill(name);
            else process.kill(-web.pid, name);
          } catch (error) {
            if (error.code !== "ESRCH") throw error;
          }
        };
        signal("SIGTERM");
        const timer = setTimeout(() => signal("SIGKILL"), 8000);
        try {
          await exited;
        } finally {
          clearTimeout(timer);
        }
      }
      if (server) await new Promise((done) => server.close(done));
      if (pool) await pool.end();
    } finally {
      if (created)
        dockerSql(`DROP DATABASE "${database}" WITH (FORCE);`, "postgres");
      if (runtime) await rm(runtime, { recursive: true, force: true });
    }
  })();
  return stopping;
}
for (const name of ["SIGINT", "SIGTERM"])
  process.on(
    name,
    () =>
      void stop()
        .then(() => process.exit(0))
        .catch(() => process.exit(1)),
  );
try {
  dockerSql(`CREATE DATABASE "${database}";`);
  created = true;
  for (const file of readdirSync("database/migrations")
    .filter((f) => f.endsWith(".up.sql"))
    .sort())
    dockerSql(readFileSync("database/migrations/" + file, "utf8"), database);
  process.env.DATABASE_URL = isolatedUrl(database);
  delete process.env.PGHOST;
  process.env.APP_ORIGIN = "http://127.0.0.1:3115";
  process.env.NODE_ENV = "test";
  ({ pool } = await import("../apps/api/src/db.js"));
  const connected = await pool.query("SELECT current_database() AS name");
  if (connected.rows[0].name !== database)
    throw new Error("API должен использовать только временную БД Playwright");
  const { prepareDemo } =
    await import("../apps/api/src/services/demo.service.js");
  const { hashPassword } = await import("../apps/api/src/utils/crypto.js");
  const { transaction } = await import("../apps/api/src/db.js");
  const { writeEmployee } =
    await import("../apps/api/src/repositories/admin.repository.js");
  const password = "TripFlow-e2e-2026!"; // Synthetic, only for this disposable database.
  await prepareDemo(password);
  const hash = await hashPassword(password);
  await transaction((client) =>
    writeEmployee(
      client,
      {
        full_name: "Администратор Playwright",
        email: "admin@example.test",
        department_id: "1",
        employee_number: "E2E-ADMIN",
        position: "Администратор",
        phone: "",
        hire_date: "2026-11-01",
        roles: ["ADMIN"],
        is_active: true,
      },
      undefined,
      hash,
    ),
  );
  const { app } = await import("../apps/api/src/app.js");
  server = app.listen(4115, "127.0.0.1");
  await once(server, "listening");

  // A separate source copy keeps Next dev's lock, types and caches out of apps/web.
  await mkdir("output/playwright", { recursive: true });
  runtime = await mkdtemp(resolve("output/playwright/runtime-"));
  const frontend = resolve(runtime, "web");
  await cp("apps/web", frontend, {
    recursive: true,
    filter: (path) =>
      ![".next", "node_modules", "dist"].includes(basename(path)) &&
      !basename(path).startsWith(".env") &&
      !path.endsWith(".tsbuildinfo"),
  });
  await symlink(
    resolve("node_modules"),
    resolve(frontend, "node_modules"),
    "dir",
  );
  web = spawn(
    process.execPath,
    [
      resolve("node_modules/next/dist/bin/next"),
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3115",
    ],
    {
      cwd: frontend,
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        NODE_ENV: "development",
        NEXT_TELEMETRY_DISABLED: "1",
        API_ORIGIN: "http://127.0.0.1:4115",
      },
      stdio: "inherit",
    },
  );
  web.once("error", () => {
    process.exitCode = 1;
    void stop();
  });
  web.once("exit", () => {
    if (!stopping) {
      process.exitCode = 1;
      void stop();
    }
  });
  console.log(
    "Playwright: отдельная БД, API :4115, UI http://127.0.0.1:3115; рабочие данные не меняются.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
  await stop();
}
