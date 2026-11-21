import "server-only";
import { getRomeDateString } from "@/lib/date";
import { callRpc } from "@/lib/supabase/server";
import type { AdminQuestion, AdminStats, AnswerLetter, Difficulty, ModeStats, PrizeKey, PrizePool, QuestionInput } from "@/types/quiz";

interface QuestionRow {
  id: string;
  question_text: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  correct_answer: string;
  difficulty: number;
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
    difficulty: ([0, 1, 2].includes(Number(row.difficulty)) ? Number(row.difficulty) : 0) as Difficulty,
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
    p_difficulty: input.difficulty,
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

interface ModeRow {
  played: number;
  won: number;
  lost: number;
  today_played: number;
  today_won: number;
}

function toModeStats(r: ModeRow | undefined): ModeStats {
  return {
    played: Number(r?.played ?? 0),
    won: Number(r?.won ?? 0),
    lost: Number(r?.lost ?? 0),
    todayPlayed: Number(r?.today_played ?? 0),
    todayWon: Number(r?.today_won ?? 0),
  };
}

export async function getStats(): Promise<AdminStats> {
  const s = await callRpc<{
    date: string;
    casette: ModeRow;
    bigmac: ModeRow;
    abandoned: number;
    stock_left: number;
    prizes: { key: PrizeKey; pool: PrizePool; label: string; stock: number | null; won: number; won_today: number }[];
    total_questions: number;
    active_by_difficulty: number[] | null;
  }>("admin_get_stats", { p_date: getRomeDateString() });
  const byLevel = s.active_by_difficulty ?? [];
  return {
    date: s.date,
    casette: toModeStats(s.casette),
    bigmac: toModeStats(s.bigmac),
    abandoned: Number(s.abandoned),
    stockLeft: Number(s.stock_left),
    prizes: (s.prizes ?? []).map((p) => ({
      key: p.key,
      pool: p.pool,
      label: p.label,
      stock: p.stock === null ? null : Number(p.stock),
      won: Number(p.won),
      wonToday: Number(p.won_today),
    })),
    totalQuestions: Number(s.total_questions),
    activeByDifficulty: [Number(byLevel[0] ?? 0), Number(byLevel[1] ?? 0), Number(byLevel[2] ?? 0)],
  };
}

/** Azzera le statistiche (elimina le partite; domande, premi e scorte restano). Irreversibile. */
export async function resetStats(): Promise<{ gamesDeleted: number }> {
  const r = await callRpc<{ games_deleted: number }>("admin_reset_stats");
  return { gamesDeleted: Number(r.games_deleted) };
}
