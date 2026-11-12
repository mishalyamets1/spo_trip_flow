import dotenv from "dotenv";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { command, dockerSql } from "./lib/database-tools.mjs";
dotenv.config({ quiet: true });
const backup = process.argv[2];
if (!backup) throw new Error("Укажите backup схемы 6 до V этапа");
const database = `tripflow_test_upgrade_${Date.now()}`;
let created = false;
try {
  command(process.execPath, [
    "scripts/database.mjs",
    "restore-copy",
    backup,
    database,
  ]);
  created = true;
  assert.equal(
    dockerSql("SELECT version FROM public.schema_migrations", database).trim(),
    "6",
    "Нужна копия схемы 6",
  );
  const tables = dockerSql(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='trip_app' AND table_type='BASE TABLE' ORDER BY table_name",
    database,
  )
    .trim()
    .split("\n");
  function snapshot() {
    return dockerSql(
      tables
        .map((table) => {
          assert.match(table, /^[a-z_]+$/);
          const row = ["departments", "expense_categories"].includes(table)
            ? "(to_jsonb(t)-'is_active'-'version')"
            : "to_jsonb(t)";
          return `SELECT '${table}',count(*),md5(COALESCE(jsonb_agg(${row} ORDER BY (${row})::text)::text,'')) FROM trip_app.${table} t;`;
        })
        .join("\n"),
      database,
    ).trim();
  }
  const before = snapshot();
  const files = readdirSync("database/migrations")
    .filter((f) => f.endsWith(".up.sql") && Number(f.slice(0, 6)) > 6)
    .sort();
  for (const file of files)
    dockerSql(readFileSync("database/migrations/" + file, "utf8"), database);
  assert.equal(snapshot(), before);
  assert.equal(
    dockerSql(
      "SELECT count(*) FROM pg_indexes WHERE schemaname='trip_app' AND indexname='idx_travel_requests_employee_created'",
      database,
    ).trim(),
    "1",
  );
  for (const file of [...files].reverse())
    dockerSql(
      readFileSync(
        "database/migrations/" + file.replace(".up.sql", ".down.sql"),
        "utf8",
      ),
      database,
    );
  assert.equal(snapshot(), before);
  for (const file of files)
    dockerSql(readFileSync("database/migrations/" + file, "utf8"), database);
  assert.equal(snapshot(), before);
  const report = {
    checked_at: new Date().toISOString(),
    backup,
    tables_checked: tables.length,
    migrations: files,
    up_preserves_old_data: true,
    down_preserves_old_data: true,
    reapply_preserves_old_data: true,
    snapshot: before.split("\n"),
  };
  mkdirSync("output/stage-5", { recursive: true });
  writeFileSync(
    "output/stage-5/upgrade-check.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    `Миграции V этапа: up/down/up на копии, ${tables.length} таблиц сохранены.`,
  );
} finally {
  if (created)
    dockerSql(`DROP DATABASE "${database}" WITH (FORCE);`, "postgres");
}
