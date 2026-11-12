import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

export const config = {
  port: Number(process.env.API_PORT || 4000),
  origin: process.env.APP_ORIGIN || "http://localhost:3000",
  secureCookie: process.env.COOKIE_SECURE === "true",
  databaseUrl: process.env.PGHOST ? undefined : process.env.DATABASE_URL,
};
// Local Docker deployments support both loopback names on the configured port.
const appOrigin = new URL(config.origin);
const localOrigins = ["localhost", "127.0.0.1"].includes(appOrigin.hostname)
  ? ["localhost", "127.0.0.1"].map((hostname) => {
      const origin = new URL(appOrigin);
      origin.hostname = hostname;
      return origin.origin;
    })
  : [];

// Next.js uses 3001 when Docker already occupies 3000.
export const allowedOrigins = new Set([
  config.origin,
  ...localOrigins,
  ...(process.env.NODE_ENV !== "production"
    ? [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
      ]
    : []),
]);

if (!config.databaseUrl && !process.env.PGHOST)
  throw new Error("DATABASE_URL or PGHOST is required");
