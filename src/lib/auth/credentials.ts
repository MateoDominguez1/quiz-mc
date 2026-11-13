import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { getAdminEnv } from "@/lib/env";

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Confronto a tempo costante (evita timing attack su utente e password). */
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const env = getAdminEnv();
  const userOk = safeEqual(username, env.username);
  const passOk = safeEqual(password, env.password);
  return userOk && passOk;
}
