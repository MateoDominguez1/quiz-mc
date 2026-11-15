import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ConfigError } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import { DatabaseError } from "@/lib/supabase/server";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export function json<T>(body: T, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...NO_STORE, ...(init.headers ?? {}) },
  });
}

export function errorJson(status: number, message: string, extra: Record<string, unknown> = {}) {
  return json({ ok: false, error: message, ...extra }, { status });
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Protezione CSRF per le richieste che modificano dati: l'Origin (se presente)
 * deve coincidere con l'host della richiesta. Insieme ai cookie SameSite=Strict.
 */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) {
    // I browser moderni inviano sempre Origin sulle POST/PATCH/DELETE fetch.
    return req.headers.get("sec-fetch-site") !== "cross-site";
  }
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function readJson(req: NextRequest): Promise<unknown> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) return null;
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/**
 * Guard per le API del personale: sessione valida del ruolo richiesto
 * (+ stessa origine per le richieste che modificano dati).
 */
export async function guardStaff(req: NextRequest, role: "admin" | "cassa", mutating = true) {
  if (mutating && !isSameOrigin(req)) {
    return { denied: errorJson(403, "Richiesta non consentita"), session: null };
  }
  const session = await getSession(role);
  if (!session) {
    return { denied: errorJson(401, "Sessione scaduta. Accedi di nuovo."), session: null };
  }
  return { denied: null, session };
}

/** Compatibilità con le API amministrative esistenti. */
export async function guardAdmin(req: NextRequest, mutating = true) {
  return (await guardStaff(req, "admin", mutating)).denied;
}

/** Origine pubblica dell'app (per i link nei QR code). */
export function getPublicOrigin(req: NextRequest): string {
  const configured = process.env.PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      /* valore non valido: si usa l'host della richiesta */
    }
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

/** Gestione uniforme degli errori imprevisti (nessun dettaglio interno al client). */
export function handleUnexpected(err: unknown, context: string) {
  if (err instanceof ConfigError) {
    console.error(`[${context}] Configurazione mancante:`, err.message);
    return errorJson(503, "Servizio non configurato. Contatta l'amministratore.");
  }
  if (err instanceof DatabaseError) {
    console.error(`[${context}] Errore database:`, err.code, err.message);
    if (err.code === "23514" || err.code === "22023") {
      return errorJson(422, "Dati non validi");
    }
    return errorJson(503, "Servizio momentaneamente non disponibile. Riprova tra poco.");
  }
  console.error(`[${context}] Errore imprevisto:`, err);
  return errorJson(500, "Si è verificato un errore. Riprova tra poco.");
}
