import "server-only";
import { uuidSchema } from "@/lib/validation";

/**
 * Identificativo anonimo del partecipante (UUID casuale in cookie httpOnly).
 * Non contiene dati personali: serve solo a impedire più risposte
 * nella stessa giornata dallo stesso browser.
 */
export const PARTICIPANT_COOKIE = "qdg_pid";

export function parseParticipantId(value: string | undefined | null): string | null {
  if (!value) return null;
  return uuidSchema.safeParse(value).success ? value : null;
}

export function participantCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}
