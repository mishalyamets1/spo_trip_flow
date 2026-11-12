"use client";
import { useState, type FormEvent } from "react";
import type { TravelRequest } from "../../types";

export function CancelRequest({
  busy,
  onCancel,
}: {
  busy: boolean;
  onCancel: (reason: string) => Promise<void>;
}) {
  const [opened, setOpened] = useState(false);
  const [reason, setReason] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reason.trim()) await onCancel(reason.trim());
  }
  return (
    <section className="section-panel actions">
      <h2>Отмена заявки</h2>
      <p className="muted small">
        Можно отменить до первого решения согласующего. После отмены отправить
        эту заявку повторно нельзя.
      </p>
      {!opened ? (
        <button
          className="secondary"
          disabled={busy}
          onClick={() => setOpened(true)}
        >
          Отменить заявку
        </button>
      ) : (
        <form className="actions" onSubmit={submit}>
          <label>
            Причина отмены
            <textarea
              rows={3}
              required
              maxLength={2000}
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Например, рабочая встреча перенесена"
            />
          </label>
          <button className="danger" disabled={busy || !reason.trim()}>
            {busy ? "Отменяем…" : "Подтвердить отмену"}
          </button>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => {
              setOpened(false);
              setReason("");
            }}
          >
            Вернуться без отмены
          </button>
        </form>
      )}
    </section>
  );
}
export function CancellationSummary({ request }: { request: TravelRequest }) {
  if (request.status !== "CANCELED") return null;
  return (
    <section className="section-panel">
      <h2>Заявка отменена</h2>
      {request.canceled_at && (
        <p className="muted">
          <time dateTime={request.canceled_at}>
            {new Date(request.canceled_at).toLocaleString("ru-RU")}
          </time>
        </p>
      )}
      <p className="pre-wrap">{request.cancellation_reason}</p>
      <p className="muted small">
        Ожидающие этапы закрыты. Новые решения по этой заявке недоступны.
      </p>
    </section>
  );
}
