import type { NextRequest } from "next/server";
import { verifyAdminCredentials } from "@/lib/auth/credentials";
import { ADMIN_COOKIE, adminCookieOptions, signAdminSession } from "@/lib/auth/token";
import { errorJson, getClientIp, handleUnexpected, isSameOrigin, json, readJson } from "@/lib/http";
import { checkRateLimit, resetRateLimit } from "@/lib/services/rate-limit";
import { loginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST /api/admin/login  { username, password } */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return errorJson(403, "Richiesta non consentita");
  }

  const parsed = loginSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorJson(400, "Inserisci nome utente e password.");
  }

  const ip = getClientIp(req);
  try {
    // Protezione brute force: max 5 tentativi ogni 15 minuti per IP.
    const limit = await checkRateLimit("login", ip, MAX_ATTEMPTS, WINDOW_SECONDS);
    if (!limit.allowed) {
      const minutes = Math.max(1, Math.ceil(limit.retryAfter / 60));
      return errorJson(
        429,
        `Troppi tentativi di accesso. Riprova tra ${minutes} ${minutes === 1 ? "minuto" : "minuti"}.`,
        { retryAfter: limit.retryAfter },
      );
    }

    const valid = verifyAdminCredentials(parsed.data.username, parsed.data.password);
    if (!valid) {
      // Ritardo artificiale per rallentare i tentativi automatici.
      await sleep(600 + Math.floor(Math.random() * 400));
      const left = limit.remaining;
      return errorJson(
        401,
        left > 0
          ? `Nome utente o password non corretti. Tentativi rimasti: ${left}.`
          : "Nome utente o password non corretti.",
      );
    }

    await resetRateLimit("login", ip);
    const token = await signAdminSession(parsed.data.username);
    const res = json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, token, adminCookieOptions());
    return res;
  } catch (err) {
    return handleUnexpected(err, "POST /api/admin/login");
  }
}
