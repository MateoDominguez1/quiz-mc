import type { NextRequest } from "next/server";
import { errorJson, getClientIp, handleUnexpected, isSameOrigin, json, readJson } from "@/lib/http";
import { getParticipantId } from "@/lib/participant";
import { getParticipantState, submitAnswer } from "@/lib/services/quiz";
import { checkRateLimit } from "@/lib/services/rate-limit";
import { answerSubmissionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/answer  { answer: "A" | "B" | "C" | "D" }
 * La domanda è quella assegnata al partecipante (dalla sessione), mai scelta dal client.
 * Risposta: lo stato aggiornato (vinto + premio + codice, oppure perso).
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return errorJson(403, "Richiesta non consentita");

  const parsed = answerSubmissionSchema.safeParse(await readJson(req));
  if (!parsed.success) return errorJson(400, "Risposta non valida");

  try {
    const participantId = await getParticipantId();
    if (!participantId) {
      return errorJson(401, "Sessione non trovata. Scansiona il QR code alla cassa.", { code: "no_session" });
    }
    const limit = await checkRateLimit("answer", getClientIp(req), 60, 300);
    if (!limit.allowed) return errorJson(429, "Troppi tentativi. Riprova tra qualche minuto.");

    const status = await submitAnswer(participantId, parsed.data.answer);
    if (status === "not_found") {
      return errorJson(401, "Sessione non trovata. Scansiona il QR code alla cassa.", { code: "no_session" });
    }
    return json({ ok: true, alreadyAnswered: status === "already_answered", state: await getParticipantState(participantId) });
  } catch (err) {
    return handleUnexpected(err, "POST /api/answer");
  }
}
