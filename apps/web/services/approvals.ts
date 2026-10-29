import { api } from "../lib/api";
import type { RequestSummary, TravelRequest } from "../types";
export const approvalsApi = {
  list: () => api<{ items: RequestSummary[] }>("/approvals"),
  decide: (id: string, version: number, approved: boolean, comment: string) =>
    api<TravelRequest>(
      `/approvals/${encodeURIComponent(id)}/${approved ? "approve" : "reject"}`,
      "POST",
      { version, comment },
    ),
};
