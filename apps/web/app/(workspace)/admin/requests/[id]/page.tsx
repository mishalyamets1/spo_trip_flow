import { AdminRequestDetail } from "../../../../../components/admin/admin-request-detail";
export const metadata = { title: "Администрирование — TripFlow" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminRequestDetail id={id} />;
}
