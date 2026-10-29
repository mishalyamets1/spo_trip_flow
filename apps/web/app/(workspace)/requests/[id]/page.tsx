import { notFound } from "next/navigation";
import { RequestDetail } from "../../../../components/requests/request-detail";
export const metadata = { title: "Карточка заявки — TripFlow" };
export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  if (!/^[1-9]\d{0,17}$/.test(id)) notFound();
  const { from } = await searchParams;
  return (
    <RequestDetail key={id} id={id} fromApprovals={from === "approvals"} />
  );
}
