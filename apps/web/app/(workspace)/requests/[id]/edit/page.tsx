import { notFound } from "next/navigation";
import { RequestEditor } from "../../../../../components/requests/request-editor";
export const metadata = { title: "Редактирование заявки — TripFlow" };
export default async function EditRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[1-9]\d{0,17}$/.test(id)) notFound();
  return <RequestEditor key={id} id={id} />;
}
