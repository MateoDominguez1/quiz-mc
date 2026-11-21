import { QuizApp } from "@/components/quiz/QuizApp";
import { requireStaffPage } from "@/lib/auth/session";
import { getCurrentGameId, getCurrentRestaurant } from "@/lib/game-session";
import { findRestaurant, getGameState } from "@/lib/services/quiz";
import type { GameState, Restaurant } from "@/types/quiz";

// Sempre renderizzata sul server: lo stato dipende dalla partita in corso sul dispositivo.
export const dynamic = "force-dynamic";

async function load(): Promise<{ state: GameState; restaurant: Restaurant | null }> {
  try {
    const key = await getCurrentRestaurant();
    const [state, restaurant] = await Promise.all([getGameState(await getCurrentGameId(), key), findRestaurant(key)]);
    return { state, restaurant };
  } catch (err) {
    console.error("[home] Impossibile caricare la partita:", err);
    return { state: { kind: "error" }, restaurant: null };
  }
}

export default async function HomePage() {
  // Il quiz si gioca solo sul dispositivo abilitato dal personale.
  await requireStaffPage("postazione");
  const { state, restaurant } = await load();
  return <QuizApp initialState={state} restaurant={restaurant} />;
}
