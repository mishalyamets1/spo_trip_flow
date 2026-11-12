import { pool, transaction } from "./db.js";
import { hashPassword } from "./utils/crypto.js";
import { createEmployeeSchema } from "./validators/admin.validation.js";
import * as repo from "./repositories/admin.repository.js";
try {
  const password = process.env.ADMIN_PASSWORD || process.env.DEMO_PASSWORD;
  const email = process.env.ADMIN_EMAIL || "admin@example.test";
  const hash =
    password && password.length >= 12 ? await hashPassword(password) : null;
  await transaction(async (client) => {
    await repo.lockAdministration(client);
    if ((await repo.activeAdminCount(client, "0")) > 0) {
      console.log(
        "Активный администратор уже существует. Учётные записи и пароли не изменены.",
      );
      return;
    }
    if (!hash)
      throw new Error(
        "Задайте ADMIN_PASSWORD (или DEMO_PASSWORD для учебного стенда) длиной от 12 символов",
      );
    const department = (
      await client.query("SELECT id FROM departments ORDER BY id LIMIT 1")
    ).rows[0];
    if (!department) throw new Error("Сначала создайте подразделение");
    const input = createEmployeeSchema.parse({
      email,
      password,
      full_name: process.env.ADMIN_NAME || "Администратор TripFlow",
      employee_number: "SYS-ADMIN",
      position: "Администратор",
      department_id: department.id,
      phone: "",
      hire_date: new Date().toISOString().slice(0, 10),
      roles: ["ADMIN"],
      is_active: true,
    });
    const id = await repo.writeEmployee(client, input, undefined, hash);
    console.log(
      `Администратор создан: ${email}. Пароль взят из окружения; существующие аккаунты не менялись.`,
    );
    console.log(`Идентификатор сотрудника: ${id}`);
  });
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Не удалось создать администратора",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
