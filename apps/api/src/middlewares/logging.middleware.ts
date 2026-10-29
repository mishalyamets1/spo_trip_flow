import type { RequestHandler } from "express";
import { randomUUID } from "node:crypto";
export const requestLogger: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("Cache-Control", "no-store");
  const start = Date.now();
  const path = req.path;
  res.on("finish", () =>
    console.log(
      JSON.stringify({
        requestId,
        method: req.method,
        path,
        status: res.statusCode,
        durationMs: Date.now() - start,
      }),
    ),
  );
  next();
};
