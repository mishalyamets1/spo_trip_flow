import type { TravelRequest } from "../../types";
import { transports } from "../../lib/constants";
export function TripFields({ initial }: { initial: TravelRequest | null }) {
  return (
    <section className="section-panel">
      <h2>Данные поездки</h2>
      <div className="form-grid">
        <label>
          Страна
          <input
            name="country"
            defaultValue={initial?.destination_country || "Россия"}
            required
            maxLength={100}
          />
        </label>
        <label>
          Город
          <input
            name="city"
            defaultValue={initial?.destination_city}
            required
            maxLength={120}
          />
        </label>
        <label>
          Дата начала
          <input
            name="start"
            type="date"
            defaultValue={initial?.start_date}
            required
          />
        </label>
        <label>
          Дата окончания
          <input
            name="end"
            type="date"
            defaultValue={initial?.end_date}
            required
          />
        </label>
        <label>
          Транспорт
          <select
            name="transport"
            defaultValue={initial?.transport_type || "RAIL"}
          >
            {Object.entries(transports).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox-label">
          <input
            name="accommodation"
            type="checkbox"
            defaultChecked={initial?.accommodation_required ?? true}
          />
          Требуется проживание
        </label>
      </div>
      <label>
        Цель поездки
        <textarea
          name="purpose"
          rows={3}
          required
          minLength={10}
          maxLength={1000}
          defaultValue={initial?.purpose}
          placeholder="Опишите служебную цель поездки, не менее 10 символов"
        />
      </label>
    </section>
  );
}
