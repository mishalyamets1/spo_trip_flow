import { expect, type Page } from "@playwright/test";
export const password = "TripFlow-e2e-2026!";
export const unique = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
export async function login(
  page: Page,
  email = "maxim@example.test",
  secret = password,
) {
  await page.goto("/login");
  await page.getByLabel("Электронная почта").fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Выйти из системы" }),
  ).toBeVisible();
}
export async function createDraft(page: Page, city = unique("Поездка UI")) {
  await page.goto("/requests/new");
  await page.getByLabel("Город", { exact: true }).fill(city);
  await page.getByLabel("Дата начала").fill("2026-12-01");
  await page.getByLabel("Дата окончания").fill("2026-12-03");
  await page
    .getByLabel("Цель поездки")
    .fill("Проверка рабочего сценария через интерфейс Playwright");
  await page.getByLabel("Сумма", { exact: true }).fill("100.10");
  await page.getByRole("button", { name: "Сохранить черновик" }).click();
  await expect(page).toHaveURL(/\/requests\/\d+$/);
  await expect(
    page.getByRole("heading", { name: `Командировка в ${city}`, exact: true }),
  ).toBeVisible();
  return { city, path: new URL(page.url()).pathname };
}
export async function submit(page: Page) {
  await page.getByRole("button", { name: "Отправить на согласование" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Заявка отправлена на согласование" }),
  ).toHaveText("Заявка отправлена на согласование");
}
export async function openQueueItem(page: Page, city: string) {
  await page.goto("/approvals");
  await page.getByRole("link", { name: city, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ваше решение", exact: true }),
  ).toBeVisible();
}
export const history = (page: Page) =>
  page.locator("section").filter({
    has: page.getByRole("heading", { name: "История заявки", exact: true }),
  });
export const statusBadge = (page: Page) => page.locator(".page-heading .badge");

export async function listReady(page: Page) {
  await expect(page.locator(".list-panel")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
}
