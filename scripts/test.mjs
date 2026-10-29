import dotenv from "dotenv";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
dotenv.config({ quiet: true });
const name = `tripflow_test_${Date.now()}`;
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0)
    throw new Error(`Не удалось выполнить ${command} (код ${result.status})`);
}
function sql(input, database = process.env.POSTGRES_DB || "tripflow") {
  run(
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
      'exec psql -U "$POSTGRES_USER" -d "$TARGET_DATABASE" -v ON_ERROR_STOP=1',
    ],
    {
      input: `SET search_path TO trip_app,public;\n${input}`,
      stdio: ["pipe", "inherit", "inherit"],
    },
  );
}
let created = false;
try {
  sql(`CREATE DATABASE "${name}";`);
  created = true;
  for (const file of readdirSync("database/migrations")
    .filter((f) => f.endsWith(".up.sql"))
    .sort()) {
    sql(readFileSync(`database/migrations/${file}`), name);
  }
  sql(
    `INSERT INTO users(email,password_hash) VALUES ('finance@example.test','TEST_HASH_NOT_FOR_AUTH');
    INSERT INTO employees(user_id,department_id,employee_number,full_name,position,hire_date)
      SELECT id,1,'TEST-FIN','Финансовый специалист','Финансы',CURRENT_DATE FROM users WHERE email='finance@example.test';
    INSERT INTO user_roles(user_id,role_id) SELECT u.id,r.id FROM users u CROSS JOIN roles r
      WHERE u.email='finance@example.test' AND r.code IN ('EMPLOYEE','APPROVER');
    INSERT INTO approval_routes(department_id,name) VALUES (1,'Тестовый маршрут');
    INSERT INTO approval_route_steps(route_id,step_order,approver_employee_id) VALUES (1,1,2),(1,2,3);`,
    name,
  );
  sql(readFileSync("database/queries/check_constraints.sql"), name);
  // The test URL is passed via the process environment, never printed.
  const url = new URL("postgresql://127.0.0.1");
  url.port = process.env.POSTGRES_PORT || "5432";
  url.username = "trip_app_rw";
  url.password = process.env.TRIP_APP_RW_PASSWORD || "";
  url.pathname = `/${name}`;
  run(
    "npm",
    process.argv.includes("--coverage")
      ? ["run", "test:coverage", "-w", "@tripflow/api"]
      : ["test"],
    {
      env: { ...process.env, TEST_DATABASE_URL: url.href },
    },
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (created) sql(`DROP DATABASE "${name}" WITH (FORCE);`);
}
