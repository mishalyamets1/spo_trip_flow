import dotenv from "dotenv";
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import os from "node:os";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { dockerSql, isolatedUrl } from "./lib/database-tools.mjs";
dotenv.config({ quiet: true });
const label = process.argv.includes("--baseline") ? "before" : "after";
const database = `tripflow_test_benchmark_${Date.now()}`;
let created = false,
  pool,
  server;
const originalLog = console.log;
const httpLogs = [];
function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return +sorted[Math.ceil(sorted.length * p) - 1].toFixed(3);
}
function statistics(records) {
  return {
    requests: records.length,
    p50_ms: percentile(
      records.map((r) => r.ms),
      0.5,
    ),
    p95_ms: percentile(
      records.map((r) => r.ms),
      0.95,
    ),
    errors: records.filter((r) => !r.ok).length,
  };
}
try {
  dockerSql(`CREATE DATABASE "${database}";`);
  created = true;
  for (const file of readdirSync("database/migrations")
    .filter((f) => f.endsWith(".up.sql"))
    .sort()) {
    if (label === "before" && file.startsWith("000008_")) continue;
    dockerSql(readFileSync("database/migrations/" + file, "utf8"), database);
  }
  process.env.DATABASE_URL = isolatedUrl(database);
  delete process.env.PGHOST;
  process.env.NODE_ENV = "test";
  process.env.APP_ORIGIN = "http://localhost:3000";
  ({ pool } = await import("../apps/api/src/db.js"));
  assert.equal(
    (await pool.query("SELECT current_database() AS name")).rows[0].name,
    database,
  );
  const { hashPassword } = await import("../apps/api/src/utils/crypto.js");
  const hash = await hashPassword("Synthetic-benchmark-password-2026!");
  await pool.query("UPDATE users SET password_hash=$1", [hash]);
  await pool.query(
    `INSERT INTO users(email,password_hash) SELECT 'bench-'||g||'@example.test',$1 FROM generate_series(1,49) g`,
    [hash],
  );
  await pool.query(`INSERT INTO employees(user_id,department_id,employee_number,full_name,position,hire_date)
 SELECT id,1,'BENCH-'||id,'Учебный пользователь '||id,'Специалист',CURRENT_DATE FROM users WHERE email LIKE 'bench-%';
 INSERT INTO user_roles(user_id,role_id) SELECT u.id,r.id FROM users u CROSS JOIN roles r WHERE u.email LIKE 'bench-%' AND r.code='EMPLOYEE';
 INSERT INTO trips(destination_country,destination_city,purpose,start_date,end_date,transport_type)
 SELECT 'Россия','Город '||g,'Синтетический нагрузочный набор',DATE '2026-12-01',DATE '2026-12-02','RAIL' FROM generate_series(1,9999) g;
 WITH authors AS (SELECT array_agg(id ORDER BY id) AS ids FROM employees WHERE employee_number LIKE 'BENCH-%' OR id=1)
 INSERT INTO travel_requests(number,employee_id,trip_id,estimated_total,created_at)
 SELECT 'LOAD-'||t.id,authors.ids[1+((t.id-2)%50)::int],t.id,100,now()-t.id*interval '1 minute' FROM trips t CROSS JOIN authors WHERE t.id>1;
 INSERT INTO expense_estimates(request_id,category_id,amount) SELECT id,1,100 FROM travel_requests WHERE number LIKE 'LOAD-%';
 `);
  dockerSql("ANALYZE;", database);
  const rows = Number(
    (await pool.query("SELECT count(*) FROM travel_requests")).rows[0].count,
  );
  assert.equal(rows, 10000);
  const actors = (
    await pool.query(
      `SELECT e.user_id,e.id AS employee_id,min(r.id)::text AS request_id FROM employees e JOIN travel_requests r ON r.employee_id=e.id WHERE e.id=1 OR e.employee_number LIKE 'BENCH-%' GROUP BY e.id,e.user_id ORDER BY e.id`,
    )
  ).rows;
  assert.equal(actors.length, 50);
  const auth = await import("../apps/api/src/services/auth.service.js");
  for (const actor of actors) {
    const email = (
      await pool.query("SELECT email FROM users WHERE id=$1", [actor.user_id])
    ).rows[0].email;
    actor.cookie =
      "tripflow_session=" +
      (await auth.login(email, "Synthetic-benchmark-password-2026!")).token;
  }
  const { fields, joins } =
    await import("../apps/api/src/repositories/request.repository.js");
  const explain = [];
  let plan;
  for (let i = 0; i < 12; i++) {
    plan = (
      await pool.query(
        `EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) SELECT ${fields} ${joins} WHERE r.employee_id=$1 ORDER BY r.created_at DESC,r.id DESC LIMIT 20`,
        [actors[0].employee_id],
      )
    ).rows[0]["QUERY PLAN"][0];
    if (i >= 2) explain.push(plan["Execution Time"]);
  }
  const { app } = await import("../apps/api/src/app.js");
  console.log = (...args) => {
    if (typeof args[0] === "string" && args[0].startsWith('{"requestId"')) {
      if (httpLogs.length < 3) httpLogs.push(JSON.parse(args[0]));
    } else originalLog(...args);
  };
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(actor, type) {
    const start = performance.now();
    let ok = false,
      status = 0;
    try {
      const response = await fetch(
        base +
          (type === "list"
            ? "/requests?page=1"
            : "/requests/" + actor.request_id),
        { headers: { Cookie: actor.cookie } },
      );
      status = response.status;
      const body = await response.json();
      ok =
        response.ok &&
        (type === "list"
          ? Array.isArray(body.items) &&
            body.items.every((r) => r.employee_id === actor.employee_id)
          : body.id === actor.request_id);
    } catch {}
    return { ms: performance.now() - start, ok, status, type };
  }
  await Promise.all(
    actors.map(async (actor) => {
      await request(actor, "list");
      await request(actor, "card");
    }),
  );
  const rounds = [];
  for (let round = 0; round < 3; round++) {
    const records = [];
    const start = performance.now();
    await Promise.all(
      actors.map(async (actor) => {
        for (let i = 0; i < 20; i++)
          records.push(await request(actor, i % 2 ? "card" : "list"));
      }),
    );
    rounds.push({
      round: round + 1,
      ...statistics(records),
      duration_ms: +(performance.now() - start).toFixed(2),
      list: statistics(records.filter((r) => r.type === "list")),
      card: statistics(records.filter((r) => r.type === "card")),
    });
  }
  const report = {
    label,
    checked_at: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      cpu: os.cpus()[0]?.model,
      host_memory_gb: +(os.totalmem() / 2 ** 30).toFixed(2),
      database: "PostgreSQL 16 Docker",
      api: "Node.js вне Docker, прямой HTTP API на loopback",
      connection_pool: 10,
    },
    dataset: {
      requests: rows,
      distinct_users: 50,
      concurrent_workers: 50,
      requests_per_round: 1000,
      rounds: 3,
      warmup: 100,
    },
    explain: {
      mean_execution_ms: +(
        explain.reduce((a, b) => a + b, 0) / explain.length
      ).toFixed(4),
      plan,
    },
    rounds,
    nfr01_pass: rounds.every(
      (r) => r.list.p95_ms <= 2000 && r.card.p95_ms <= 2000 && r.errors === 0,
    ),
    scope:
      "Синтетическая чтение-нагрузка, 50 активных пользователей; вход исключён из измерения. Без браузера, внешней сети и конкурирующих записей.",
    sample_logs: httpLogs,
  };
  mkdirSync("output/stage-5", { recursive: true });
  writeFileSync(
    `output/stage-5/benchmark-${label}.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  if (!report.nfr01_pass) process.exitCode = 1;
  originalLog(
    JSON.stringify({
      label,
      rows,
      rounds: rounds.map((r) => ({
        round: r.round,
        list_p95: r.list.p95_ms,
        card_p95: r.card.p95_ms,
        errors: r.errors,
      })),
      sql_mean_ms: report.explain.mean_execution_ms,
      nfr01_pass: report.nfr01_pass,
    }),
  );
} finally {
  console.log = originalLog;
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
  if (created)
    dockerSql(`DROP DATABASE "${database}" WITH (FORCE);`, "postgres");
}
