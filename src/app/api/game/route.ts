import type { NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth/token";
import { getCurrentGameId } from "@/lib/game-session";
import { errorJson, guardStaff, handleUnexpected, json, readJson } from "@/lib/http";
import { NO_QUESTIONS_MESSAGE, NO_STOCK_MESSAGE } from "@/lib/messages";
import { abandonGame, getGameState, startGame } from "@/lib/services/quiz";
import { startGameSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET /api/game – stato della postazione (mai la risposta corretta). */
export async function GET(req: NextRequest) {
  const { denied } = await guardStaff(req, "postazione", false);
  if (denied) return denied;
  try {
    return json({ ok: true, state: await getGameState(await getCurrentGameId()) });
  } catch (err) {
    return handleUnexpected(err, "GET /api/game");
  }
}

/**
 * POST /api/game  { mode: "casette" | "bigmac" }
 * Inizia una nuova partita (annullando quella eventualmente lasciata a metà)
 * e salva il suo ID in un cookie firmato del dispositivo.
 */
export async function POST(req: NextRequest) {
  const { denied } = await guardStaff(req, "postazione");
  if (denied) return denied;

  const parsed = startGameSchema.safeParse(await readJson(req));
  if (!parsed.success) return errorJson(400, "Gioco non valido");

  try {
    const previous = await getCurrentGameId();
    if (previous) await abandonGame(previous);

    const result = await startGame(parsed.data.mode);
    if (result.status !== "ok") {
      return errorJson(409, result.status === "no_stock" ? NO_STOCK_MESSAGE : NO_QUESTIONS_MESSAGE, {
        code: result.status,
        state: await getGameState(null),
      });
    }
    const res = json({ ok: true, state: await getGameState(result.gameId) });
    res.cookies.set(SESSION_COOKIE.game, await signSession("game", result.gameId), sessionCookieOptions("game"));
    return res;
  } catch (err) {
    return handleUnexpected(err, "POST /api/game");
  }
}

/** DELETE /api/game – "Nuovo cliente": chiude la partita e torna alla scelta del gioco. */
export async function DELETE(req: NextRequest) {
  const { denied } = await guardStaff(req, "postazione");
  if (denied) return denied;
  try {
    const gameId = await getCurrentGameId();
    if (gameId) await abandonGame(gameId);
    const res = json({ ok: true, state: await getGameState(null) });
    res.cookies.set(SESSION_COOKIE.game, "", sessionCookieOptions("game", 0));
    return res;
  } catch (err) {
    return handleUnexpected(err, "DELETE /api/game");
  }
}
