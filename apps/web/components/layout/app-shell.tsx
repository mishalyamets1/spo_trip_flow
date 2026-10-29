"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthGate } from "./auth-gate";
import { Sidebar } from "./sidebar";
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <AuthGate>
      <div className="app-shell">
        <Sidebar />
        <main className="main-content">
          <header className="topbar">
            <span>
              Командировки /{" "}
              {pathname === "/approvals" ? "Согласование" : "Мои заявки"}
            </span>
            <span className="workspace-tag">TripFlow</span>
          </header>
          {children}
        </main>
      </div>
    </AuthGate>
  );
}
