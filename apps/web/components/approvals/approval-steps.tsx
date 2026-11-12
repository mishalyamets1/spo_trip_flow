import type { Step } from "../../types";
import { Badge } from "../ui/badge";
export function ApprovalSteps({ steps }: { steps: Step[] }) {
  return (
    <section className="section-panel">
      <h2>Согласование</h2>
      {steps.length > 0 && (
        <p className="muted small">
          Всего этапов: {steps.length}. Решения принимаются по очереди.
        </p>
      )}
      {steps.length ? (
        <ol className="steps">
          {steps.map((s) => (
            <li key={s.id}>
              <span className="step-number">{s.step_order}</span>
              <div>
                <strong>{s.approver_name}</strong>
                <p>
                  <Badge status={s.status} />
                </p>
                {s.status === "PENDING" && (
                  <p className="muted">
                    {s.actionable
                      ? "Текущий этап — ожидает решения"
                      : "Станет доступен после предыдущих этапов"}
                  </p>
                )}
                {s.decided_at && (
                  <time className="muted small" dateTime={s.decided_at}>
                    {new Date(s.decided_at).toLocaleString("ru-RU")}
                  </time>
                )}
                {s.decision_comment && (
                  <p className="pre-wrap">{s.decision_comment}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">Маршрут будет назначен при отправке заявки.</p>
      )}
    </section>
  );
}
