import { Router } from "express";
import { ensure } from "../errors.js";
import * as c from "../controllers/admin.controller.js";
export const adminRoutes = Router();
adminRoutes.use((req, _res, next) => {
  ensure(
    req.user.roles.includes("ADMIN"),
    403,
    "Раздел доступен только администратору",
  );
  next();
});
adminRoutes.get("/metadata", c.metadata);
adminRoutes.get("/employees", c.employees);
adminRoutes.get("/employees/:id", c.employee);
adminRoutes.post("/employees", c.createEmployee);
adminRoutes.patch("/employees/:id", c.updateEmployee);
adminRoutes.delete("/employees/:id", c.deleteEmployee);
adminRoutes.get("/requests", c.requests);
adminRoutes.get("/requests/:id", c.request);
adminRoutes.post("/requests/:id/cancel", c.cancel);
adminRoutes.post("/requests/:id/reassign", c.reassign);
adminRoutes.get("/routes", c.routes);
adminRoutes.post("/routes", c.createRoute);
adminRoutes.patch("/routes/:id", c.updateRoute);
adminRoutes.get("/audit", c.audit);
