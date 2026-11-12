"use client";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../providers/auth-provider";
import { workspaceDestination } from "../../lib/navigation";
import { ErrorAlert, Loading } from "../ui/feedback";
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, checking, error, signedOut, retry } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const destination = user
    ? workspaceDestination(pathname, user.roles)
    : pathname;
  useEffect(() => {
    if (!checking && user && destination !== pathname) {
      router.replace(destination);
      return;
    }
    if (!checking && !user && !error) {
      router.replace(
        signedOut
          ? "/login"
          : `/login?next=${encodeURIComponent(pathname + window.location.search)}`,
      );
    }
  }, [checking, user, error, signedOut, pathname, destination, router]);
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
  if (destination !== pathname)
    return <Loading>Открываем согласование…</Loading>;
  return children;
}
