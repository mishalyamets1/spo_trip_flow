import { api } from "../lib/api";
import type { User } from "../types";
export const authApi = {
  me: () => api<User>("/auth/me"),
  login: (email: string, password: string) =>
    api<User>("/auth/login", "POST", { email, password }),
  logout: () => api<void>("/auth/logout", "POST", {}),
};
