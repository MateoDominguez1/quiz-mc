import type { NextRequest } from "next/server";
import { errorJson, getClientIp, handleUnexpected, json } from "@/lib/http";
import { getParticipantId } from "@/lib/participant";
import { getParticipantState } from "@/lib/services/quiz";
import { checkRateLimit } from "@/lib/services/rate-limit";

export const dynamic = "force-dynamic";

/** GET /api/participant – stato della partecipazione corrente (mai la risposta corretta). */
export async function GET(req: NextRequest) {
  try {
    const limit = await checkRateLimit("participant", getClientIp(req), 120, 60);
    if (!limit.allowed) return errorJson(429, "Troppe richieste. Attendi qualche secondo.");
    return json({ ok: true, state: await getParticipantState(await getParticipantId()) });
  } catch (err) {
    return handleUnexpected(err, "GET /api/participant");
  }
}
