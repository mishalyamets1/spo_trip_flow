"use client";
import type { Category, Expense } from "../../types";
import { money } from "../../lib/format";
export function ExpenseEditor({
  expenses,
  categories,
  onChange: setExpenses,
}: {
  expenses: Expense[];
  categories: Category[];
  onChange: (expenses: Expense[]) => void;
}) {
  function update(index: number, key: keyof Expense, value: string) {
    setExpenses(
      expenses.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    );
  }
  return (
    <section className="section-panel">
      <div className="section-title">
        <h2>Смета расходов</h2>
        <span className="muted">В рублях</span>
      </div>
      {expenses.map((item, i) => (
        <div className="expense-row" key={i}>
          <label>
            Категория
            <select
              required
              value={item.category_id}
              onChange={(e) => update(i, "category_id", e.target.value)}
            >
              <option value="" disabled>
                Выберите категорию
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Сумма
            <input
              type="number"
              step="0.01"
              min="0"
              max="999999999999.99"
              required
              value={item.amount}
              onChange={(e) => update(i, "amount", e.target.value)}
            />
          </label>
          <label>
            Описание
            <input
              maxLength={300}
              value={item.description}
              onChange={(e) => update(i, "description", e.target.value)}
            />
          </label>
          <button
            type="button"
            className="text-button remove-expense"
            aria-label={`Удалить расход ${i + 1}`}
            onClick={() => setExpenses(expenses.filter((_, j) => j !== i))}
          >
            Удалить
          </button>
        </div>
      ))}
      <button
        type="button"
        className="secondary"
        disabled={expenses.length >= 100 || !categories.length}
        onClick={() =>
          setExpenses([
            ...expenses,
            {
              category_id: categories[0]?.id || "",
              amount: "",
              description: "",
            },
          ])
        }
      >
        + Добавить расход
      </button>
      <div className="expense-total">
        <span>Предварительный итог</span>
        <strong>
          {money(
            String(
              expenses.reduce((sum, x) => sum + (Number(x.amount) || 0), 0),
            ),
          )}
        </strong>
      </div>
      <p className="muted small">
        Окончательная сумма рассчитывается при сохранении. Для отправки нужна
        хотя бы одна позиция.
      </p>
    </section>
  );
}
