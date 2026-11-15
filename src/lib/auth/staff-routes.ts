import "server-only";
import type { NextRequest } from "next/server";
import { verifyStaffCredentials } from "@/lib/auth/credentials";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth/token";
import { errorJson, getClientIp, handleUnexpected, isSameOrigin, json, readJson } from "@/lib/http";
import { checkRateLimit, resetRateLimit } from "@/lib/services/rate-limit";
import { loginSchema } from "@/lib/validation";

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Login del personale (admin o cassa) con protezione brute force per IP. */
export function staffLoginHandler(role: "admin" | "cassa") {
  return async function POST(req: NextRequest) {
    if (!isSameOrigin(req)) {
      return errorJson(403, "Richiesta non consentita");
    }
    const parsed = loginSchema.safeParse(await readJson(req));
    if (!parsed.success) {
      return errorJson(400, "Inserisci nome utente e password.");
    }

    const ip = getClientIp(req);
    const scope = `login-${role}`;
    try {
      const limit = await checkRateLimit(scope, ip, MAX_ATTEMPTS, WINDOW_SECONDS);
      if (!limit.allowed) {
        const minutes = Math.max(1, Math.ceil(limit.retryAfter / 60));
        return errorJson(
          429,
          `Troppi tentativi di accesso. Riprova tra ${minutes} ${minutes === 1 ? "minuto" : "minuti"}.`,
          { retryAfter: limit.retryAfter },
        );
      }

      if (!verifyStaffCredentials(role, parsed.data.username, parsed.data.password)) {
        await sleep(600 + Math.floor(Math.random() * 400));
        const left = limit.remaining;
        return errorJson(
          401,
          left > 0
            ? `Nome utente o password non corretti. Tentativi rimasti: ${left}.`
            : "Nome utente o password non corretti.",
        );
      }

      await resetRateLimit(scope, ip);
      const token = await signSession(role, parsed.data.username);
      const res = json({ ok: true });
      res.cookies.set(SESSION_COOKIE[role], token, sessionCookieOptions(role));
      return res;
    } catch (err) {
      return handleUnexpected(err, `POST login ${role}`);
    }
  };
}

export function staffLogoutHandler(role: "admin" | "cassa") {
  return async function POST(req: NextRequest) {
    if (!isSameOrigin(req)) {
      return errorJson(403, "Richiesta non consentita");
    }
    const res = json({ ok: true });
    res.cookies.set(SESSION_COOKIE[role], "", sessionCookieOptions(role, 0));
    return res;
  };
}
