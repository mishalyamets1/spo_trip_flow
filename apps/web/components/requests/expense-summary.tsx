import type { TravelRequest } from "../../types";
import { money } from "../../lib/format";
export function ExpenseSummary({ request }: { request: TravelRequest }) {
  return (
    <section className="section-panel">
      <h2>Планируемые расходы</h2>
      {request.expenses.map((x, i) => (
        <div className="expense-summary" key={i}>
          <div>
            <strong>{x.category_name}</strong>
            <span className="cell-subtitle">{x.description}</span>
          </div>
          <span>{money(x.amount)}</span>
        </div>
      ))}
      <div className="expense-total">
        <span>Итого</span>
        <strong>{money(request.estimated_total)}</strong>
      </div>
    </section>
  );
}
