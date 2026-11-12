"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthGate } from "./auth-gate";
import { Sidebar } from "./sidebar";
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pageLabel = pathname.startsWith("/admin")
    ? "Администрирование"
    : pathname === "/approvals"
      ? "Согласование"
      : pathname === "/requests/new"
        ? "Новая заявка"
        : pathname.endsWith("/edit")
          ? "Редактирование заявки"
          : pathname.startsWith("/requests/")
            ? "Карточка заявки"
            : "Мои заявки";
  return (
    <AuthGate>
      <div className="app-shell">
        <Sidebar />
        <main className="main-content">
          <header className="topbar">
            <span>Командировки / {pageLabel}</span>
            <span className="workspace-tag">TripFlow</span>
          </header>
          {children}
        </main>
      </div>
    </AuthGate>
  );
}
