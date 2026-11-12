export interface ApprovalFilters {
  view: "pending" | "processed";
  decision?: "APPROVED" | "REJECTED";
  from?: string;
  to?: string;
  page: number;
}
