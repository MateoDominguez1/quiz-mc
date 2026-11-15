export const ANSWER_LETTERS = ["A", "B", "C", "D"] as const;
export type AnswerLetter = (typeof ANSWER_LETTERS)[number];

export const PRIZE_TYPES = ["braccialetto", "cono", "caffe"] as const;
export type PrizeType = (typeof PRIZE_TYPES)[number];

/**
 * Testi predefiniti dei premi (il tipo di premio è sempre deciso dal server in
 * base all'età). Nome e messaggio sono modificabili dall'amministratore.
 */
export const PRIZE_INFO: Record<PrizeType, { label: string; ages: string; winMessage: string }> = {
  braccialetto: { label: "Braccialetto", ages: "0–10 anni", winMessage: "Complimenti! Hai vinto un braccialetto!" },
  cono: { label: "Cono", ages: "11–17 anni", winMessage: "Complimenti! Hai vinto un cono!" },
  caffe: { label: "Caffè", ages: "18 anni e oltre", winMessage: "Complimenti! Hai vinto un caffè!" },
};

/**
 * Domanda come viene mostrata al partecipante.
 * NON contiene (e non deve mai contenere) la risposta corretta.
 */
export interface PublicQuestion {
  id: string;
  questionText: string;
  answers: { letter: AnswerLetter; text: string }[];
}

export interface WonPrize {
  type: PrizeType;
  label: string;
  winMessage: string;
  imageUrl: string | null;
  code: string;
  status: "pending" | "redeemed";
  redeemedAt: string | null;
}

/** Stato della pagina partecipante calcolato dal server. */
export type ParticipantState =
  | { kind: "no_session" }
  | { kind: "no_question" }
  | { kind: "question"; question: PublicQuestion }
  | { kind: "lost" }
  | { kind: "won"; prize: WonPrize }
  | { kind: "error" };

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

export interface AgeBracket {
  label: string;
  count: number;
  percent: number;
}

export interface AdminStats {
  date: string;
  totalParticipants: number;
  totalWinners: number;
  prizesRedeemed: number;
  prizesPending: number;
  todayParticipants: number;
  todayWinners: number;
  averageAge: number | null;
  ageBrackets: AgeBracket[];
  prizesByType: Record<PrizeType, { label: string; won: number; redeemed: number }>;
  totalQuestions: number;
  activeQuestions: number;
}

export interface PrizeSetting {
  type: PrizeType;
  label: string;
  /** Messaggio personalizzato; null = predefinito. */
  winMessage: string | null;
  imageUrl: string | null;
  updatedAt: string;
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

/** Risultato della verifica/riscatto di un codice premio in cassa. */
export type PrizeLookup =
  | { status: "not_found" }
  | {
      status: "pending" | "redeemed" | "already_redeemed";
      code: string;
      prizeType: PrizeType;
      label: string;
      imageUrl: string | null;
      redeemedAt: string | null;
    };

export interface Redemption {
  code: string;
  prizeType: PrizeType;
  label: string;
  redeemedAt: string;
}

/** Messaggio di vittoria: quello personalizzato o, in mancanza, quello predefinito. */
export function winMessageFor(type: PrizeType, label: string, custom: string | null | undefined): string {
  if (custom && custom.trim()) return custom.trim();
  if (label.trim().toLocaleLowerCase("it-IT") === PRIZE_INFO[type].label.toLocaleLowerCase("it-IT")) {
    return PRIZE_INFO[type].winMessage;
  }
  return `Complimenti! Hai vinto: ${label.trim()}!`;
}
