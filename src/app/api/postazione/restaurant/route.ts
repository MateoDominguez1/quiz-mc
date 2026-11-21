import type { NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth/token";
import { getCurrentGameId } from "@/lib/game-session";
import { errorJson, guardStaff, handleUnexpected, json, readJson } from "@/lib/http";
import { abandonGame, findRestaurant, getGameState } from "@/lib/services/quiz";
import { restaurantSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/postazione/restaurant  { restaurant: "merlata" | … }
 * Sceglie il ristorante di questo dispositivo: partite e scorte dei premi
 * sono separate per ristorante.
 */
export async function POST(req: NextRequest) {
  const { denied } = await guardStaff(req, "postazione");
  if (denied) return denied;

  const parsed = restaurantSchema.safeParse(await readJson(req));
  if (!parsed.success) return errorJson(400, "Ristorante non valido");

  try {
    const restaurant = await findRestaurant(parsed.data.restaurant);
    if (!restaurant) return errorJson(404, "Ristorante non trovato");

    // Una partita lasciata a metà nel ristorante precedente viene annullata.
    const gameId = await getCurrentGameId();
    if (gameId) await abandonGame(gameId);

    const res = json({ ok: true, state: await getGameState(null, restaurant.key) });
    res.cookies.set(
      SESSION_COOKIE.restaurant,
      await signSession("restaurant", restaurant.key),
      sessionCookieOptions("restaurant"),
    );
    res.cookies.set(SESSION_COOKIE.game, "", sessionCookieOptions("game", 0));
    return res;
  } catch (err) {
    return handleUnexpected(err, "POST /api/postazione/restaurant");
  }
}

/** DELETE /api/postazione/restaurant – "Cambia ristorante": torna alla scelta. */
export async function DELETE(req: NextRequest) {
  const { denied } = await guardStaff(req, "postazione");
  if (denied) return denied;
  try {
    const gameId = await getCurrentGameId();
    if (gameId) await abandonGame(gameId);
    const res = json({ ok: true, state: await getGameState(null, null) });
    res.cookies.set(SESSION_COOKIE.restaurant, "", sessionCookieOptions("restaurant", 0));
    res.cookies.set(SESSION_COOKIE.game, "", sessionCookieOptions("game", 0));
    return res;
  } catch (err) {
    return handleUnexpected(err, "DELETE /api/postazione/restaurant");
  }
}
