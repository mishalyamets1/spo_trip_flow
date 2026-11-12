import { test, expect } from "@playwright/test";
import {
  createDraft,
  listReady,
  login,
  openQueueItem,
  statusBadge,
  submit,
  unique,
  history,
} from "./helpers";
test("валидация формы, создание, точная смета и редактирование черновика", async ({
  page,
}) => {
  await login(page);
  await page.goto("/requests/new");
  await page.getByRole("button", { name: "Сохранить черновик" }).click();
  await expect(page).toHaveURL(/\/requests\/new$/);
  expect(
    await page
      .getByLabel("Город", { exact: true })
      .evaluate((input: HTMLInputElement) => input.validity.valueMissing),
  ).toBe(true);
  const draft = await createDraft(page);
  await expect(statusBadge(page)).toHaveText("Черновик");
  await page.getByRole("link", { name: "Редактировать", exact: true }).click();
  const city = unique("Исправленная UI");
  await page.getByLabel("Город", { exact: true }).fill(city);
  await page.getByRole("button", { name: "+ Добавить расход" }).click();
  await page.getByLabel("Сумма", { exact: true }).nth(1).fill("200.20");
  await page.getByRole("button", { name: "Сохранить черновик" }).click();
  await expect(page).toHaveURL(new RegExp(draft.path + "$"));
  await page.reload();
  await expect(
    page.getByRole("heading", { name: `Командировка в ${city}` }),
  ).toBeVisible();
  await expect(page.locator(".expense-total")).toContainText("300,30");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Удалить черновик" }).click();
  await expect(page).toHaveURL(/\/requests$/);
  await listReady(page);
  await expect(page.getByRole("link", { name: city, exact: true })).toHaveCount(
    0,
  );
});
test("сотрудник → менеджер → финансист, история и обработанные решения", async ({
  page,
  browser,
}) => {
  await login(page);
  const draft = await createDraft(page);
  await submit(page);
  const manager = await browser.newPage();
  const finance = await browser.newPage();
  try {
    await login(finance, "finance@example.test");
    await finance.goto("/approvals");
    await listReady(finance);
    await expect(
      finance.getByRole("link", { name: draft.city, exact: true }),
    ).toHaveCount(0);
    await login(manager, "manager@example.test");
    await openQueueItem(manager, draft.city);
    await manager
      .getByLabel("Комментарий", { exact: true })
      .fill("Согласовано руководителем UI");
    await manager
      .getByRole("button", { name: "Согласовать", exact: true })
      .click();
    await expect(statusBadge(manager)).toHaveText("На согласовании");
    await manager
      .getByRole("link", { name: "← К очереди согласования" })
      .click();
    await manager.getByRole("link", { name: "Обработанные мной" }).click();
    await expect(
      manager.getByRole("row").filter({ hasText: draft.city }),
    ).toContainText("Согласовано руководителем UI");
    await openQueueItem(finance, draft.city);
    await finance
      .getByLabel("Комментарий", { exact: true })
      .fill("Бюджет подтверждён UI");
    await finance
      .getByRole("button", { name: "Согласовать", exact: true })
      .click();
    await expect(statusBadge(finance)).toHaveText("Согласована");
    await page.goto(draft.path);
    await expect(statusBadge(page)).toHaveText("Согласована");
    await expect(history(page).locator("li")).toHaveCount(4);
    await expect(history(page)).toContainText("Согласовано руководителем UI");
    await expect(history(page)).toContainText("Бюджет подтверждён UI");
  } finally {
    await manager.close();
    await finance.close();
  }
});
test("отклонение требует причину и закрывает последующий этап", async ({
  page,
  browser,
}) => {
  await login(page);
  const draft = await createDraft(page);
  await submit(page);
  const manager = await browser.newPage();
  try {
    await login(manager, "manager@example.test");
    await openQueueItem(manager, draft.city);
    await expect(
      manager.getByRole("button", { name: "Отклонить", exact: true }),
    ).toBeDisabled();
    await manager
      .getByLabel("Комментарий", { exact: true })
      .fill("Нужно уточнить бюджет UI");
    await manager
      .getByRole("button", { name: "Отклонить", exact: true })
      .click();
    await expect(statusBadge(manager)).toHaveText("Отклонена");
    await page.goto(draft.path);
    await expect(statusBadge(page)).toHaveText("Отклонена");
    await expect(history(page)).toContainText("Нужно уточнить бюджет UI");
    await expect(page.getByText("Пропущен", { exact: true })).toBeVisible();
  } finally {
    await manager.close();
  }
});
test("автор отменяет заявку до первого решения, она исчезает из очереди", async ({
  page,
  browser,
}) => {
  await login(page);
  const draft = await createDraft(page);
  await submit(page);
  await page
    .getByRole("button", { name: "Отменить заявку", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Подтвердить отмену" }),
  ).toBeDisabled();
  await page.getByLabel("Причина отмены").fill("Встреча перенесена UI");
  await page.getByRole("button", { name: "Подтвердить отмену" }).click();
  await expect(statusBadge(page)).toHaveText("Отменена");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Заявка отменена", exact: true }),
  ).toBeVisible();
  await expect(history(page)).toContainText("Встреча перенесена UI");
  const manager = await browser.newPage();
  try {
    await login(manager, "manager@example.test");
    await manager.goto("/approvals");
    await listReady(manager);
    await expect(
      manager.getByRole("link", { name: draft.city, exact: true }),
    ).toHaveCount(0);
  } finally {
    await manager.close();
  }
});
