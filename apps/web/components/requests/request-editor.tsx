"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { requestsApi } from "../../services/requests";
import { useResource } from "../../hooks/use-resource";
import { useApiAction } from "../../hooks/use-api-action";
import { useAuth } from "../../providers/auth-provider";
import type { TripInput } from "../../types";
import { ErrorAlert, Loading } from "../ui/feedback";
import { RequestForm } from "./request-form";
export function RequestEditor({ id }: { id?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const load = useCallback(async () => {
    const [categories, request] = await Promise.all([
      requestsApi.categories(),
      id ? requestsApi.get(id) : Promise.resolve(null),
    ]);
    return { categories, request };
  }, [id]);
  const { data, loading, error, reload } = useResource(load);
  const action = useApiAction();
  async function save(input: TripInput) {
    await action.run(async () => {
      const result =
        id && data?.request
          ? await requestsApi.update(id, input, data.request.version)
          : await requestsApi.create(input);
      router.push(`/requests/${result.id}`);
    });
  }
  const request = data?.request;
  const editable =
    user?.roles.includes("EMPLOYEE") &&
    (!id ||
      (request?.employee_id === user.employee_id &&
        request?.status === "DRAFT"));
  return (
    <>
      <Link
        className="text-button back"
        href={id ? `/requests/${id}` : "/requests"}
      >
        ← Назад
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ПОДГОТОВКА ПОЕЗДКИ</p>
          <h1>{id ? "Редактирование заявки" : "Новая заявка"}</h1>
          <p className="muted">
            Сначала сохраните черновик, затем отправьте его на согласование.
          </p>
        </div>
      </div>
      <ErrorAlert
        message={error || action.error}
        onRetry={() => {
          action.clearError();
          reload();
        }}
        retryLabel="Обновить данные"
      />
      {loading ? (
        <Loading>Загружаем данные формы…</Loading>
      ) : (
        data &&
        (editable ? (
          <RequestForm
            key={request ? `${request.id}:${request.version}` : "new"}
            initial={request ?? null}
            categories={data.categories}
            busy={action.busy}
            onSave={save}
          />
        ) : (
          <ErrorAlert message="Можно редактировать только собственный черновик. Создание заявок доступно сотрудникам." />
        ))
      )}
    </>
  );
}
