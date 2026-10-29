import type { RequestHandler } from "express";
import {
  idSchema,
  requestSchema,
  versionSchema,
  requestFilterSchema,
} from "../validators/request.validation.js";
import * as requests from "../services/request.service.js";

export const list: RequestHandler = async (req, res) => {
  res.json(
    await requests.listRequests(req.user, requestFilterSchema.parse(req.query)),
  );
};
export const create: RequestHandler = async (req, res) => {
  res
    .status(201)
    .json(await requests.saveRequest(req.user, requestSchema.parse(req.body)));
};
export const get: RequestHandler = async (req, res) => {
  res.json(await requests.getRequest(req.user, idSchema.parse(req.params.id)));
};
export const history: RequestHandler = async (req, res) => {
  const data = await requests.getRequest(
    req.user,
    idSchema.parse(req.params.id),
  );
  res.json({ items: data.history });
};
export const update: RequestHandler = async (req, res) => {
  res.json(
    await requests.saveRequest(
      req.user,
      requestSchema.parse(req.body),
      idSchema.parse(req.params.id),
    ),
  );
};
export const remove: RequestHandler = async (req, res) => {
  await requests.deleteRequest(
    req.user,
    idSchema.parse(req.params.id),
    versionSchema.parse(req.body).version,
  );
  res.status(204).end();
};
export const submit: RequestHandler = async (req, res) => {
  res.json(
    await requests.submitRequest(
      req.user,
      idSchema.parse(req.params.id),
      versionSchema.parse(req.body).version,
    ),
  );
};
