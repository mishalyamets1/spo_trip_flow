import { api } from "../lib/api";
import type { TravelRequest, RequestSummary } from "../types";
import type {
  AdminEmployee,
  AdminMetadata,
  EmployeePreview,
  AdminRoute,
  PageResult,
  AuditEntry,
} from "../types/admin";
export const adminApi = {
  metadata: () => api<AdminMetadata>("/admin/metadata"),
  employees: (query: string) =>
    api<PageResult<AdminEmployee>>(`/admin/employees?${query}`),
  employee: (id: string) => api<EmployeePreview>(`/admin/employees/${id}`),
  saveEmployee: (id: string | undefined, body: unknown) =>
    api<AdminEmployee>(
      `/admin/employees${id ? "/" + id : ""}`,
      id ? "PATCH" : "POST",
      body,
    ),
  deleteEmployee: (id: string, body: unknown) =>
    api<{ deleted_request_count: number }>(
      `/admin/employees/${id}`,
      "DELETE",
      body,
    ),
  requests: (query: string) =>
    api<PageResult<RequestSummary>>(`/admin/requests?${query}`),
  request: (id: string) => api<TravelRequest>(`/admin/requests/${id}`),
  cancel: (id: string, version: number, reason: string) =>
    api<TravelRequest>(`/admin/requests/${id}/cancel`, "POST", {
      version,
      reason,
    }),
  reassign: (
    id: string,
    version: number,
    approver_employee_id: string,
    reason: string,
  ) =>
    api<TravelRequest>(`/admin/requests/${id}/reassign`, "POST", {
      version,
      approver_employee_id,
      reason,
    }),
  routes: () => api<{ items: AdminRoute[] }>("/admin/routes"),
  saveRoute: (id: string | undefined, body: unknown) =>
    api<{ items: AdminRoute[] }>(
      `/admin/routes${id ? "/" + id : ""}`,
      id ? "PATCH" : "POST",
      body,
    ),
  audit: (query: string) =>
    api<PageResult<AuditEntry>>(`/admin/audit?${query}`),
};
