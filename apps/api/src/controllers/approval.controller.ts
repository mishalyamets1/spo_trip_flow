import type { RequestHandler } from "express";
import { decisionSchema, idSchema } from "../validators/request.validation.js";
import * as approvals from "../services/approval.service.js";
import { approvalFilterSchema } from "../validators/approval.validation.js";

export const list: RequestHandler = async (req, res) => {
  res.json(
    await approvals.listApprovals(
      req.user,
      approvalFilterSchema.parse(req.query),
    ),
  );
};
function decision(approved: boolean): RequestHandler {
  return async (req, res) => {
    const body = decisionSchema.parse(req.body);
    res.json(
      await approvals.decide(
        req.user,
        idSchema.parse(req.params.id),
        body.version,
        approved,
        body.comment,
      ),
    );
  };
}
export const approve = decision(true);
export const reject = decision(false);
