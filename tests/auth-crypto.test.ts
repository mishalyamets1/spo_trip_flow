import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../apps/api/src/utils/crypto.js";

test("пароли: рабочий хэш проверяется, повреждённый хэш не вызывает 500", async () => {
  const password = "TripFlow-private-test-password!";
  const hash = await hashPassword(password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("wrong", hash), false);
  const salt = "a".repeat(32);
  for (const malformed of [
    "",
    "TEST_HASH_NOT_FOR_AUTH",
    `scrypt:${salt}:${"z".repeat(128)}`,
    `${hash}:extra`,
  ]) {
    assert.equal(await verifyPassword(password, malformed), false);
  }
});
