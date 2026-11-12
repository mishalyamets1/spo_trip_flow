import { spawnSync } from "node:child_process";
export function command(binary, args, options = {}) {
  const result = spawnSync(binary, args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0)
    throw new Error(
      `${binary}: операция не выполнена (код ${result.status ?? "не запущена"})`,
    );
  return result.stdout;
}
export function dockerSql(
  sql,
  database = process.env.POSTGRES_DB || "tripflow",
) {
  return command(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "-e",
      `TARGET_DATABASE=${database}`,
      "db",
      "sh",
      "-c",
      'exec psql -X -U "$POSTGRES_USER" -d "$TARGET_DATABASE" -v ON_ERROR_STOP=1 -At',
    ],
    { input: sql },
  );
}
export function isolatedUrl(database) {
  if (!/^tripflow_test_[a-z0-9_]+$/.test(database))
    throw new Error("Разрешена только отдельная тестовая БД");
  const url = new URL("postgresql://127.0.0.1");
  url.port = process.env.POSTGRES_PORT || "5432";
  url.username = "trip_app_rw";
  url.password = process.env.TRIP_APP_RW_PASSWORD || "";
  url.pathname = "/" + database;
  return url.href;
}
