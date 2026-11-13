import { cookies } from "next/headers";
import { QuizApp } from "@/components/quiz/QuizApp";
import { PARTICIPANT_COOKIE, parseParticipantId } from "@/lib/participant";
import { getTodayQuestion } from "@/lib/services/quiz";
import type { ParticipantState } from "@/types/quiz";

// Sempre renderizzata sul server: la domanda dipende dalla data italiana corrente.
export const dynamic = "force-dynamic";

async function loadState(): Promise<ParticipantState> {
  try {
    const store = await cookies();
    const pid = parseParticipantId(store.get(PARTICIPANT_COOKIE)?.value);
    const today = await getTodayQuestion(pid);
    if (!today) return { kind: "empty" };
    if (today.alreadyAnswered) {
      return { kind: "answered", question: today.question, correct: Boolean(today.wasCorrect) };
    }
    return { kind: "question", question: today.question };
  } catch (err) {
    console.error("[home] Impossibile caricare la domanda del giorno:", err);
    return { kind: "error" };
  }
}

export default async function HomePage() {
  const state = await loadState();
  return <QuizApp initialState={state} />;
}
