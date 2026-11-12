import express from "express";
import helmet from "helmet";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const assets = dirname(require.resolve("swagger-ui-dist/package.json"));
const specification = fileURLToPath(
  new URL("../../../../docs/api/openapi.yaml", import.meta.url),
);

export const docsRoutes = express.Router();

// Keep local HTTP assets on HTTP; all scripts and styles are served locally.
docsRoutes.use(
  helmet.contentSecurityPolicy({
    directives: { upgradeInsecureRequests: null },
  }),
);
docsRoutes.get("/openapi.yaml", (_req, res) => res.sendFile(specification));
docsRoutes.get("/swagger-init.js", (_req, res) => {
  res.type("application/javascript").send(`window.onload = function () {
    window.ui = SwaggerUIBundle({
      url: '/docs/openapi.yaml',
      dom_id: '#swagger-ui',
      deepLinking: true,
      validatorUrl: null
    });
  };`);
});
docsRoutes.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>TripFlow API — документация</title>
    <link rel="stylesheet" href="/docs/swagger-ui.css">
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/docs/swagger-ui-bundle.js"></script>
    <script src="/docs/swagger-init.js"></script>
  </body>
</html>`);
});
docsRoutes.use(express.static(assets, { index: false, redirect: false }));
