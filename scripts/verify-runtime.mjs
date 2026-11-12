import dotenv from "dotenv";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { command, dockerSql, isolatedUrl } from "./lib/database-tools.mjs";
dotenv.config({ quiet: true });
const database = `tripflow_test_runtime_${Date.now()}`;
let created = false,
  pool,
  server;
const logs = [],
  originalLog = console.log,
  originalError = console.error;
function snapshot(db) {
  const tables = dockerSql(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='trip_app' AND table_type='BASE TABLE' ORDER BY table_name",
    db,
  )
    .trim()
    .split("\n");
  return dockerSql(
    tables
      .map((table) => {
        assert.match(table, /^[a-z_]+$/);
        return `SELECT '${table}',count(*),md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'')) FROM trip_app.${table} t;`;
      })
      .join("\n"),
    db,
  ).trim();
}
function monitor(url) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/monitor.mjs", url], {
      env: { ...process.env, MONITOR_SAMPLES: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (c) => (output += c));
    child.on("close", (code) =>
      resolve({
        code,
        records: output
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line)),
      }),
    );
  });
}
try {
  const backupOutput = command(process.execPath, [
    "scripts/database.mjs",
    "backup",
  ]);
  const backup = backupOutput.trim().split(": ").slice(1).join(": ");
  assert.ok(backup.endsWith(".dump"));
  const expected = snapshot(process.env.POSTGRES_DB || "tripflow");
  const start = performance.now();
  command(process.execPath, [
    "scripts/database.mjs",
    "restore-copy",
    backup,
    database,
  ]);
  created = true;
  const restoreMs = performance.now() - start;
  assert.equal(snapshot(database), expected);
  process.env.DATABASE_URL = isolatedUrl(database);
  delete process.env.PGHOST;
  process.env.NODE_ENV = "test";
  process.env.APP_ORIGIN = "http://localhost:3000";
  ({ pool } = await import("../apps/api/src/db.js"));
  assert.equal(
    (await pool.query("SELECT current_database() AS name")).rows[0].name,
    database,
  );
  const auth = await import("../apps/api/src/repositories/auth.repository.js");
  const requests = await import("../apps/api/src/services/request.service.js");
  const first = (
    await pool.query(
      "SELECT r.id,e.user_id FROM travel_requests r JOIN employees e ON e.id=r.employee_id ORDER BY r.id LIMIT 1",
    )
  ).rows[0];
  if (first) {
    const user = await auth.findUserById(first.user_id);
    const card = await requests.getRequest(user, first.id);
    assert.ok(card.history && card.steps && card.expenses);
  }
  const capture = (...args) => {
    for (const a of args)
      if (typeof a === "string") {
        try {
          logs.push(JSON.parse(a));
        } catch {}
      }
  };
  console.log = capture;
  console.error = capture;
  const { app } = await import("../apps/api/src/app.js");
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}`;
  const healthy = await monitor(url);
  assert.equal(healthy.code, 0);
  // Disable only the isolated copy for the non-superuser application role.
  dockerSql(
    `ALTER DATABASE "${database}" CONNECTION LIMIT 0; SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${database}' AND usename='trip_app_rw';`,
    "postgres",
  );
  const failure = await monitor(url);
  assert.equal(failure.code, 1);
  const checks = failure.records[0].checks;
  assert.equal(checks.find((c) => c.name === "live").status, 200);
  assert.equal(checks.find((c) => c.name === "ready").status, 503);
  dockerSql(`ALTER DATABASE "${database}" CONNECTION LIMIT -1;`, "postgres");
  const recovered = await monitor(url);
  assert.equal(recovered.code, 0);
  const failedReady = checks.find((c) => c.name === "ready");
  assert.ok(
    logs.some(
      (l) =>
        l.event === "request_error" && l.requestId === failedReady.requestId,
    ),
  );
  const report = {
    checked_at: new Date().toISOString(),
    database,
    backup,
    restore_ms: +restoreMs.toFixed(2),
    all_tables_match: true,
    restored_card_readable: Boolean(first),
    healthy,
    failure,
    recovered,
    logs,
    scope:
      "Отказ подключения только к временной восстановленной БД, рабочие контейнеры не останавливались",
  };
  mkdirSync("output/stage-5", { recursive: true });
  writeFileSync(
    "output/stage-5/runtime-check.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  originalLog(
    JSON.stringify({
      restore_ms: report.restore_ms,
      matched_tables: expected.split("\n").length,
      failure: "live=200 ready=503",
      recovered: true,
      requestId: failedReady.requestId,
    }),
  );
} finally {
  console.log = originalLog;
  console.error = originalError;
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
  if (created)
    dockerSql(`DROP DATABASE "${database}" WITH (FORCE);`, "postgres");
}
