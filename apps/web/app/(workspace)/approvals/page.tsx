import { ApprovalList } from "../../../components/approvals/approval-list";
import { Suspense } from "react";
import { Loading } from "../../../components/ui/feedback";
export const metadata = { title: "Согласование — TripFlow" };
export default function ApprovalsPage() {
  return (
    <Suspense fallback={<Loading>Загружаем согласование…</Loading>}>
      <ApprovalList />
    </Suspense>
  );
}
