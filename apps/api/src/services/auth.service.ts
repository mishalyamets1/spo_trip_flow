import { randomBytes } from "node:crypto";
import { ensure } from "../errors.js";
import { verifyPassword, tokenHash } from "../utils/crypto.js";
import * as auth from "../repositories/auth.repository.js";

export async function login(email: string, password: string) {
  const account = await auth.findAccountByEmail(email.toLowerCase());
  const valid = await verifyPassword(password, account?.password_hash || "");
  ensure(valid && account?.is_active, 401, "Неверная почта или пароль");
  const user = await auth.findUserById(account.id);
  ensure(user, 403, "Учётная запись не связана с сотрудником");
  const token = randomBytes(32).toString("hex");
  await auth.deleteExpiredSessions();
  await auth.createSession(tokenHash(token), user.id);
  return { user, token };
}
export async function getSession(token: string | undefined) {
  ensure(token && /^[a-f0-9]{64}$/.test(token), 401, "Войдите в систему");
  const sessionHash = tokenHash(token);
  const user = await auth.findSessionUser(sessionHash);
  ensure(user, 401, "Сессия истекла. Войдите снова");
  return { user, sessionHash };
}
export async function logout(hash: string) {
  await auth.deleteSession(hash);
}
