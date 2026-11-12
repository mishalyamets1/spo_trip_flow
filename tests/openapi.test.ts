import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

test("OpenAPI: все внутренние ссылки и параметры путей разрешаются", () => {
  const document = parse(
    readFileSync(new URL("../docs/api/openapi.yaml", import.meta.url), "utf8"),
  );
  assert.equal(document.openapi, "3.1.0");
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    if (typeof node.$ref === "string") {
      assert.ok(
        node.$ref.startsWith("#/"),
        "Контракт должен проверяться без внешней сети",
      );
      let target: unknown = document;
      for (const part of node.$ref.slice(2).split("/"))
        target = (target as Record<string, unknown>)?.[
          part.replaceAll("~1", "/").replaceAll("~0", "~")
        ];
      assert.ok(target, `Отсутствует ${node.$ref}`);
    }
    Object.values(node).forEach(visit);
  }
  visit(document);
  for (const [path, methods] of Object.entries(document.paths)) {
    for (const operation of Object.values(methods as Record<string, any>)) {
      for (const match of path.matchAll(/\{([^}]+)\}/g)) {
        assert.ok(
          operation.parameters?.some(
            (p: any) => p.in === "path" && p.name === match[1] && p.required,
          ),
          `${path}: не описан параметр ${match[1]}`,
        );
      }
    }
  }
});
