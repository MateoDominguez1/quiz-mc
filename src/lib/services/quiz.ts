import "server-only";
import { getRomeDateString } from "@/lib/date";
import { callRpc } from "@/lib/supabase/server";
import { prizeImageUrl } from "@/lib/supabase/storage";
import type { AnswerLetter, ParticipantState, PrizeType, PublicQuestion } from "@/types/quiz";

interface QuestionRow {
  id: string;
  question_text: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
}

interface StateRow {
  participant_id: string;
  answered: boolean;
  is_correct: boolean | null;
  question: QuestionRow | null;
  prize: {
    type: PrizeType;
    label: string;
    image_path: string | null;
    code: string;
    status: "pending" | "redeemed";
    redeemed_at: string | null;
  } | null;
}

/**
 * Whitelist esplicita dei campi: anche se il DB restituisse altro,
 * la risposta corretta non potrebbe arrivare al browser.
 */
export function toPublicQuestion(row: QuestionRow): PublicQuestion {
  return {
    id: row.id,
    questionText: row.question_text,
    answers: [
      { letter: "A", text: row.answer_a },
      { letter: "B", text: row.answer_b },
      { letter: "C", text: row.answer_c },
      { letter: "D", text: row.answer_d },
    ],
  };
}

export type EntryStatus = "valid" | "invalid" | "mine";

/** Stato di un QR (sola lettura, non lo consuma). */
export async function getEntryStatus(tokenHash: string, participantId: string | null): Promise<EntryStatus> {
  const res = await callRpc<{ status: EntryStatus }>("entry_status", {
    p_token_hash: tokenHash,
    p_participant: participantId,
  });
  return res.status;
}

/**
 * Utilizza il QR (atomico nel DB), crea il partecipante con la sua età e gli
 * assegna una domanda casuale del ciclo giornaliero (Europe/Rome).
 */
export async function redeemEntry(
  tokenHash: string,
  age: number,
): Promise<{ status: "ok"; participantId: string } | { status: "invalid" }> {
  const res = await callRpc<{ status: "ok" | "invalid"; participant_id?: string }>("redeem_entry", {
    p_token_hash: tokenHash,
    p_age: age,
    p_date: getRomeDateString(),
  });
  if (res.status === "ok" && res.participant_id) {
    return { status: "ok", participantId: res.participant_id };
  }
  return { status: "invalid" };
}

export async function getParticipantState(participantId: string | null): Promise<ParticipantState> {
  if (!participantId) return { kind: "no_session" };
  const row = await callRpc<StateRow | null>("get_participant_state", { p_participant: participantId });
  if (!row) return { kind: "no_session" };
  if (row.answered) {
    if (row.is_correct && row.prize) {
      return {
        kind: "won",
        prize: {
          type: row.prize.type,
          label: row.prize.label,
          imageUrl: prizeImageUrl(row.prize.image_path),
          code: row.prize.code,
          status: row.prize.status,
          redeemedAt: row.prize.redeemed_at,
        },
      };
    }
    return { kind: "lost" };
  }
  if (!row.question) return { kind: "no_question" };
  return { kind: "question", question: toPublicQuestion(row.question) };
}

export type SubmitResult = "ok" | "already_answered" | "no_question" | "not_found";

/** Verifica la risposta esclusivamente nel DB; il premio è deciso dal DB. */
export async function submitAnswer(participantId: string, answer: AnswerLetter): Promise<SubmitResult> {
  const res = await callRpc<{ status: SubmitResult }>("submit_participant_answer", {
    p_participant: participantId,
    p_answer: answer,
  });
  return res.status;
}
