export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return undefined as T;
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError(
      "Сервис временно недоступен. Попробуйте ещё раз",
      response.status,
    );
  }
  const result = await response.json();
  if (!response.ok) {
    const fields = result.error?.fields
      ?.map((f: { path: string; message: string }) => `${f.path}: ${f.message}`)
      .join("; ");
    throw new ApiError(
      fields || result.error?.message || "Не удалось выполнить запрос",
      response.status,
    );
  }
  return result;
}

export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Нет связи с сервером. Попробуйте ещё раз";
}
