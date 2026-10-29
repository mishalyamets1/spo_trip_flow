import type { Step } from "../../types";
import { Badge } from "../ui/badge";
export function ApprovalSteps({ steps }: { steps: Step[] }) {
  return (
    <section className="section-panel">
      <h2>Согласование</h2>
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
