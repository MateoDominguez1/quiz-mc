import { QuizApp } from "@/components/quiz/QuizApp";
import { getParticipantId } from "@/lib/participant";
import { getParticipantState } from "@/lib/services/quiz";
import type { ParticipantState } from "@/types/quiz";

// Sempre renderizzata sul server: lo stato dipende dalla sessione del partecipante.
export const dynamic = "force-dynamic";

async function loadState(): Promise<ParticipantState> {
  try {
    return await getParticipantState(await getParticipantId());
  } catch (err) {
    console.error("[home] Impossibile caricare la partecipazione:", err);
    return { kind: "error" };
  }
}

export default async function HomePage() {
  return <QuizApp initialState={await loadState()} />;
}
