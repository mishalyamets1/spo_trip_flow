import { test } from "node:test";
import assert from "node:assert/strict";
import { safeReturnPath } from "../apps/web/lib/navigation.js";

test("после входа сохраняется адрес карточки, редактирования или фильтрованного списка", () => {
  for (const path of [
    "/requests",
    "/requests/new",
    "/requests/3",
    "/requests/3/edit",
    "/requests?status=APPROVED&page=2",
    "/approvals",
  ])
    assert.equal(safeReturnPath(path), path);
});

test("параметр next не перенаправляет на чужой сайт, API или повторный вход", () => {
  for (const path of [
    null,
    "",
    "https://foreign.test",
    "//foreign.test",
    "/\\foreign.test",
    "/login",
    "/api/auth/logout",
    "/requests/not-an-id",
    "/%2f%2fforeign.test",
  ]) {
    assert.equal(safeReturnPath(path), "/requests");
  }
});
