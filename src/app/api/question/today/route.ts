import type { NextRequest } from "next/server";
import { errorJson, getClientIp, handleUnexpected, json } from "@/lib/http";
import { PARTICIPANT_COOKIE, parseParticipantId } from "@/lib/participant";
import { getTodayQuestion } from "@/lib/services/quiz";
import { checkRateLimit } from "@/lib/services/rate-limit";

export const dynamic = "force-dynamic";

/** GET /api/question/today – domanda del giorno (senza risposta corretta). */
export async function GET(req: NextRequest) {
  try {
    const limit = await checkRateLimit("question", getClientIp(req), 120, 60);
    if (!limit.allowed) {
      return errorJson(429, "Troppe richieste. Attendi qualche secondo.", {
        retryAfter: limit.retryAfter,
      });
    }

    const pid = parseParticipantId(req.cookies.get(PARTICIPANT_COOKIE)?.value);
    const today = await getTodayQuestion(pid);
    if (!today) {
      return json({ ok: true, question: null });
    }
    return json({
      ok: true,
      question: today.question,
      alreadyAnswered: today.alreadyAnswered,
      correct: today.alreadyAnswered ? today.wasCorrect : undefined,
    });
  } catch (err) {
    return handleUnexpected(err, "GET /api/question/today");
  }
}
