import Link from "next/link";
export default function NotFoundPage() {
  return (
    <main className="empty">
      <h1>Страница не найдена</h1>
      <p className="muted">Проверьте адрес или вернитесь к своим заявкам.</p>
      <Link className="primary" href="/requests">
        Мои заявки
      </Link>
    </main>
  );
}
