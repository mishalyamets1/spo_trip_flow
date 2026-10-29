import { transaction } from "../db.js";
export async function seedDemoAccounts(encoded: string) {
  await transaction(async (client) => {
    const department = (
      await client.query(`INSERT INTO departments(name) VALUES ('Отдел разработки')
      ON CONFLICT(name) DO UPDATE SET name=excluded.name RETURNING id`)
    ).rows[0].id;
    const accounts = [
      {
        email: "maxim@example.test",
        name: "Максим Геннадьевич Шлапаков",
        number: "EMP-001",
        approver: false,
      },
      {
        email: "manager@example.test",
        name: "Владимир Алексеевич Беломытцев",
        number: "EMP-002",
        approver: true,
      },
      {
        email: "finance@example.test",
        name: "Финансовый специалист",
        number: "DEMO-FINANCE",
        approver: true,
      },
    ];
    const employees: string[] = [];
    for (const account of accounts) {
      const user = (
        await client.query(
          `INSERT INTO users(email,password_hash) VALUES ($1,$2)
        ON CONFLICT(email) DO UPDATE SET password_hash=CASE WHEN users.password_hash='TEST_HASH_NOT_FOR_AUTH'
          THEN excluded.password_hash ELSE users.password_hash END RETURNING id`,
          [account.email, encoded],
        )
      ).rows[0];
      const employee = (
        await client.query(
          `INSERT INTO employees(user_id,department_id,employee_number,full_name,position,hire_date)
        VALUES ($1,$2,$3,$4,'Учебный пользователь',CURRENT_DATE)
        ON CONFLICT(user_id) DO UPDATE SET user_id=excluded.user_id RETURNING id`,
          [user.id, department, account.number, account.name],
        )
      ).rows[0];
      employees.push(employee.id);
      await client.query(
        `INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='EMPLOYEE'
        OR ($2 AND code='APPROVER') ON CONFLICT DO NOTHING`,
        [user.id, account.approver],
      );
    }
    const existing = await client.query(
      "SELECT id FROM approval_routes WHERE department_id=$1 AND is_active",
      [department],
    );
    if (!existing.rowCount) {
      const route = (
        await client.query(
          `INSERT INTO approval_routes(department_id,name) VALUES ($1,'Руководитель → финансы') RETURNING id`,
          [department],
        )
      ).rows[0];
      await client.query(
        `INSERT INTO approval_route_steps(route_id,step_order,approver_employee_id) VALUES ($1,1,$2),($1,2,$3)`,
        [route.id, employees[1], employees[2]],
      );
    }
  });
}
