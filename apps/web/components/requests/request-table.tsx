import Link from "next/link";
import type { RequestSummary } from "../../types";
import { money, period } from "../../lib/format";
import { Badge } from "../ui/badge";
export function RequestTable({
  items,
  approvals = false,
}: {
  items: RequestSummary[];
  approvals?: boolean;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Заявка / направление</th>
            <th>{approvals ? "Сотрудник" : "Даты поездки"}</th>
            <th>Сумма</th>
            <th>Статус</th>
            <th>
              <span className="sr-only">Действие</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const href = `/requests/${item.id}${approvals ? "?from=approvals" : ""}`;
            return (
              <tr key={item.id}>
                <td>
                  <Link className="request-link" href={href}>
                    {item.destination_city}
                  </Link>
                  <span className="cell-subtitle">
                    {item.number} · {item.destination_country}
                  </span>
                </td>
                <td>{approvals ? item.employee_name : period(item)}</td>
                <td className="amount">{money(item.estimated_total)}</td>
                <td>
                  <Badge status={item.status} />
                </td>
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
