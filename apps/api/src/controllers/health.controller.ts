import type { RequestHandler } from "express";
import { getLiveness, getReadiness } from "../services/health.service.js";
export const live: RequestHandler = (_req, res) => {
  res.json(getLiveness());
};
export const ready: RequestHandler = async (_req, res) => {
  res.json(await getReadiness());
};
