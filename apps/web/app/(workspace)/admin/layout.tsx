import { Suspense, type ReactNode } from "react";
import { AdminShell } from "../../../components/admin/admin-shell";
import { Loading } from "../../../components/ui/feedback";
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminShell>
      <Suspense fallback={<Loading>Загружаем раздел…</Loading>}>
        {children}
      </Suspense>
    </AdminShell>
  );
}
