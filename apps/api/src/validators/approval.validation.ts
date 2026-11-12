import { z } from "zod";
import type { ApprovalFilters } from "../types/approval.js";

export const approvalFilterSchema: z.ZodType<ApprovalFilters> = z
  .object({
    view: z.enum(["pending", "processed"]).default("pending"),
    decision: z.enum(["APPROVED", "REJECTED"]).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    "Неверный период",
  )
  .refine(
    (value) => value.view === "processed" || !value.decision,
    "Фильтр решения доступен во вкладке обработанных заявок",
  );
