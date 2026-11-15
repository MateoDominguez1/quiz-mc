import "server-only";
import { getRomeDateString } from "@/lib/date";
import { callRpc } from "@/lib/supabase/server";
import { PRIZE_TYPES, type AdminQuestion, type AdminStats, type AnswerLetter, type PrizeType, type QuestionInput } from "@/types/quiz";

interface QuestionRow {
  id: string;
  question_text: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  correct_answer: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_used_date?: string | null;
  times_used?: number;
}

function toAdminQuestion(row: QuestionRow): AdminQuestion {
  return {
    id: row.id,
    questionText: row.question_text,
    answerA: row.answer_a,
    answerB: row.answer_b,
    answerC: row.answer_c,
    answerD: row.answer_d,
    correctAnswer: row.correct_answer.trim() as AnswerLetter,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedDate: row.last_used_date ?? null,
    timesUsed: row.times_used ?? 0,
  };
}

function toArgs(input: QuestionInput) {
  return {
    p_question_text: input.questionText,
    p_answer_a: input.answerA,
    p_answer_b: input.answerB,
    p_answer_c: input.answerC,
    p_answer_d: input.answerD,
    p_correct_answer: input.correctAnswer,
    p_is_active: input.isActive,
  };
}

export async function listQuestions(): Promise<AdminQuestion[]> {
  const rows = await callRpc<QuestionRow[]>("admin_list_questions");
  return (rows ?? []).map(toAdminQuestion);
}

export async function getQuestion(id: string): Promise<AdminQuestion | null> {
  const row = await callRpc<QuestionRow | null>("admin_get_question", { p_id: id });
  return row ? toAdminQuestion(row) : null;
}

export async function createQuestion(input: QuestionInput): Promise<AdminQuestion> {
  const row = await callRpc<QuestionRow>("admin_create_question", toArgs(input));
  return toAdminQuestion(row);
}

export async function updateQuestion(id: string, input: QuestionInput): Promise<AdminQuestion | null> {
  const row = await callRpc<QuestionRow | null>("admin_update_question", {
    p_id: id,
    ...toArgs(input),
  });
  return row ? toAdminQuestion(row) : null;
}

export async function setQuestionActive(id: string, isActive: boolean): Promise<AdminQuestion | null> {
  const row = await callRpc<QuestionRow | null>("admin_set_question_active", {
    p_id: id,
    p_is_active: isActive,
  });
  return row ? toAdminQuestion(row) : null;
}

export async function deleteQuestion(id: string): Promise<boolean> {
  const res = await callRpc<{ deleted: boolean }>("admin_delete_question", { p_id: id });
  return Boolean(res?.deleted);
}

export async function getStats(): Promise<AdminStats> {
  const s = await callRpc<{
    date: string;
    total_participants: number;
    total_winners: number;
    prizes_redeemed: number;
    prizes_pending: number;
    today_participants: number;
    today_winners: number;
    average_age: number | string | null;
    age_brackets: { label: string; count: number | string; percent: number | string }[];
    prizes_by_type: Record<PrizeType, { won: number; redeemed: number }>;
    total_questions: number;
    active_questions: number;
  }>("admin_get_stats", { p_date: getRomeDateString() });
  const byType = {} as AdminStats["prizesByType"];
  for (const t of PRIZE_TYPES) {
    const v = s.prizes_by_type?.[t];
    byType[t] = { won: Number(v?.won ?? 0), redeemed: Number(v?.redeemed ?? 0) };
  }
  return {
    date: s.date,
    totalParticipants: Number(s.total_participants),
    totalWinners: Number(s.total_winners),
    prizesRedeemed: Number(s.prizes_redeemed),
    prizesPending: Number(s.prizes_pending),
    todayParticipants: Number(s.today_participants),
    todayWinners: Number(s.today_winners),
    averageAge: s.average_age === null ? null : Number(s.average_age),
    ageBrackets: (s.age_brackets ?? []).map((b) => ({
      label: b.label,
      count: Number(b.count),
      percent: Number(b.percent),
    })),
    prizesByType: byType,
    totalQuestions: Number(s.total_questions),
    activeQuestions: Number(s.active_questions),
  };
}

export interface ResetResult {
  participantsDeleted: number;
  prizesDeleted: number;
  entriesDeleted: number;
  pendingKept: number;
}

/** Azzera le statistiche (domande e foto restano). Operazione irreversibile. */
export async function resetStats(keepPending: boolean): Promise<ResetResult> {
  const r = await callRpc<{
    participants_deleted: number;
    prizes_deleted: number;
    entries_deleted: number;
    pending_kept: number;
  }>("admin_reset_stats", { p_keep_pending: keepPending });
  return {
    participantsDeleted: Number(r.participants_deleted),
    prizesDeleted: Number(r.prizes_deleted),
    entriesDeleted: Number(r.entries_deleted),
    pendingKept: Number(r.pending_kept),
  };
}
