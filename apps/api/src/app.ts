import express from "express";
import helmet from "helmet";
import { apiRoutes } from "./routes/index.js";
import { requestLogger } from "./middlewares/logging.middleware.js";
import { validateOrigin } from "./middlewares/origin.middleware.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { HttpError } from "./errors.js";

export const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(requestLogger);
app.use(express.json({ limit: "128kb" }));
app.use(validateOrigin);
app.use("/api", apiRoutes);
app.use((_req, _res, next) => next(new HttpError(404, "Маршрут не найден")));
app.use(errorHandler);
