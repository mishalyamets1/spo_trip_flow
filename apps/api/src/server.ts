import { app } from "./app.js";
import { pool } from "./db.js";
import { config } from "./config.js";

const server = app.listen(config.port, "0.0.0.0", () =>
  console.log(`TripFlow API listening on ${config.port}`),
);
let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    const timer = setTimeout(() => process.exit(1), 10000).unref();
    server.close(() => {
      void pool.end().then(() => {
        clearTimeout(timer);
        process.exit(0);
      });
    });
  });
