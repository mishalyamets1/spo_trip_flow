import type { RequestInput } from "../types/request.js";

export function totalAmount(expenses: RequestInput["expenses"]): string {
  const cents = expenses.reduce((sum, item) => {
    const [whole, fraction = ""] = item.amount.split(".");
    return sum + BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  }, 0n);
  if (cents > 99999999999999n) throw new Error("TOTAL_OVERFLOW");
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}
