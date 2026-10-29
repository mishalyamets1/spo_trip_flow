"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "../../providers/auth-provider";
import { errorMessage } from "../../lib/api";
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
      <Link className="brand" href="/requests">
        TripFlow<span className="brand-dot">.</span>
      </Link>
      <p className="workspace-label">РАБОЧЕЕ ПРОСТРАНСТВО</p>
      <nav aria-label="Главная навигация">
        <Link
          href="/requests"
          className={pathname.startsWith("/requests") ? "nav-active" : ""}
          aria-current={pathname.startsWith("/requests") ? "page" : undefined}
        >
          Мои заявки
        </Link>
        {user.roles.includes("APPROVER") && (
          <Link
            href="/approvals"
            className={pathname === "/approvals" ? "nav-active" : ""}
            aria-current={pathname === "/approvals" ? "page" : undefined}
          >
            На согласовании
          </Link>
        )}
      </nav>
      <div className="sidebar-bottom">
        <div className="avatar">{user.full_name.slice(0, 1)}</div>
        <strong>{user.full_name}</strong>
        <span className="muted">
          {user.roles.includes("APPROVER") ? "Согласующий" : "Сотрудник"}
        </span>
        <button className="text-button" disabled={busy} onClick={exit}>
          Выйти из системы
        </button>
        <ErrorAlert message={error} />
      </div>
    </aside>
  );
}
