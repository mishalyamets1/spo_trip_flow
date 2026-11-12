import { test, expect } from "@playwright/test";
import { createDraft, login, statusBadge } from "./helpers";
test("360 px: вход, создание заявки, карточка и навигация без переполнения страницы", async ({
  page,
}) => {
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Мои заявки", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "+ Новая заявка" }).click();
  await expect(page.getByLabel("Город", { exact: true })).toBeVisible();
  const draft = await createDraft(page);
  await expect(statusBadge(page)).toHaveText("Черновик");
  await expect(
    page.getByRole("heading", { name: "История заявки", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "← К списку заявок" }).click();
  await expect(
    page.getByRole("link", { name: draft.city, exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
