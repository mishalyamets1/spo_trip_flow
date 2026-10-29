import type { RequestHandler } from "express";
import { getSession } from "../services/auth.service.js";
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = req.headers.cookie
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("tripflow_session="))
    ?.slice(17);
  const session = await getSession(token);
  req.user = session.user;
  req.sessionHash = session.sessionHash;
  next();
};
