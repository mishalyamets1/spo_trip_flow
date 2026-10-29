export interface ExpenseInput {
  category_id: string;
  amount: string;
  description: string;
}
export interface RequestInput {
  destination_country: string;
  destination_city: string;
  purpose: string;
  start_date: string;
  end_date: string;
  transport_type: "AIR" | "RAIL" | "CAR" | "BUS" | "OTHER";
  accommodation_required: boolean;
  currency: "RUB";
  employee_comment: string;
  expenses: ExpenseInput[];
  version?: number;
}
