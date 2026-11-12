import type { RequestHandler } from "express";
import { idSchema, versionSchema } from "../validators/request.validation.js";
import {
  catalogKindSchema,
  catalogInputSchema,
  catalogUpdateSchema,
} from "../validators/catalog.validation.js";
import * as repo from "../repositories/admin-catalog.repository.js";
import * as service from "../services/admin-catalog.service.js";
export const list: RequestHandler = async (req, res) => {
  res.json({
    items: await repo.list(catalogKindSchema.parse(req.params.kind)),
  });
};
export const create: RequestHandler = async (req, res) => {
  res
    .status(201)
    .json(
      await service.save(
        req.user,
        catalogKindSchema.parse(req.params.kind),
        catalogInputSchema.parse(req.body),
      ),
    );
};
export const update: RequestHandler = async (req, res) => {
  res.json(
    await service.save(
      req.user,
      catalogKindSchema.parse(req.params.kind),
      catalogUpdateSchema.parse(req.body),
      idSchema.parse(req.params.id),
    ),
  );
};
export const remove: RequestHandler = async (req, res) => {
  await service.remove(
    req.user,
    catalogKindSchema.parse(req.params.kind),
    idSchema.parse(req.params.id),
    versionSchema.parse(req.body).version,
  );
  res.status(204).end();
};
