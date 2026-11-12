import { safeReturnPath } from "../../../../lib/navigation";
import { notFound } from "next/navigation";
import { RequestDetail } from "../../../../components/requests/request-detail";
export const metadata = { title: "Карточка заявки — TripFlow" };
export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; returnTo?: string }>;
}) {
  const { id } = await params;
  if (!/^[1-9]\d{0,17}$/.test(id)) notFound();
  const { from, returnTo } = await searchParams;
  const candidate = safeReturnPath(returnTo || "/approvals");
  const backHref =
    from === "approvals"
      ? candidate.split("?")[0] === "/approvals"
        ? candidate
        : "/approvals"
      : "/requests";
  return <RequestDetail key={id} id={id} backHref={backHref} />;
}
