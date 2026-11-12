"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "../../providers/auth-provider";
import { errorMessage } from "../../lib/api";
import { workspaceHome } from "../../lib/navigation";
import { ErrorAlert } from "../ui/feedback";
export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!user) return null;
  async function exit() {
    setBusy(true);
    setError("");
    try {
      await logout();
      router.replace("/login");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside className="sidebar">
      <Link className="brand" href={workspaceHome(user.roles)}>
        TripFlow<span className="brand-dot">.</span>
      </Link>
      <p className="workspace-label">РАБОЧЕЕ ПРОСТРАНСТВО</p>
      <nav aria-label="Главная навигация">
        {user.roles.includes("EMPLOYEE") && (
          <Link
            href="/requests"
            className={pathname.startsWith("/requests") ? "nav-active" : ""}
            aria-current={pathname.startsWith("/requests") ? "page" : undefined}
          >
            Мои заявки
          </Link>
        )}
        {user.roles.includes("APPROVER") && (
          <Link
            href="/approvals"
            className={pathname === "/approvals" ? "nav-active" : ""}
            aria-current={pathname === "/approvals" ? "page" : undefined}
          >
            Согласование
          </Link>
        )}
        {user.roles.includes("ADMIN") && (
          <Link
            href="/admin/employees"
            className={pathname.startsWith("/admin") ? "nav-active" : ""}
            aria-current={pathname.startsWith("/admin") ? "page" : undefined}
          >
            Администрирование
          </Link>
        )}
      </nav>
      <div className="sidebar-bottom">
        <div className="avatar">{user.full_name.slice(0, 1)}</div>
        <strong>{user.full_name}</strong>
        <span className="muted">
          {[
            user.roles.includes("ADMIN") && "Администратор",
            user.roles.includes("EMPLOYEE") && "Сотрудник",
            user.roles.includes("APPROVER") && "Согласующий",
          ]
            .filter(Boolean)
            .join(" · ") || "Пользователь"}
        </span>
        <button className="text-button" disabled={busy} onClick={exit}>
          Выйти из системы
        </button>
        <ErrorAlert message={error} />
      </div>
    </aside>
  );
}
