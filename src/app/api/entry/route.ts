import type { NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth/token";
import { errorJson, getClientIp, handleUnexpected, isSameOrigin, json, readJson } from "@/lib/http";
import { INVALID_ENTRY_MESSAGE } from "@/lib/messages";
import { hashEntryToken } from "@/lib/participant";
import { redeemEntry } from "@/lib/services/quiz";
import { checkRateLimit } from "@/lib/services/rate-limit";
import { entrySchema, fieldErrors } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/entry  { token, age }
 * Utilizza il QR monouso (atomico nel DB), registra l'età, assegna una domanda
 * e crea la sessione sicura del partecipante (cookie httpOnly firmato).
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return errorJson(403, "Richiesta non consentita");

  const parsed = entrySchema.safeParse(await readJson(req));
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    if (fields.token) return errorJson(410, INVALID_ENTRY_MESSAGE, { code: "invalid_entry" });
    return errorJson(422, fields.age ?? "Dati non validi", { fields });
  }

  try {
    const limit = await checkRateLimit("entry", getClientIp(req), 40, 600);
    if (!limit.allowed) return errorJson(429, "Troppi tentativi. Riprova tra qualche minuto.");

    const result = await redeemEntry(hashEntryToken(parsed.data.token), parsed.data.age);
    if (result.status !== "ok") {
      return errorJson(410, INVALID_ENTRY_MESSAGE, { code: "invalid_entry" });
    }
    const res = json({ ok: true });
    res.cookies.set(
      SESSION_COOKIE.participant,
      await signSession("participant", result.participantId),
      sessionCookieOptions("participant"),
    );
    return res;
  } catch (err) {
    return handleUnexpected(err, "POST /api/entry");
  }
}
