import { test, expect } from "@playwright/test";
import { login, password } from "./helpers";
test("защищённая страница, неверный пароль, вход и выход", async ({ page }) => {
  await page.goto("/requests/new");
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel("Электронная почта").fill("maxim@example.test");
  await page.getByLabel("Пароль", { exact: true }).fill("Wrong-password-2026!");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    /пароль/i,
  );
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Новая заявка", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Выйти из системы" }).click();
  await expect(
    page.getByRole("heading", { name: "Вход в TripFlow" }),
  ).toBeVisible();
  await page.goto("/requests/new");
  await expect(page).toHaveURL(/\/login\?next=/);
});
test("обычный сотрудник не получает административный интерфейс", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/employees");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Раздел доступен только администратору",
  );
  await expect(
    page.getByRole("link", { name: /Добавить сотрудника/ }),
  ).toHaveCount(0);
});
