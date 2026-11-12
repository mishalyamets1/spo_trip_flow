import { test, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
test("OpenAPI: все внутренние ссылки и параметры путей разрешаются", () => {
  const document = parse(
    readFileSync(new URL("../docs/api/openapi.yaml", import.meta.url), "utf8"),
  );
  expect(document.openapi).toBe("3.1.0");
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    if (typeof node.$ref === "string") {
      expect(node.$ref.startsWith("#/")).toBeTruthy();
      let target: unknown = document;
      for (const part of node.$ref.slice(2).split("/"))
        target = (target as Record<string, unknown>)?.[
          part.replaceAll("~1", "/").replaceAll("~0", "~")
        ];
      expect(target).toBeTruthy();
    }
    Object.values(node).forEach(visit);
  }
  visit(document);
  for (const [path, methods] of Object.entries(document.paths)) {
    for (const operation of Object.values(methods as Record<string, any>)) {
      for (const match of path.matchAll(/\{([^}]+)\}/g)) {
        expect(
          operation.parameters?.some(
            (p: any) => p.in === "path" && p.name === match[1] && p.required,
          ),
        ).toBeTruthy();
      }
    }
  }
});
