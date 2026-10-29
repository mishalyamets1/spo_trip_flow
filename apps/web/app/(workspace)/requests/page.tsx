import { Suspense } from "react";
import { RequestList } from "../../../components/requests/request-list";
import { Loading } from "../../../components/ui/feedback";
export const metadata = { title: "Мои заявки — TripFlow" };
export default function RequestsPage() {
  return (
    <Suspense fallback={<Loading>Загружаем список…</Loading>}>
      <RequestList />
    </Suspense>
  );
}
