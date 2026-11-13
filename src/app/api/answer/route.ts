import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { errorJson, getClientIp, handleUnexpected, isSameOrigin, json, readJson } from "@/lib/http";
import { PARTICIPANT_COOKIE, parseParticipantId, participantCookieOptions } from "@/lib/participant";
import { submitAnswer } from "@/lib/services/quiz";
import { checkRateLimit } from "@/lib/services/rate-limit";
import { answerSubmissionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/answer  { questionId, answer: "A" | "B" | "C" | "D" }
 * Risposta: { ok: true, correct: boolean } – mai la risposta corretta.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return errorJson(403, "Richiesta non consentita");
  }

  const parsed = answerSubmissionSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorJson(400, "Risposta non valida");
  }

  try {
    // Limite per IP generoso (il Wi-Fi del ristorante può condividere l'IP).
    const limit = await checkRateLimit("answer", getClientIp(req), 30, 300);
    if (!limit.allowed) {
      return errorJson(429, "Troppi tentativi. Riprova tra qualche minuto.", {
        retryAfter: limit.retryAfter,
      });
    }

    const existing = parseParticipantId(req.cookies.get(PARTICIPANT_COOKIE)?.value);
    const participantId = existing ?? randomUUID();

    const result = await submitAnswer(parsed.data.questionId, parsed.data.answer, participantId);

    let res;
    switch (result.status) {
      case "ok":
        res = json({ ok: true, correct: result.correct, alreadyAnswered: false });
        break;
      case "already_answered":
        res = json({ ok: true, correct: result.correct, alreadyAnswered: true });
        break;
      case "stale":
        res = errorJson(409, "La domanda del giorno è cambiata.", { code: "stale" });
        break;
      default:
        res = errorJson(404, "Al momento non ci sono domande disponibili.", { code: "no_question" });
    }

    if (!existing) {
      res.cookies.set(PARTICIPANT_COOKIE, participantId, participantCookieOptions());
    }
    return res;
  } catch (err) {
    return handleUnexpected(err, "POST /api/answer");
  }
}
