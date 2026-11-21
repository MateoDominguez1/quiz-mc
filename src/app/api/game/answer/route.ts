import type { NextRequest } from "next/server";
import { getCurrentGameId, getCurrentRestaurant } from "@/lib/game-session";
import { errorJson, guardStaff, handleUnexpected, json, readJson } from "@/lib/http";
import { getGameState, submitAnswer } from "@/lib/services/quiz";
import { answerSubmissionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/game/answer  { answer: "A" | "B" | "C" | "D" }
 * La domanda è quella della partita in corso (dal cookie), mai scelta dal client.
 * Risposta: esito + stato aggiornato (prossima domanda, casette, vittoria o sconfitta).
 */
export async function POST(req: NextRequest) {
  const { denied } = await guardStaff(req, "postazione");
  if (denied) return denied;

  const parsed = answerSubmissionSchema.safeParse(await readJson(req));
  if (!parsed.success) return errorJson(400, "Risposta non valida");

  try {
    const gameId = await getCurrentGameId();
    if (!gameId) {
      return json({ ok: true, correct: null, state: await getGameState(null, await getCurrentRestaurant()) });
    }
    const result = await submitAnswer(gameId, parsed.data.answer);
    return json({
      ok: true,
      correct: result.status === "ok" ? result.correct : null,
      state: await getGameState(gameId, await getCurrentRestaurant()),
    });
  } catch (err) {
    return handleUnexpected(err, "POST /api/game/answer");
  }
}
