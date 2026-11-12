import { z } from "zod";
export const catalogKindSchema = z.enum(["departments", "expense-categories"]);
export type CatalogKind = z.infer<typeof catalogKindSchema>;
export const catalogInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]*$/)
    .max(30)
    .optional(),
  is_active: z.boolean(),
  version: z.number().int().positive().optional(),
});
export const catalogUpdateSchema = catalogInputSchema.extend({
  version: z.number().int().positive(),
});
export type CatalogInput = z.infer<typeof catalogInputSchema>;
