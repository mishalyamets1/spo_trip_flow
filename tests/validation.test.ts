import { test, expect } from "@jest/globals";
import { requestSchema } from "../apps/api/src/validators/request.validation.js";
import { totalAmount } from "../apps/api/src/services/estimate.service.js";
export const validInput = {
  destination_country: "Россия",
  destination_city: "Казань",
  purpose: "Рабочая встреча с командой проекта",
  start_date: "2026-11-10",
  end_date: "2026-11-12",
  transport_type: "RAIL",
  accommodation_required: true,
  currency: "RUB",
  employee_comment: "",
  expenses: [
    { category_id: "1", amount: "0.10", description: "Билеты" },
    { category_id: "2", amount: "0.20", description: "Проживание" },
  ],
};
test("сумма сметы считается точно, включая копейки", () => {
  expect(totalAmount(validInput.expenses)).toBe("0.30");
  expect(totalAmount([])).toBe("0.00");
});
test("недопустимые даты, деньги и короткая цель отклоняются", () => {
  for (const changed of [
    { end_date: "2026-11-09" },
    { start_date: "2026-02-30" },
    { purpose: "Коротко" },
    { currency: "USD" },
    { expenses: [{ category_id: "1", amount: "-1", description: "" }] },
    { expenses: [{ category_id: "1", amount: "1.001", description: "" }] },
  ])
    expect(requestSchema.safeParse({ ...validInput, ...changed }).success).toBe(
      false,
    );
});
test("переполнение NUMERIC не проходит незаметно", () => {
  expect(() =>
    totalAmount(
      Array.from({ length: 2 }, () => ({
        category_id: "1",
        amount: "999999999999.99",
        description: "",
      })),
    ),
  ).toThrow();
});
