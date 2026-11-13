import "server-only";
import { getRomeDateString } from "@/lib/date";
import { callRpc } from "@/lib/supabase/server";
import type { AnswerLetter, PublicQuestion, SubmitAnswerResult } from "@/types/quiz";

interface DailyQuestionRow {
  id: string;
  question_text: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  question_date: string;
  already_answered: boolean;
  was_correct?: boolean;
}

/**
 * Converte la riga del DB nel formato pubblico.
 * Whitelist esplicita dei campi: anche se il DB restituisse altro,
 * la risposta corretta non potrebbe arrivare al browser.
 */
export function toPublicQuestion(row: DailyQuestionRow): PublicQuestion {
  return {
    id: row.id,
    questionText: row.question_text,
    date: row.question_date,
    answers: [
      { letter: "A", text: row.answer_a },
      { letter: "B", text: row.answer_b },
      { letter: "C", text: row.answer_c },
      { letter: "D", text: row.answer_d },
    ],
  };
}

export interface TodayQuestion {
  question: PublicQuestion;
  alreadyAnswered: boolean;
  wasCorrect: boolean | null;
}

/**
 * Domanda del giorno (fuso Europe/Rome). L'assegnazione è persistente e
 * avviene in modo atomico nel DB al primo accesso della giornata:
 * nessun cron job necessario, il cambio avviene da solo alle 00:00.
 */
export async function getTodayQuestion(participantId?: string | null): Promise<TodayQuestion | null> {
  const row = await callRpc<DailyQuestionRow | null>("get_daily_question", {
    p_date: getRomeDateString(),
    p_participant: participantId ?? null,
  });
  if (!row) return null;
  return {
    question: toPublicQuestion(row),
    alreadyAnswered: Boolean(row.already_answered),
    wasCorrect: row.already_answered ? Boolean(row.was_correct) : null,
  };
}

/** Verifica la risposta esclusivamente sul server/DB. Restituisce solo un booleano. */
export async function submitAnswer(
  questionId: string,
  answer: AnswerLetter,
  participantId: string,
): Promise<SubmitAnswerResult> {
  const res = await callRpc<{ status: SubmitAnswerResult["status"]; correct?: boolean }>(
    "submit_answer",
    {
      p_question_id: questionId,
      p_answer: answer,
      p_participant: participantId,
      p_date: getRomeDateString(),
    },
  );
  switch (res.status) {
    case "ok":
    case "already_answered":
      return { status: res.status, correct: Boolean(res.correct) };
    case "stale":
      return { status: "stale" };
    default:
      return { status: "no_question" };
  }
}
