import type { NextRequest } from "next/server";
import { getCurrentGameId } from "@/lib/game-session";
import { errorJson, guardStaff, handleUnexpected, json, readJson } from "@/lib/http";
import { getGameState, pickHouse } from "@/lib/services/quiz";
import { houseSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/game/house  { house: "brescia" | "firenze" | … }
 * Solo dopo una risposta esatta alle casette: il premio viene estratto nel DB
 * tra quelli ancora disponibili e la scorta viene scalata.
 */
export async function POST(req: NextRequest) {
  const { denied } = await guardStaff(req, "postazione");
  if (denied) return denied;

  const parsed = houseSchema.safeParse(await readJson(req));
  if (!parsed.success) return errorJson(400, "Casetta non valida");

  try {
    const gameId = await getCurrentGameId();
    if (gameId) await pickHouse(gameId, parsed.data.house);
    return json({ ok: true, state: await getGameState(gameId) });
  } catch (err) {
    return handleUnexpected(err, "POST /api/game/house");
  }
}
