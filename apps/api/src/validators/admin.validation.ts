import { z } from "zod";
import {
  idSchema,
  requestFilterSchema,
  cancellationSchema,
} from "./request.validation.js";
export const adminEmployeeFilter = z.object({
  q: z.string().trim().max(200).optional(),
  department_id: idSchema.optional(),
  active: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export const adminRequestFilter = requestFilterSchema.safeExtend({
  q: z.string().trim().max(200).optional(),
  employee_id: idSchema.optional(),
  department_id: idSchema.optional(),
});
export const employeeFields = z.object({
  full_name: z.string().trim().min(5).max(200),
  email: z.email().trim().toLowerCase().max(254),
  employee_number: z.string().trim().min(1).max(30),
  position: z.string().trim().min(1).max(150),
  department_id: idSchema,
  phone: z.string().trim().max(30).default(""),
  hire_date: z.iso.date(),
  roles: z
    .array(z.enum(["EMPLOYEE", "APPROVER", "ADMIN"]))
    .min(1)
    .max(3)
    .refine((v) => new Set(v).size === v.length),
  is_active: z.boolean(),
});
export const createEmployeeSchema = employeeFields.extend({
  password: z.string().min(12).max(128),
});
export const updateEmployeeSchema = employeeFields.extend({
  version: z.number().int().positive(),
});
export const deleteEmployeeSchema = cancellationSchema.extend({
  replacement_employee_id: idSchema.optional(),
  expected_request_count: z.number().int().nonnegative(),
});
export const reassignSchema = cancellationSchema.extend({
  approver_employee_id: idSchema,
});
export const routeSchema = z.object({
  department_id: idSchema,
  name: z.string().trim().min(1).max(150),
  is_active: z.boolean(),
  version: z.number().int().nonnegative(),
  approver_ids: z
    .array(idSchema)
    .min(1)
    .max(20)
    .refine(
      (v) => new Set(v).size === v.length,
      "Согласующие не должны повторяться",
    ),
});
export type EmployeeInput = z.infer<typeof employeeFields>;
