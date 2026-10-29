import { checkDatabase } from "../repositories/health.repository.js";
export function getLiveness() {
  return { status: "ok" };
}
export async function getReadiness() {
  await checkDatabase();
  return { status: "ready" };
}
