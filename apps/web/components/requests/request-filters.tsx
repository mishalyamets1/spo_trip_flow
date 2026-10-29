"use client";
import type { FormEvent } from "react";
import type { RequestFilters as Filters } from "../../types";
import { statuses } from "../../lib/constants";
export function RequestFilters({
  value,
  onApply,
}: {
  value: Filters;
  onApply: (value: Filters) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onApply({
      status: String(data.get("status")),
      from: String(data.get("from")),
      to: String(data.get("to")),
    });
  }
  return (
    <form className="filters" onSubmit={submit}>
      <label>
        Статус
        <select name="status" defaultValue={value.status}>
          <option value="">Все статусы</option>
          {Object.entries(statuses)
            .filter(([key]) => !["PENDING", "SKIPPED"].includes(key))
            .map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
        </select>
      </label>
      <label>
        Начало поездки от
        <input name="from" type="date" defaultValue={value.from} />
      </label>
      <label>
        Окончание до
        <input name="to" type="date" defaultValue={value.to} />
      </label>
      <button className="secondary">Применить</button>
    </form>
  );
}
