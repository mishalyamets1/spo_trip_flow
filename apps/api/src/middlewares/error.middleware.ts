import type express from "express";
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../errors.js";
export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        message: "Проверьте заполнение полей",
        fields: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
    });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: { message: error.message } });
    return;
  }
  const code = (error as { code?: string })?.code;
  const httpStatus = (error as { status?: number })?.status;
  if (httpStatus === 400 || httpStatus === 413) {
    res.status(httpStatus).json({
      error: {
        message:
          httpStatus === 413 ? "Запрос слишком большой" : "Некорректный JSON",
      },
    });
    return;
  }
  if (code && ["23503", "23514", "22003", "22007", "22008"].includes(code)) {
    res.status(400).json({
      error: {
        message:
          "Данные нарушают ограничения: проверьте даты, суммы и справочники",
      },
    });
    return;
  }
  if (code === "23505") {
    res.status(409).json({ error: { message: "Запись уже существует" } });
    return;
  }
  const unavailable =
    code &&
    (code.startsWith("08") ||
      [
        "ECONNREFUSED",
        "ENOTFOUND",
        "EAI_AGAIN",
        "ECONNRESET",
        "EPIPE",
        "ETIMEDOUT",
        "57P01",
        "57P02",
        "57P03",
        "53300",
      ].includes(code));
  console.error(
    JSON.stringify({
      event: "request_error",
      requestId: res.getHeader("X-Request-Id"),
      code: code || "INTERNAL",
    }),
  );
  res.status(unavailable ? 503 : 500).json({
    error: {
      message: unavailable
        ? "База данных временно недоступна"
        : "Внутренняя ошибка сервера",
      requestId: res.getHeader("X-Request-Id"),
    },
  });
};
