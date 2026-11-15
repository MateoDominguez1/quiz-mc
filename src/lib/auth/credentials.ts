import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { getStaffCredentials, type StaffRole } from "@/lib/env";

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Confronto a tempo costante (evita timing attack su utente e password). */
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

export function verifyStaffCredentials(role: StaffRole, username: string, password: string): boolean {
  const env = getStaffCredentials(role);
  const userOk = safeEqual(username, env.username);
  const passOk = safeEqual(password, env.password);
  return userOk && passOk;
}
