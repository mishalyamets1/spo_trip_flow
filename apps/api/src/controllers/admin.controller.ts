import type { RequestHandler } from "express";
import {
  idSchema,
  cancellationSchema,
} from "../validators/request.validation.js";
import * as validation from "../validators/admin.validation.js";
import * as service from "../services/admin.service.js";
import * as repo from "../repositories/admin.repository.js";
export const metadata: RequestHandler = async (_req, res) => {
  res.json(await repo.metadata());
};
export const employees: RequestHandler = async (req, res) => {
  res.json(
    await repo.listEmployees(validation.adminEmployeeFilter.parse(req.query)),
  );
};
export const employee: RequestHandler = async (req, res) => {
  res.json(await service.employeePreview(idSchema.parse(req.params.id)));
};
export const createEmployee: RequestHandler = async (req, res) => {
  res
    .status(201)
    .json(
      await service.createEmployee(
        req.user,
        validation.createEmployeeSchema.parse(req.body),
      ),
    );
};
export const updateEmployee: RequestHandler = async (req, res) => {
  res.json(
    await service.updateEmployee(
      req.user,
      idSchema.parse(req.params.id),
      validation.updateEmployeeSchema.parse(req.body),
    ),
  );
};
export const deleteEmployee: RequestHandler = async (req, res) => {
  res.json(
    await service.deleteEmployee(
      req.user,
      idSchema.parse(req.params.id),
      validation.deleteEmployeeSchema.parse(req.body),
    ),
  );
};
export const requests: RequestHandler = async (req, res) => {
  res.json(
    await repo.listRequests(validation.adminRequestFilter.parse(req.query)),
  );
};
export const request: RequestHandler = async (req, res) => {
  res.json(await service.getRequest(idSchema.parse(req.params.id)));
};
export const cancel: RequestHandler = async (req, res) => {
  const b = cancellationSchema.parse(req.body);
  res.json(
    await service.cancelRequest(
      req.user,
      idSchema.parse(req.params.id),
      b.version,
      b.reason,
    ),
  );
};
export const reassign: RequestHandler = async (req, res) => {
  const b = validation.reassignSchema.parse(req.body);
  res.json(
    await service.reassign(
      req.user,
      idSchema.parse(req.params.id),
      b.version,
      b.approver_employee_id,
      b.reason,
    ),
  );
};
export const routes: RequestHandler = async (_req, res) => {
  res.json({ items: await repo.routes() });
};
export const createRoute: RequestHandler = async (req, res) => {
  res.status(201).json({
    items: await service.saveRoute(
      req.user,
      validation.routeSchema.parse(req.body),
    ),
  });
};
export const updateRoute: RequestHandler = async (req, res) => {
  res.json({
    items: await service.saveRoute(
      req.user,
      validation.routeSchema.parse(req.body),
      idSchema.parse(req.params.id),
    ),
  });
};
export const audit: RequestHandler = async (req, res) => {
  res.json(
    await repo.listAudit(validation.adminEmployeeFilter.parse(req.query).page),
  );
};
