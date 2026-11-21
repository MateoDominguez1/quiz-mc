import { QuizApp } from "@/components/quiz/QuizApp";
import { requireStaffPage } from "@/lib/auth/session";
import { getCurrentGameId } from "@/lib/game-session";
import { getGameState } from "@/lib/services/quiz";
import type { GameState } from "@/types/quiz";

// Sempre renderizzata sul server: lo stato dipende dalla partita in corso sul dispositivo.
export const dynamic = "force-dynamic";

async function loadState(): Promise<GameState> {
  try {
    return await getGameState(await getCurrentGameId());
  } catch (err) {
    console.error("[home] Impossibile caricare la partita:", err);
    return { kind: "error" };
  }
}

export default async function HomePage() {
  // Il quiz si gioca solo sul dispositivo abilitato dal personale.
  await requireStaffPage("postazione");
  return <QuizApp initialState={await loadState()} />;
}
