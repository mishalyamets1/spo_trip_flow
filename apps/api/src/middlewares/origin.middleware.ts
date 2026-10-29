import type { RequestHandler } from "express";
import { allowedOrigins } from "../config.js";
import { ensure } from "../errors.js";
export const validateOrigin: RequestHandler = (req, _res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    ensure(
      allowedOrigins.has(req.headers.origin || ""),
      403,
      "Недопустимый источник запроса",
    );
    ensure(req.is("application/json"), 415, "Требуется application/json");
  }
  next();
};
