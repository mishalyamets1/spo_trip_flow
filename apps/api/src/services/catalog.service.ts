import { listExpenseCategories } from "../repositories/catalog.repository.js";
export async function getExpenseCategories() {
  return { items: await listExpenseCategories() };
}
