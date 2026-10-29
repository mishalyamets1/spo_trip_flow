"use client";
import { useCallback, useEffect, useState } from "react";
import { ApiError, errorMessage } from "../lib/api";
import { useAuth } from "../providers/auth-provider";

export function useResource<T>(load: () => Promise<T>) {
  const { invalidate } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setData(null);
    load()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) invalidate();
        setError(errorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load, attempt, invalidate]);
  return { data, loading, error, reload, setData };
}
