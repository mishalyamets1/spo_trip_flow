import { test, expect } from "@jest/globals";
import { hashPassword, verifyPassword } from "../apps/api/src/utils/crypto.js";
test("пароли: рабочий хэш проверяется, повреждённый хэш не вызывает 500", async () => {
  const password = "TripFlow-private-test-password!";
  const hash = await hashPassword(password);
  expect(await verifyPassword(password, hash)).toBe(true);
  expect(await verifyPassword("wrong", hash)).toBe(false);
  const salt = "a".repeat(32);
  for (const malformed of [
    "",
    "TEST_HASH_NOT_FOR_AUTH",
    `scrypt:${salt}:${"z".repeat(128)}`,
    `${hash}:extra`,
  ]) {
    expect(await verifyPassword(password, malformed)).toBe(false);
  }
});
