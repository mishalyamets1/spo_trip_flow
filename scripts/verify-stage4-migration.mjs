import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const backup = process.argv[2];
if (!backup) throw new Error("Укажите резервную копию БД версии 4");
const database = `tripflow_test_migration_${Date.now()}`;
let created = false;
function command(binary, args, input) {
  const result = spawnSync(binary, args, {
    input,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0)
    throw new Error(
      `Проверка миграции: ${binary} завершился с кодом ${result.status}`,
    );
  return result.stdout;
}
function sql(text, target = database) {
  return command(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "-e",
      `TARGET_DATABASE=${target}`,
      "db",
      "sh",
      "-c",
      'exec psql -X -U "$POSTGRES_USER" -d "$TARGET_DATABASE" -v ON_ERROR_STOP=1 -At',
    ],
    text,
  );
}
const up = readFileSync(
  "database/migrations/000005_request_cancellation.up.sql",
  "utf8",
);
const down = readFileSync(
  "database/migrations/000005_request_cancellation.down.sql",
  "utf8",
);
try {
  const result = spawnSync(
    process.execPath,
    ["scripts/database.mjs", "restore-copy", backup, database],
    { encoding: "utf8" },
  );
  if (result.status !== 0)
    throw new Error("Не удалось восстановить проверочную копию");
  created = true;
  assert.equal(
    sql(
      "SELECT count(*) FROM information_schema.columns WHERE table_schema='trip_app' AND table_name='travel_requests' AND column_name='canceled_at';",
    ).trim(),
    "0",
    "Нужна копия до миграции 000005",
  );
  const tables = sql(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='trip_app' AND table_type='BASE TABLE' ORDER BY table_name;",
  )
    .trim()
    .split("\n");
  function snapshot() {
    return sql(
      tables
        .map((table) => {
          assert.match(table, /^[a-z_]+$/);
          const row =
            table === "travel_requests"
              ? "(to_jsonb(t)-'canceled_at'-'cancellation_reason')"
              : "to_jsonb(t)";
          return `SELECT '${table}',count(*),md5(COALESCE(jsonb_agg(${row} ORDER BY (${row})::text)::text,'')) FROM trip_app.${table} t;`;
        })
        .join("\n"),
    ).trim();
  }
  const before = snapshot();
  sql(up);
  assert.equal(snapshot(), before, "Старые данные изменились после up");
  assert.equal(
    sql(
      "SELECT count(*) FROM information_schema.columns WHERE table_schema='trip_app' AND table_name='travel_requests' AND column_name IN ('canceled_at','cancellation_reason');",
    ).trim(),
    "2",
  );
  sql(`DO $$ BEGIN
    BEGIN
      UPDATE trip_app.travel_requests SET cancellation_reason='Недопустимое поле' WHERE status <> 'CANCELED';
      IF FOUND THEN RAISE EXCEPTION 'CHECK не сработал'; END IF;
    EXCEPTION WHEN check_violation THEN NULL; END;
  END $$;`);
  sql(down);
  assert.equal(snapshot(), before, "Старые данные изменились после down");
  sql(`DO $$ DECLARE trip_id bigint; request_id bigint; employee_id bigint; i integer;
  BEGIN
    SELECT min(id) INTO employee_id FROM trip_app.employees;
    FOR i IN 1..2 LOOP
      INSERT INTO trip_app.trips(destination_country,destination_city,purpose,start_date,end_date,transport_type)
        VALUES ('Россия','Тест миграции','Синтетическая проверка старой отмены',CURRENT_DATE,CURRENT_DATE,'RAIL') RETURNING id INTO trip_id;
      INSERT INTO trip_app.travel_requests(number,employee_id,trip_id,status,submitted_at)
        VALUES ('MIGRATION-LEGACY-' || i,employee_id,trip_id,'CANCELED',CURRENT_TIMESTAMP) RETURNING id INTO request_id;
      IF i=1 THEN
        INSERT INTO trip_app.request_status_history(request_id,old_status,new_status,changed_by_employee_id,comment)
          VALUES (request_id,'SUBMITTED','CANCELED',employee_id,'Историческая причина');
      END IF;
    END LOOP;
  END $$;`);
  sql(up);
  assert.equal(
    sql(
      "SELECT cancellation_reason FROM trip_app.travel_requests WHERE number='MIGRATION-LEGACY-1';",
    ).trim(),
    "Историческая причина",
  );
  assert.equal(
    sql(
      "SELECT cancellation_reason FROM trip_app.travel_requests WHERE number='MIGRATION-LEGACY-2';",
    ).trim(),
    "Причина отмены не сохранялась в предыдущей версии",
  );
  const report = {
    checkedAtUTC: new Date().toISOString(),
    backup,
    tablesChecked: tables.length,
    preservedBeforeAndAfter: true,
    downPreservesOldData: true,
    legacyHistoryBackfill: true,
    legacyUnknownReasonMarked: true,
    consistencyConstraint: true,
    snapshot: before.split("\n"),
  };
  mkdirSync("output/stage-4", { recursive: true });
  writeFileSync(
    "output/stage-4/migration-check.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    `Миграция 000005: ${tables.length} таблиц сохранены; up/down, CHECK и обе старые отмены проверены.`,
  );
} finally {
  if (created) sql(`DROP DATABASE "${database}" WITH (FORCE);`, "postgres");
}
