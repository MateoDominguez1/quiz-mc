import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getSession } from "@/lib/auth/session";
import { uuidSchema } from "@/lib/validation";

/**
 * Token dei QR: 32 byte casuali (256 bit) in base64url, imprevedibili.
 * Nel database viene salvato solo lo SHA-256 del token.
 */
export function generateEntryToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashEntryToken(token) };
}

export function hashEntryToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isWellFormedEntryToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** ID del partecipante dalla sessione firmata (cookie httpOnly), o null. */
export async function getParticipantId(): Promise<string | null> {
  const session = await getSession("participant");
  if (!session) return null;
  return uuidSchema.safeParse(session.subject).success ? session.subject : null;
}
