import { ensure } from "../errors.js";
import type { User } from "../types/user.js";
import type {
  CatalogKind,
  CatalogInput,
} from "../validators/catalog.validation.js";
import * as catalogs from "../repositories/admin-catalog.repository.js";
import { audit } from "../repositories/admin.repository.js";
import { adminTransaction } from "./admin.service.js";
export async function save(
  user: User,
  kind: CatalogKind,
  input: CatalogInput,
  id?: string,
) {
  ensure(
    kind !== "expense-categories" || input.code,
    400,
    "Укажите код категории",
  );
  await adminTransaction(user, async (client) => {
    if (id) {
      const old = await catalogs.lock(client, kind, id);
      ensure(old, 404, "Значение справочника не найдено");
      ensure(
        old.version === input.version,
        409,
        "Справочник уже изменён. Обновите список",
      );
    }
    const saved = await catalogs.save(client, kind, input, id);
    await audit(
      client,
      user,
      id ? "catalog.update" : "catalog.create",
      kind,
      saved,
      id ? "Изменение справочника" : "Создание значения справочника",
      { name: input.name, is_active: input.is_active },
    );
  });
  return { items: await catalogs.list(kind) };
}
export async function remove(
  user: User,
  kind: CatalogKind,
  id: string,
  version: number,
) {
  await adminTransaction(user, async (client) => {
    const old = await catalogs.lock(client, kind, id);
    ensure(old, 404, "Значение справочника не найдено");
    ensure(
      old.version === version,
      409,
      "Справочник уже изменён. Обновите список",
    );
    const current = (await catalogs.list(kind, client)).find(
      (e) => e.id === id,
    )!;
    ensure(
      current.reference_count === 0,
      409,
      "Значение используется. Отключите его вместо удаления",
    );
    await catalogs.remove(client, kind, id);
    await audit(
      client,
      user,
      "catalog.delete",
      kind,
      id,
      "Удаление неиспользуемого значения",
      { name: old.name },
    );
  });
}
