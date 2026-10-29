"use client";
import { useState } from "react";
import { ApiError, errorMessage } from "../lib/api";
import { useAuth } from "../providers/auth-provider";
export function useApiAction() {
  const { invalidate } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run<T>(work: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError("");
    try {
      return await work();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) invalidate();
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return { run, busy, error, clearError: () => setError("") };
}
