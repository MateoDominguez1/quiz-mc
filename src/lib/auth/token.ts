import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { getAdminEnv } from "@/lib/env";

export const ADMIN_COOKIE = "qdg_admin";
export const ADMIN_SESSION_SECONDS = 60 * 60 * 8; // 8 ore

export interface AdminSession {
  username: string;
  expiresAt: number;
}

function key(): Uint8Array {
  return new TextEncoder().encode(getAdminEnv().sessionSecret);
}

export async function signAdminSession(username: string): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(username)
    .setIssuedAt()
    .setIssuer("quiz-del-giorno")
    .setAudience("quiz-admin")
    .setExpirationTime(`${ADMIN_SESSION_SECONDS}s`)
    .sign(key());
}

/** Verifica firma, scadenza e ruolo. Restituisce null se non valido. */
export async function verifyAdminSession(token: string | undefined | null): Promise<AdminSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
      issuer: "quiz-del-giorno",
      audience: "quiz-admin",
    });
    if (payload.role !== "admin" || typeof payload.sub !== "string") return null;
    // Se l'utente amministratore viene cambiato nelle variabili d'ambiente,
    // le sessioni precedenti non sono più valide.
    if (payload.sub !== getAdminEnv().username) return null;
    return { username: payload.sub, expiresAt: (payload.exp ?? 0) * 1000 };
  } catch {
    return null;
  }
}

export function adminCookieOptions(maxAge = ADMIN_SESSION_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}
