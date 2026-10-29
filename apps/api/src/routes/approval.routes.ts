import { Router } from "express";
import * as approvals from "../controllers/approval.controller.js";
export const approvalRoutes = Router();
approvalRoutes.get("/", approvals.list);
approvalRoutes.post("/:id/approve", approvals.approve);
approvalRoutes.post("/:id/reject", approvals.reject);
