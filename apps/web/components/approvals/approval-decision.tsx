"use client";
import { useState } from "react";
export function ApprovalDecision({
  busy,
  onDecide,
}: {
  busy: boolean;
  onDecide: (approved: boolean, comment: string) => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  return (
    <section className="section-panel actions">
      <h2>Ваше решение</h2>
      <label>
        Комментарий
        <textarea
          rows={3}
          maxLength={2000}
          value={comment}
          disabled={busy}
          onChange={(event) => setComment(event.target.value)}
          placeholder="При отклонении укажите причину"
        />
      </label>
      <button
        className="primary"
        disabled={busy}
        onClick={() => onDecide(true, comment)}
      >
        Согласовать
      </button>
      <button
        className="danger"
        disabled={busy || !comment.trim()}
        onClick={() => onDecide(false, comment)}
      >
        Отклонить
      </button>
    </section>
  );
}
