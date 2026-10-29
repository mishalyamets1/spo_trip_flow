import { z } from "zod";
import type { RequestInput } from "../types/request.js";

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(value);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Некорректная дата");

export const idSchema = z.string().regex(/^[1-9]\d{0,17}$/);
export const versionSchema = z.object({ version: z.number().int().positive() });
export const requestSchema: z.ZodType<RequestInput> = z
  .object({
    destination_country: z.string().trim().min(1).max(100),
    destination_city: z.string().trim().min(1).max(120),
    purpose: z.string().trim().min(10).max(1000),
    start_date: date,
    end_date: date,
    transport_type: z.enum(["AIR", "RAIL", "CAR", "BUS", "OTHER"]),
    accommodation_required: z.boolean(),
    currency: z.literal("RUB"),
    employee_comment: z.string().trim().max(2000).default(""),
    expenses: z
      .array(
        z.object({
          category_id: idSchema,
          amount: z.string().regex(/^\d{1,12}(\.\d{1,2})?$/),
          description: z.string().trim().max(300).default(""),
        }),
      )
      .max(100),
    version: z.number().int().positive().optional(),
  })
  .refine((value) => value.end_date >= value.start_date, {
    message: "Дата окончания раньше даты начала",
    path: ["end_date"],
  });

export const requestFilterSchema = z
  .object({
    status: z
      .enum([
        "DRAFT",
        "SUBMITTED",
        "UNDER_REVIEW",
        "APPROVED",
        "REJECTED",
        "CANCELED",
      ])
      .optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .refine((x) => !x.from || !x.to || x.from <= x.to, "Неверный период");
export const decisionSchema = versionSchema.extend({
  comment: z.string().trim().max(2000).default(""),
});
