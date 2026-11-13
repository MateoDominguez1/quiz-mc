export const ANSWER_LETTERS = ["A", "B", "C", "D"] as const;
export type AnswerLetter = (typeof ANSWER_LETTERS)[number];

/**
 * Domanda come viene mostrata al partecipante.
 * NON contiene (e non deve mai contenere) la risposta corretta.
 */
export interface PublicQuestion {
  id: string;
  questionText: string;
  answers: { letter: AnswerLetter; text: string }[];
  /** Data italiana (YYYY-MM-DD) a cui la domanda è assegnata. */
  date: string;
}

/** Stato della pagina partecipante calcolato dal server. */
export type ParticipantState =
  | { kind: "question"; question: PublicQuestion }
  | { kind: "answered"; question: PublicQuestion; correct: boolean }
  | { kind: "empty" }
  | { kind: "error" };

export type SubmitAnswerResult =
  | { status: "ok"; correct: boolean }
  | { status: "already_answered"; correct: boolean }
  | { status: "stale" }
  | { status: "no_question" };

/** Domanda completa, visibile solo all'amministratore. */
export interface AdminQuestion {
  id: string;
  questionText: string;
  answerA: string;
  answerB: string;
  answerC: string;
  answerD: string;
  correctAnswer: AnswerLetter;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedDate: string | null;
  timesUsed: number;
}

export interface AdminStats {
  date: string;
  totalQuestions: number;
  activeQuestions: number;
  neverUsedActive: number;
  todayQuestion: {
    id: string;
    questionText: string;
    correctAnswer: AnswerLetter;
    isActive: boolean;
  } | null;
  todayParticipants: number;
  todayWinners: number;
}

export interface QuestionInput {
  questionText: string;
  answerA: string;
  answerB: string;
  answerC: string;
  answerD: string;
  correctAnswer: AnswerLetter;
  isActive: boolean;
}
