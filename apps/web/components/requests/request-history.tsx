import type { TravelRequest } from "../../types";
import { statuses } from "../../lib/constants";
export function RequestHistory({ request }: { request: TravelRequest }) {
  return (
    <section className="section-panel">
      <h2>История заявки</h2>
      <ol className="history">
        {request.history.map((h) => (
          <li key={h.id}>
            <span className="history-dot" />
            <div>
              <strong>{statuses[h.new_status]}</strong>
              <p className="pre-wrap">{h.comment}</p>
              <span className="muted">
                {h.changed_by_name} ·{" "}
                {new Date(h.changed_at).toLocaleString("ru-RU")}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
