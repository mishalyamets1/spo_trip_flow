import { hashPassword } from "../utils/crypto.js";
import { seedDemoAccounts } from "../repositories/demo.repository.js";
export async function prepareDemo(password: string | undefined) {
  if (!password || password.length < 12)
    throw new Error("Задайте DEMO_PASSWORD длиной от 12 символов");
  await seedDemoAccounts(await hashPassword(password));
  console.log(
    "Учебные пользователи и маршрут готовы. Существующие реальные хэши паролей не изменены.",
  );
  console.log(
    "maxim@example.test / manager@example.test / finance@example.test",
  );
}
