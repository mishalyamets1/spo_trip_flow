import type { RequestHandler, CookieOptions } from "express";
import { config } from "../config.js";
import { loginSchema } from "../validators/auth.validation.js";
import * as auth from "../services/auth.service.js";

const cookieOptions: CookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  secure: config.secureCookie,
};
export const login: RequestHandler = async (req, res) => {
  const body = loginSchema.parse(req.body);
  const { user, token } = await auth.login(body.email, body.password);
  res.cookie("tripflow_session", token, {
    ...cookieOptions,
    maxAge: 8 * 60 * 60 * 1000,
  });
  res.json(user);
};
export const me: RequestHandler = (req, res) => {
  res.json(req.user);
};
export const logout: RequestHandler = async (req, res) => {
  await auth.logout(req.sessionHash);
  res.clearCookie("tripflow_session", cookieOptions);
  res.status(204).end();
};
