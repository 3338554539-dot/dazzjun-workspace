import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const PASSWORD_ITERATIONS = 100_000;

export function hashPassword(password, salt = randomBytes(18).toString("base64url")) {
  const hash = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 32, "sha256").toString("base64url");
  return { salt, hash };
}

export function verifyPassword(password, salt, expectedHash) {
  const candidate = Buffer.from(hashPassword(password, salt).hash);
  const expected = Buffer.from(expectedHash);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("base64url");
}
