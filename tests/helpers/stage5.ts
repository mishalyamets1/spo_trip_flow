import { describe, test, beforeAll, expect } from "@jest/globals";
import type { Pool } from "pg";
type Call = (
  path: string,
  method?: string,
  body?: unknown,
  cookie?: string,
) => Promise<{
  status: number;
  data: any;
  cookie: string;
}>;
type Stage5Context = {
  call: Call;
  pool: Pool;
  admin: string;
  employee: string;
  manager: string;
  finance: string;
  root: string;
  input: Record<string, unknown>;
  password: string;
};
export function registerStage5Checks(getContext: () => Stage5Context) {
  describe("Справочники и полная история", () => {
    let call: Call,
      pool: Pool,
      admin: string,
      employee: string,
      manager: string,
      finance: string,
      root: string,
      input: Record<string, unknown>,
      password: string;
    beforeAll(() => {
      ({
        call,
        pool,
        admin,
        employee,
        manager,
        finance,
        root,
        input,
        password,
      } = getContext());
    });
    test("V: справочники — права, версии, отключение и защита используемых значений", async () => {
      const base = "/admin/catalogs/";
      expect(
        (await call(base + "departments", "GET", undefined, employee)).status,
      ).toBe(403);
      expect(
        (await call(base + "unknown", "GET", undefined, admin)).status,
      ).toBe(400);
      expect(
        (
          await call(
            base + "expense-categories",
            "POST",
            { name: "Без кода", is_active: true },
            admin,
          )
        ).status,
      ).toBe(400);
      let result = await call(
        base + "expense-categories",
        "POST",
        { name: "Учебная категория V", code: "TEST_STAGE5", is_active: true },
        admin,
      );
      expect(result.status).toBe(201);
      let category = result.data.items.find(
        (c: any) => c.code === "TEST_STAGE5",
      );
      expect(
        (
          await call(
            base + "expense-categories",
            "POST",
            { name: "Дубликат V", code: "TEST_STAGE5", is_active: true },
            admin,
          )
        ).status,
      ).toBe(409);
      const create = await call(
        "/requests",
        "POST",
        {
          ...input,
          expenses: [
            {
              category_id: category.id,
              amount: "23.45",
              description: "Проверка отключения",
            },
          ],
        },
        employee,
      );
      expect(create.status).toBe(201);
      let draft = create.data;
      expect(
        (
          await call(
            base + "expense-categories/" + category.id,
            "DELETE",
            { version: category.version },
            admin,
          )
        ).status,
      ).toBe(409);
      result = await call(
        base + "expense-categories/" + category.id,
        "PATCH",
        { ...category, is_active: false },
        admin,
      );
      expect(result.status).toBe(200);
      const old = category;
      category = result.data.items.find((c: any) => c.id === category.id);
      expect(
        (
          await call(
            base + "expense-categories/" + category.id,
            "PATCH",
            old,
            admin,
          )
        ).status,
      ).toBe(409);
      expect(
        (
          await call("/expense-categories", "GET", undefined, employee)
        ).data.items.some((c: any) => c.id === category.id),
      ).toBe(false);
      expect(
        (
          await call(
            "/requests",
            "POST",
            {
              ...input,
              expenses: [
                { category_id: category.id, amount: "10.00", description: "" },
              ],
            },
            employee,
          )
        ).status,
      ).toBe(400);
      const edit = await call(
        "/requests/" + draft.id,
        "PATCH",
        {
          ...input,
          version: draft.version,
          expenses: [
            {
              category_id: category.id,
              amount: "25.00",
              description: "Прежняя отключённая категория",
            },
          ],
        },
        employee,
      );
      expect(edit.status).toBe(200);
      draft = edit.data;
      expect(
        (
          await call(
            "/requests/" + draft.id,
            "DELETE",
            { version: draft.version },
            employee,
          )
        ).status,
      ).toBe(204);
      expect(
        (
          await call(
            base + "expense-categories/" + category.id,
            "DELETE",
            { version: category.version },
            admin,
          )
        ).status,
      ).toBe(204);
      result = await call(
        base + "departments",
        "POST",
        { name: "Учебное подразделение V", is_active: true },
        admin,
      );
      expect(result.status).toBe(201);
      let department = result.data.items.find(
        (d: any) => d.name === "Учебное подразделение V",
      );
      const person = await call(
        "/admin/employees",
        "POST",
        {
          full_name: "Учебный сотрудник справочника",
          email: "stage5-catalog@example.test",
          employee_number: "V-CATALOG",
          position: "Специалист",
          department_id: department.id,
          hire_date: "2026-11-01",
          phone: "",
          roles: ["EMPLOYEE"],
          is_active: true,
          password,
        },
        admin,
      );
      expect(person.status).toBe(201);
      expect(
        (
          await call(
            base + "departments/" + department.id,
            "DELETE",
            { version: department.version },
            admin,
          )
        ).status,
      ).toBe(409);
      result = await call(
        base + "departments/" + department.id,
        "PATCH",
        { ...department, is_active: false },
        admin,
      );
      expect(result.status).toBe(200);
      department = result.data.items.find((d: any) => d.id === department.id);
      const newProfile = {
        ...person.data,
        email: "stage5-forbidden@example.test",
        employee_number: "V-FORBIDDEN",
        password,
      };
      expect(
        (await call("/admin/employees", "POST", newProfile, admin)).status,
      ).toBe(400);
      expect(
        (
          await call(
            "/admin/routes",
            "POST",
            {
              department_id: department.id,
              name: "Недопустимый маршрут",
              is_active: true,
              version: 0,
              approver_ids: ["2"],
            },
            admin,
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await call(
            "/admin/employees/" + person.data.id,
            "DELETE",
            {
              version: person.data.version,
              reason: "Завершение учебной проверки",
              expected_request_count: 0,
            },
            admin,
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await call(
            base + "departments/" + department.id,
            "DELETE",
            { version: department.version },
            admin,
          )
        ).status,
      ).toBe(204);
    });
    test("V: три этапа — каждое решение присутствует в единой истории без дублей", async () => {
      const rootUser = (
        await pool.query("SELECT user_id FROM employees WHERE id=$1", [root])
      ).rows[0].user_id;
      await pool.query(
        "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='APPROVER' ON CONFLICT DO NOTHING",
        [rootUser],
      );
      const routes = (await call("/admin/routes", "GET", undefined, admin)).data
        .items;
      const route = routes.find((r: any) => r.department_id === "1");
      const ids = route.steps.map((s: any) => s.employee_id);
      let saved = await call(
        "/admin/routes/" + route.id,
        "PATCH",
        { ...route, approver_ids: [...ids, root] },
        admin,
      );
      expect(saved.status).toBe(200);
      let request = (await call("/requests", "POST", input, employee)).data;
      request = (
        await call(
          `/requests/${request.id}/submit`,
          "POST",
          { version: request.version },
          employee,
        )
      ).data;
      const comments = [
        "Решение первого этапа V",
        "Решение промежуточного этапа V",
        "Решение последнего этапа V",
      ];
      for (const [i, cookie] of [manager, finance, admin].entries()) {
        const decision = await call(
          `/approvals/${request.steps[i].id}/approve`,
          "POST",
          { version: request.version, comment: comments[i] },
          cookie,
        );
        expect(decision.status).toBe(200);
        request = decision.data;
        expect(request.history.length).toBe(3 + i);
        expect(
          request.history.filter((h: any) => h.comment === comments[i]).length,
        ).toBe(1);
      }
      expect(request.status).toBe("APPROVED");
      expect(
        request.history.find((h: any) => h.comment === comments[1]).event_type,
      ).toBe("APPROVAL_DECISION");
      expect(
        (
          await call(
            `/requests/${request.id}/history`,
            "GET",
            undefined,
            employee,
          )
        ).data.items.length,
      ).toBe(5);
      const current = saved.data.items.find((r: any) => r.id === route.id);
      expect(
        (
          await call(
            "/admin/routes/" + route.id,
            "PATCH",
            { ...current, approver_ids: ids },
            admin,
          )
        ).status,
      ).toBe(200);
      await pool.query("DELETE FROM travel_requests WHERE id=$1", [request.id]);
      await pool.query("DELETE FROM trips WHERE id=$1", [request.trip_id]);
      await pool.query(
        "DELETE FROM user_roles WHERE user_id=$1 AND role_id=(SELECT id FROM roles WHERE code='APPROVER')",
        [rootUser],
      );
    });
  });
}
