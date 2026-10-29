export const money = (value: string) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(
    Number(value),
  );
export const period = (r: { start_date: string; end_date: string }) =>
  `${new Date(r.start_date + "T00:00:00").toLocaleDateString("ru-RU")} — ${new Date(r.end_date + "T00:00:00").toLocaleDateString("ru-RU")}`;
