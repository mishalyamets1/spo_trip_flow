import { EmployeeEditor } from "../../../../../components/admin/employee-editor";
export const metadata = { title: "Администрирование — TripFlow" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EmployeeEditor id={id} />;
}
