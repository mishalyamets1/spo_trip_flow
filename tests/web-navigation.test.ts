import { test, expect } from "@jest/globals";
import {
  safeReturnPath,
  workspaceHome,
  workspaceDestination,
} from "../apps/web/lib/navigation.js";
test("администратор попадает в админку, адреса карточек и фильтры безопасно сохраняются", () => {
  expect(workspaceHome(["ADMIN"])).toBe("/admin/employees");
  expect(workspaceDestination("/requests", ["ADMIN"])).toBe("/admin/employees");
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
    expect(safeReturnPath(path)).toBe(path);
  expect(safeReturnPath("/admin/unknown")).toBe("/requests");
});
test("навигация согласующего учитывает право создавать заявки и сохраняет назначенные карточки", () => {
  expect(workspaceHome(["APPROVER"])).toBe("/approvals");
  expect(workspaceHome(["EMPLOYEE", "APPROVER"])).toBe("/requests");
  for (const path of [
    "/requests",
    "/requests?page=2",
    "/requests/new",
    "/requests/3/edit",
  ])
    expect(workspaceDestination(path, ["APPROVER"])).toBe("/approvals");
  for (const path of [
    "/requests/3?from=approvals",
    "/approvals?view=processed&page=2",
  ])
    expect(workspaceDestination(path, ["APPROVER"])).toBe(path);
  expect(workspaceDestination("/requests/new", ["EMPLOYEE", "APPROVER"])).toBe(
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
    expect(safeReturnPath(path)).toBe(path);
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
    expect(safeReturnPath(path)).toBe("/requests");
  }
});
