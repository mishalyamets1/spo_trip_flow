"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, errorMessage } from "../lib/api";
import { authApi } from "../services/auth";
import type { User } from "../types";

type AuthContextValue = {
  user: User | null;
  checking: boolean;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  invalidate: () => void;
  retry: () => void;
};
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const invalidate = useCallback(() => {
    setUser(null);
    setError("");
  }, []);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    setChecking(true);
    setError("");
    authApi
      .me()
      .then((value) => {
        if (active) setUser(value);
      })
      .catch((error) => {
        if (!active) return;
        setUser(null);
        if (!(error instanceof ApiError && error.status === 401))
          setError(errorMessage(error));
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const login = useCallback(async (email: string, password: string) => {
    const value = await authApi.login(email, password);
    setError("");
    setUser(value);
  }, []);
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error;
    }
    invalidate();
  }, [invalidate]);
  const value = useMemo(
    () => ({ user, checking, error, login, logout, invalidate, retry }),
    [user, checking, error, login, logout, invalidate, retry],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth requires AuthProvider");
  return context;
}
