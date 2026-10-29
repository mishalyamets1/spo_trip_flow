"use client";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../providers/auth-provider";
import { ErrorAlert, Loading } from "../ui/feedback";
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, checking, error, retry } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!checking && !user && !error) {
      router.replace(
        `/login?next=${encodeURIComponent(pathname + window.location.search)}`,
      );
    }
  }, [checking, user, error, pathname, router]);
  if (checking)
    return (
      <main className="loading-screen">
        <Loading>Проверяем сессию…</Loading>
      </main>
    );
  if (error)
    return (
      <main className="main-content">
        <ErrorAlert message={error} onRetry={retry} />
      </main>
    );
  if (!user) return <Loading>Переходим на страницу входа…</Loading>;
  return children;
}
