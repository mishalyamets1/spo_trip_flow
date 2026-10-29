"use client";
import { useState, type FormEvent } from "react";
import type { Category, Expense, TravelRequest, TripInput } from "../../types";
import { TripFields } from "./trip-fields";
import { ExpenseEditor } from "./expense-editor";
export function RequestForm({
  initial,
  categories,
  busy,
  onSave,
}: {
  initial: TravelRequest | null;
  categories: Category[];
  busy: boolean;
  onSave: (input: TripInput) => Promise<void>;
}) {
  const [expenses, setExpenses] = useState<Expense[]>(
    initial?.expenses.map((item) => ({
      ...item,
      description: item.description || "",
    })) || [
      { category_id: categories[0]?.id || "", amount: "", description: "" },
    ],
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await onSave({
      destination_country: String(data.get("country")),
      destination_city: String(data.get("city")),
      purpose: String(data.get("purpose")),
      start_date: String(data.get("start")),
      end_date: String(data.get("end")),
      transport_type: String(data.get("transport")),
      accommodation_required: data.get("accommodation") === "on",
      currency: "RUB",
      employee_comment: String(data.get("comment")),
      expenses,
    });
  }
  return (
    <form onSubmit={submit} className="request-form">
      <fieldset disabled={busy}>
        <TripFields initial={initial} />
        <ExpenseEditor
          expenses={expenses}
          categories={categories}
          onChange={setExpenses}
        />
        <section className="section-panel">
          <label>
            Комментарий к заявке
            <textarea
              name="comment"
              rows={3}
              maxLength={2000}
              defaultValue={initial?.employee_comment || ""}
            />
          </label>
        </section>
        <div className="form-footer">
          <span className="muted">Заявка сохранится как черновик.</span>
          <button className="primary" disabled={!categories.length}>
            {busy ? "Сохраняем…" : "Сохранить черновик"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
