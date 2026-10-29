import Link from "next/link";
export function DraftActions({
  id,
  busy,
  onSubmit,
  onDelete,
}: {
  id: string;
  busy: boolean;
  onSubmit: () => void;
  onDelete: () => void;
}) {
  return (
    <section className="section-panel actions">
      <h2>Действия с черновиком</h2>
      <button className="primary" disabled={busy} onClick={onSubmit}>
        Отправить на согласование
      </button>
      {busy ? (
        <button className="secondary" disabled>
          Редактировать
        </button>
      ) : (
        <Link className="secondary" href={`/requests/${id}/edit`}>
          Редактировать
        </Link>
      )}
      <button className="danger-text" disabled={busy} onClick={onDelete}>
        Удалить черновик
      </button>
    </section>
  );
}
