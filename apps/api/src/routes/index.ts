import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { authenticate } from "../middlewares/auth.middleware.js";
import * as auth from "../controllers/auth.controller.js";
import * as health from "../controllers/health.controller.js";
import { listExpenseCategories } from "../controllers/catalog.controller.js";
import { requestRoutes } from "./request.routes.js";
import { approvalRoutes } from "./approval.routes.js";

export const apiRoutes = Router();
apiRoutes.get("/health/live", health.live);
apiRoutes.get("/health/ready", health.ready);
apiRoutes.post(
  "/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: { message: "Слишком много попыток входа. Попробуйте позже" },
    },
  }),
  auth.login,
);
apiRoutes.use(authenticate);
apiRoutes.get("/auth/me", auth.me);
apiRoutes.post("/auth/logout", auth.logout);
apiRoutes.get("/expense-categories", listExpenseCategories);
apiRoutes.use("/requests", requestRoutes);
apiRoutes.use("/approvals", approvalRoutes);
