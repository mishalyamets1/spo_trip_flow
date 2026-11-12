import { test } from "node:test";
import assert from "node:assert/strict";
import {
  safeReturnPath,
  workspaceHome,
  workspaceDestination,
} from "../apps/web/lib/navigation.js";

test("администратор попадает в админку, адреса карточек и фильтры безопасно сохраняются", () => {
  assert.equal(workspaceHome(["ADMIN"]), "/admin/employees");
  assert.equal(
    workspaceDestination("/requests", ["ADMIN"]),
    "/admin/employees",
  );
  for (const path of [
    "/admin",
    "/admin/employees",
    "/admin/employees/new",
    "/admin/employees/6",
    "/admin/requests?q=TR-2026&page=2",
    "/admin/requests/7",
    "/admin/routes",
    "/admin/audit?page=2",
  ])
    assert.equal(safeReturnPath(path), path);
  assert.equal(safeReturnPath("/admin/unknown"), "/requests");
});

test("навигация согласующего учитывает право создавать заявки и сохраняет назначенные карточки", () => {
  assert.equal(workspaceHome(["APPROVER"]), "/approvals");
  assert.equal(workspaceHome(["EMPLOYEE", "APPROVER"]), "/requests");
  for (const path of [
    "/requests",
    "/requests?page=2",
    "/requests/new",
    "/requests/3/edit",
  ])
    assert.equal(workspaceDestination(path, ["APPROVER"]), "/approvals");
  for (const path of [
    "/requests/3?from=approvals",
    "/approvals?view=processed&page=2",
  ])
    assert.equal(workspaceDestination(path, ["APPROVER"]), path);
  assert.equal(
    workspaceDestination("/requests/new", ["EMPLOYEE", "APPROVER"]),
    "/requests/new",
  );
});

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
