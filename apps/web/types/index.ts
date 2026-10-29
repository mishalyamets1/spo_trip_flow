export type User = {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
  roles: string[];
};
export type Category = { id: string; name: string };
export type Expense = {
  category_id: string;
  amount: string;
  description: string;
  category_name?: string;
};
export type Step = {
  id: string;
  step_order: number;
  approver_name: string;
  approver_employee_id: string;
  status: string;
  actionable: boolean;
  decision_comment?: string;
};
export type History = {
  id: string;
  new_status: string;
  changed_by_name: string;
  changed_at: string;
  comment: string;
};
export type TripInput = {
  destination_country: string;
  destination_city: string;
  purpose: string;
  start_date: string;
  end_date: string;
  transport_type: string;
  accommodation_required: boolean;
  currency: string;
  employee_comment: string;
  expenses: Expense[];
};
export type RequestSummary = Omit<TripInput, "expenses"> & {
  id: string;
  number: string;
  employee_id: string;
  employee_name: string;
  status: string;
  estimated_total: string;
  version: number;
  approval_id?: string;
};
export type TravelRequest = RequestSummary & {
  expenses: Expense[];
  steps: Step[];
  history: History[];
};
export type RequestList = {
  items: RequestSummary[];
  total: number;
  page: number;
  page_size: number;
};
export type RequestFilters = { status: string; from: string; to: string };
