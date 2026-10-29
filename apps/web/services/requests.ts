import { api } from "../lib/api";
import type { Category, RequestList, TravelRequest, TripInput } from "../types";
const path = (id: string) => `/requests/${encodeURIComponent(id)}`;
export const requestsApi = {
  list: (query: string) => api<RequestList>(`/requests?${query}`),
  get: (id: string) => api<TravelRequest>(path(id)),
  categories: async () =>
    (await api<{ items: Category[] }>("/expense-categories")).items,
  create: (input: TripInput) => api<TravelRequest>("/requests", "POST", input),
  update: (id: string, input: TripInput, version: number) =>
    api<TravelRequest>(path(id), "PATCH", { ...input, version }),
  remove: (id: string, version: number) =>
    api<void>(path(id), "DELETE", { version }),
  submit: (id: string, version: number) =>
    api<TravelRequest>(`${path(id)}/submit`, "POST", { version }),
};
