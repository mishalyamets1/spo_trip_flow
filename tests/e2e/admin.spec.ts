import { test, expect } from "@playwright/test";
import { createDraft, login, password, unique } from "./helpers";
test("администратор создаёт, изменяет и удаляет сотрудника вместе с его заявкой", async ({
  page,
  browser,
}) => {
  await login(page, "admin@example.test");
  await page.getByRole("link", { name: "+ Новый сотрудник" }).click();
  const number = unique("UI");
  const email = `${number.toLowerCase()}@example.test`;
  const name = `Сотрудник Playwright ${number}`;
  await page.getByLabel("ФИО", { exact: true }).fill(name);
  await page.getByLabel("Электронная почта").fill(email);
  await page.getByLabel("Табельный номер", { exact: true }).fill(number);
  await page.getByLabel("Должность", { exact: true }).fill("UI тестировщик");
  await page.getByLabel("Начальный пароль").fill(password);
  await page.getByRole("button", { name: "Сохранить сотрудника" }).click();
  await expect(page).toHaveURL(/\/admin\/employees\/\d+$/);
  const employeePath = new URL(page.url()).pathname;
  await page
    .getByLabel("Должность", { exact: true })
    .fill("Старший UI тестировщик");
  await page.getByRole("button", { name: "Сохранить сотрудника" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Данные сотрудника сохранены" }),
  ).toHaveText("Данные сотрудника сохранены");
  await page.reload();
  await expect(page.getByLabel("Должность", { exact: true })).toHaveValue(
    "Старший UI тестировщик",
  );
  const employee = await browser.newPage();
  let draftPath = "";
  try {
    await login(employee, email);
    draftPath = (await createDraft(employee)).path;
  } finally {
    await employee.close();
  }
  await page.goto(employeePath);
  await expect(
    page.getByRole("link", { name: "Заявки сотрудника (1)" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Удалить сотрудника и его заявки",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Удалить сотрудника и заявки (1)",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByLabel("Причина удаления")
    .fill("Удаление одноразового пользователя UI");
  await page
    .getByLabel(/Для подтверждения введите табельный номер/)
    .fill(number);
  await page
    .getByRole("button", {
      name: "Удалить сотрудника и заявки (1)",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/admin\/employees$/);
  await page.getByLabel("Поиск", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Найти", exact: true }).click();
  await expect(
    page.getByText("Сотрудники не найдены. Измените условия поиска."),
  ).toBeVisible();
  await page.goto(draftPath.replace("/requests/", "/admin/requests/"));
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    /не найден/i,
  );
});
test("справочники: создание, изменение, отключение, защита ссылок и журнал", async ({
  page,
  browser,
}) => {
  await login(page, "admin@example.test");
  await page.getByRole("link", { name: "Справочники", exact: true }).click();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Отдел разработки" })
      .getByRole("button", { name: "Удалить", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "+ Добавить", exact: true }).click();
  const department = unique("Подразделение UI");
  await page.getByLabel("Название", { exact: true }).fill(department);
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: department });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Редактировать", exact: true }).click();
  await page
    .getByLabel("Название", { exact: true })
    .fill(department + " изменено");
  await page.getByLabel("Активно", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(row).toContainText("Отключено");
  await page.reload();
  await expect(row).toContainText(department + " изменено");
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(row).toHaveCount(0);
  await page
    .getByRole("button", { name: "Категории расходов", exact: true })
    .click();
  const category = unique("Категория UI");
  await page.getByRole("button", { name: "+ Добавить", exact: true }).click();
  await page.getByLabel("Название", { exact: true }).fill(category);
  await page.getByLabel("Код категории").fill("UI_" + Date.now());
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  const categoryRow = page.getByRole("row").filter({ hasText: category });
  await categoryRow
    .getByRole("button", { name: "Редактировать", exact: true })
    .click();
  await page.getByLabel("Активно", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(categoryRow).toContainText("Отключено");
  const employee = await browser.newPage();
  try {
    await login(employee);
    await employee.goto("/requests/new");
    await expect(
      employee.getByRole("combobox", { name: "Категория", exact: true }),
    ).toBeVisible();
    await expect(
      employee
        .getByRole("combobox", { name: "Категория", exact: true })
        .getByRole("option", { name: category, exact: true }),
    ).toHaveCount(0);
  } finally {
    await employee.close();
  }
  await page
    .getByRole("link", { name: "Журнал действий", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "Изменение справочника" }).first(),
  ).toBeVisible();
});
