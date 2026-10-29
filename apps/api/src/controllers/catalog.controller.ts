import type { RequestHandler } from "express";
import { getExpenseCategories } from "../services/catalog.service.js";
export const listExpenseCategories: RequestHandler = async (_req, res) => {
  res.json(await getExpenseCategories());
};
