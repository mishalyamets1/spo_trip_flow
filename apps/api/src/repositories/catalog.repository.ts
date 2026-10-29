import { pool } from "../db.js";
export async function listExpenseCategories() {
  return (
    await pool.query(
      "SELECT id::text,code,name FROM expense_categories ORDER BY id",
    )
  ).rows;
}
