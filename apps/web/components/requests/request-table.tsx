import Link from "next/link";
import type { RequestSummary } from "../../types";
import { money, period } from "../../lib/format";
import { Badge } from "../ui/badge";
export function RequestTable({
  items,
  admin = false,
  adminReturnTo = "/admin/requests",
  approvals = false,
  processed = false,
  approvalsReturnTo = "/approvals",
}: {
  items: RequestSummary[];
  admin?: boolean;
  adminReturnTo?: string;
  approvals?: boolean;
  processed?: boolean;
  approvalsReturnTo?: string;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Заявка / направление</th>
            <th>{approvals || admin ? "Сотрудник" : "Даты поездки"}</th>
            <th>Сумма</th>
            <th>Статус</th>
            {processed && <th>Моё решение</th>}
            <th>
              <span className="sr-only">Действие</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const href = admin
              ? `/admin/requests/${item.id}?returnTo=${encodeURIComponent(adminReturnTo)}`
              : `/requests/${item.id}${approvals ? `?from=approvals&returnTo=${encodeURIComponent(approvalsReturnTo)}` : ""}`;
            return (
              <tr key={item.approval_id || item.id}>
                <td>
                  <Link className="request-link" href={href}>
                    {item.destination_city}
                  </Link>
                  <span className="cell-subtitle">
                    {item.number} · {item.destination_country}
                  </span>
                </td>
                <td>
                  {approvals || admin ? item.employee_name : period(item)}
                </td>
                <td className="amount">{money(item.estimated_total)}</td>
                <td>
                  <Badge status={item.status} />
                </td>
                {processed && (
                  <td className="decision-cell">
                    <Badge
                      status={item.approval_status || ""}
                      label={
                        item.approval_status === "APPROVED"
                          ? "Согласовано"
                          : "Отклонено"
                      }
                    />
                    {item.approval_decided_at && (
                      <time
                        className="cell-subtitle"
                        dateTime={item.approval_decided_at}
                      >
                        {new Date(item.approval_decided_at).toLocaleString(
                          "ru-RU",
                        )}
                      </time>
                    )}
                    {item.approval_comment && (
                      <span className="cell-subtitle decision-comment">
                        {item.approval_comment}
                      </span>
                    )}
                  </td>
                )}
                <td>
                  <Link className="text-button" href={href}>
                    Открыть →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
