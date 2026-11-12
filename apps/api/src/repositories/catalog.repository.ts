import { pool } from "../db.js";
export async function listExpenseCategories() {
  return (
    await pool.query(
      "SELECT id::text,code,name FROM expense_categories WHERE is_active ORDER BY id",
    )
  ).rows;
}
