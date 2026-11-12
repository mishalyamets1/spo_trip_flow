import { api } from "../lib/api";
import type { ApprovalList, TravelRequest } from "../types";
export const approvalsApi = {
  list: (query = "") => api<ApprovalList>(`/approvals?${query}`),
  decide: (id: string, version: number, approved: boolean, comment: string) =>
    api<TravelRequest>(
      `/approvals/${encodeURIComponent(id)}/${approved ? "approve" : "reject"}`,
      "POST",
      { version, comment },
    ),
};
