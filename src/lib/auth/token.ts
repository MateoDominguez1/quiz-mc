import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { getSessionSecret, getStaffCredentials, type StaffRole } from "@/lib/env";

/**
 * Sessioni firmate (JWT HS256) in cookie httpOnly. Ogni ruolo ha un proprio
 * cookie e una propria "audience": un token della postazione non vale per
 * /admin e viceversa. "game" contiene solo l'ID della partita in corso sul
 * dispositivo (ricaricando la pagina la partita continua).
 */
export type SessionRole = StaffRole | "game";

const CONFIG: Record<SessionRole, { cookie: string; audience: string; seconds: number }> = {
  admin: { cookie: "qz_admin", audience: "quiz-admin", seconds: 60 * 60 * 8 },
  // Il dispositivo resta abilitato per tutta la durata dell'iniziativa.
  postazione: { cookie: "qz_station", audience: "quiz-station", seconds: 60 * 60 * 24 * 45 },
  game: { cookie: "qz_game", audience: "quiz-game", seconds: 60 * 60 * 12 },
};

export const SESSION_COOKIE: Record<SessionRole, string> = {
  admin: CONFIG.admin.cookie,
  postazione: CONFIG.postazione.cookie,
  game: CONFIG.game.cookie,
};

export interface Session {
  role: SessionRole;
  subject: string;
  expiresAt: number;
}

function key(): Uint8Array {
  return new TextEncoder().encode(getSessionSecret());
}

export async function signSession(role: SessionRole, subject: string): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setIssuedAt()
    .setIssuer("il-quiz")
    .setAudience(CONFIG[role].audience)
    .setExpirationTime(`${CONFIG[role].seconds}s`)
    .sign(key());
}

/** Verifica firma, scadenza, ruolo e (per il personale) l'utente configurato. */
export async function verifySession(role: SessionRole, token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
      issuer: "il-quiz",
      audience: CONFIG[role].audience,
    });
    if (payload.role !== role || typeof payload.sub !== "string") return null;
    // Se l'utente del personale cambia nelle variabili d'ambiente, le sessioni decadono.
    if (role !== "game" && payload.sub !== getStaffCredentials(role).username) return null;
    return { role, subject: payload.sub, expiresAt: (payload.exp ?? 0) * 1000 };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(role: SessionRole, maxAge = CONFIG[role].seconds) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}
