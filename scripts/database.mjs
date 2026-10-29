import dotenv from "dotenv";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
dotenv.config({ quiet: true });

function run(args, options = {}) {
  const result = spawnSync("docker", args, {
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 256 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    // Never forward raw database/CLI errors, which may include credentials or SQL.
    throw new Error(
      `Операция Docker не выполнена (код ${result.status ?? "не запущена"}). Проверьте Docker и настройки окружения.`,
    );
  }
  return result.stdout;
}
function sql(text, database) {
  const args = ["compose", "exec", "-T"];
  if (database) args.push("-e", `TARGET_DATABASE=${database}`);
  args.push(
    "db",
    "sh",
    "-c",
    'exec psql -U "$POSTGRES_USER" -d "${TARGET_DATABASE:-$POSTGRES_DB}" -v ON_ERROR_STOP=1',
  );
  return run(args, { input: text });
}
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const identifier = (value) => `"${String(value).replaceAll('"', '""')}"`;
const command = process.argv[2];
try {
  if (["migrate", "version", "down"].includes(command)) {
    const url = new URL("postgresql://db:5432");
    url.username = process.env.POSTGRES_USER || "trip_app_owner";
    url.password = process.env.POSTGRES_PASSWORD || "";
    url.pathname = `/${process.env.POSTGRES_DB || "tripflow"}`;
    url.searchParams.set("sslmode", "disable");
    const args = [
      "run",
      "--rm",
      "--network",
      "tripflow_default",
      "-v",
      `${resolve("database/migrations")}:/migrations:ro`,
      "-e",
      "TRIPFLOW_MIGRATION_DSN",
      "--entrypoint",
      "/bin/sh",
      "migrate/migrate:v4.18.1",
      "-c",
      `exec migrate -path=/migrations -database "$TRIPFLOW_MIGRATION_DSN" ${command === "migrate" ? "up" : command === "down" ? "down 1" : "version"}`,
    ];
    run(args, { env: { ...process.env, TRIPFLOW_MIGRATION_DSN: url.href } });
    if (command === "version") {
      process.stdout.write(
        sql("SELECT version, dirty FROM public.schema_migrations;"),
      );
    } else console.log("Миграции применены.");
  } else if (command === "provision") {
    if (!process.env.TRIP_APP_RW_PASSWORD)
      throw new Error("Задайте TRIP_APP_RW_PASSWORD");
    sql(
      `ALTER ROLE trip_app_rw PASSWORD ${quote(process.env.TRIP_APP_RW_PASSWORD)};`,
    );
    console.log("Пароль роли приложения настроен из окружения.");
  } else if (command === "check") {
    process.stdout.write(
      sql(readFileSync("database/queries/check_queries.sql")),
    );
    process.stdout.write(
      sql(readFileSync("database/queries/check_constraints.sql")),
    );
  } else if (command === "backup") {
    mkdirSync("backups", { recursive: true });
    const path = resolve(
      "backups",
      `tripflow-${new Date().toISOString().replaceAll(":", "-")}.dump`,
    );
    const dump = run([
      "compose",
      "exec",
      "-T",
      "db",
      "sh",
      "-c",
      'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-acl',
    ]);
    writeFileSync(path, dump, { mode: 0o600 });
    console.log(`Резервная копия: ${path}`);
  } else if (command === "restore-copy") {
    const path = process.argv[3];
    const database = process.argv[4] || "tripflow_restore";
    if (!path || !/^tripflow_(restore|test)_[a-z0-9_]+$/.test(database)) {
      throw new Error(
        "Использование: restore-copy <файл.dump> <tripflow_restore_имя> (только новая БД)",
      );
    }
    // CREATE DATABASE fails if this name exists: never overwrite a database.
    sql(`CREATE DATABASE ${identifier(database)};`);
    run(
      [
        "compose",
        "exec",
        "-T",
        "-e",
        `TARGET_DATABASE=${database}`,
        "db",
        "sh",
        "-c",
        'exec pg_restore -U "$POSTGRES_USER" -d "$TARGET_DATABASE" --no-owner --no-acl --exit-on-error',
      ],
      { input: readFileSync(path) },
    );
    sql(
      `GRANT USAGE ON SCHEMA trip_app TO trip_app_rw;
      GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA trip_app TO trip_app_rw;
      GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA trip_app TO trip_app_rw;`,
      database,
    );
    process.stdout.write(
      sql(
        "SELECT count(*) AS requests FROM trip_app.travel_requests; SELECT count(*) AS history FROM trip_app.request_status_history;",
        database,
      ),
    );
    console.log(`Копия восстановлена в ${database}. Рабочая БД не изменена.`);
  } else
    throw new Error(
      "Команды: migrate, version, down, provision, check, backup, restore-copy",
    );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
