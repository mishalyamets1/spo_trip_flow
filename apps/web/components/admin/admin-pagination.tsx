import Link from "next/link";
export function AdminPagination({
  base,
  query,
  page,
  total,
  pageSize = 20,
}: {
  base: string;
  query: string;
  page: number;
  total: number;
  pageSize?: number;
}) {
  if (total <= pageSize) return null;
  const href = (value: number) => {
    const params = new URLSearchParams(query);
    params.set("page", String(value));
    return `${base}?${params}`;
  };
  return (
    <div className="pagination">
      {page > 1 ? (
        <Link className="secondary" href={href(page - 1)}>
          Назад
        </Link>
      ) : (
        <span />
      )}
      <span>
        Страница {page} из {Math.ceil(total / pageSize)}
      </span>
      {page * pageSize < total ? (
        <Link className="secondary" href={href(page + 1)}>
          Далее
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
