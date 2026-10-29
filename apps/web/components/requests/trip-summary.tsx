import type { TravelRequest } from "../../types";
import { period } from "../../lib/format";
import { transports } from "../../lib/constants";
export function TripSummary({ request }: { request: TravelRequest }) {
  return (
    <section className="section-panel">
      <h2>О поездке</h2>
      <dl className="facts">
        <div>
          <dt>Направление</dt>
          <dd>
            {request.destination_country}, {request.destination_city}
          </dd>
        </div>
        <div>
          <dt>Даты</dt>
          <dd>{period(request)}</dd>
        </div>
        <div>
          <dt>Транспорт</dt>
          <dd>{transports[request.transport_type]}</dd>
        </div>
        <div>
          <dt>Проживание</dt>
          <dd>
            {request.accommodation_required ? "Требуется" : "Не требуется"}
          </dd>
        </div>
      </dl>
      <h3>Цель поездки</h3>
      <p className="pre-wrap">{request.purpose}</p>
      {request.employee_comment && (
        <>
          <h3>Комментарий сотрудника</h3>
          <p className="pre-wrap">{request.employee_comment}</p>
        </>
      )}
    </section>
  );
}
