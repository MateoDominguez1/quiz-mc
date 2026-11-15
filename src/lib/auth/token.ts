import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { getSessionSecret, getStaffCredentials, type StaffRole } from "@/lib/env";

/**
 * Sessioni firmate (JWT HS256) in cookie httpOnly. Ogni ruolo ha un proprio
 * cookie e una propria "audience": un token della cassa non vale per /admin
 * e viceversa; un token partecipante non vale per il personale.
 */
export type SessionRole = StaffRole | "participant";

const CONFIG: Record<SessionRole, { cookie: string; audience: string; seconds: number }> = {
  admin: { cookie: "qz_admin", audience: "quiz-admin", seconds: 60 * 60 * 8 },
  cassa: { cookie: "qz_cassa", audience: "quiz-cassa", seconds: 60 * 60 * 12 },
  participant: { cookie: "qz_player", audience: "quiz-participant", seconds: 60 * 60 * 24 },
};

export const SESSION_COOKIE: Record<SessionRole, string> = {
  admin: CONFIG.admin.cookie,
  cassa: CONFIG.cassa.cookie,
  participant: CONFIG.participant.cookie,
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
    if (role !== "participant" && payload.sub !== getStaffCredentials(role).username) return null;
    return { role, subject: payload.sub, expiresAt: (payload.exp ?? 0) * 1000 };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(role: SessionRole, maxAge = CONFIG[role].seconds) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Il partecipante arriva da un QR (navigazione esterna): serve "lax".
    sameSite: role === "participant" ? ("lax" as const) : ("strict" as const),
    path: "/",
    maxAge,
  };
}
