"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "../../providers/auth-provider";
import { ErrorAlert } from "../ui/feedback";
export function AdminShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  if (!user?.roles.includes("ADMIN"))
    return <ErrorAlert message="Раздел доступен только администратору" />;
  return (
    <>
      <nav className="view-tabs" aria-label="Администрирование">
        {[
          ["employees", "Сотрудники"],
          ["requests", "Все заявки"],
          ["routes", "Маршруты"],
          ["catalogs", "Справочники"],
          ["audit", "Журнал действий"],
        ].map(([path, label]) => (
          <Link
            key={path}
            href={`/admin/${path}`}
            className={
              pathname.startsWith(`/admin/${path}`) ? "tab-active" : ""
            }
            aria-current={
              pathname.startsWith(`/admin/${path}`) ? "page" : undefined
            }
          >
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
