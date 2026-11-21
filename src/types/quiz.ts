export const ANSWER_LETTERS = ["A", "B", "C", "D"] as const;
export type AnswerLetter = (typeof ANSWER_LETTERS)[number];

/** I due giochi: una domanda + casetta, oppure tre domande per il Big Mac. */
export const GAME_MODES = ["casette", "bigmac"] as const;
export type GameMode = (typeof GAME_MODES)[number];

export const GAME_INFO: Record<GameMode, { title: string; subtitle: string; emoji: string; steps: number }> = {
  casette: { title: "Le casette della fortuna", subtitle: "Una domanda facile • un premio misterioso", emoji: "🏠", steps: 1 },
  bigmac: { title: "La sfida Big Mac", subtitle: "Tre risposte esatte • un Big Mac", emoji: "🍔", steps: 3 },
};

/** Difficoltà: 0 = facile, 1 = media, 2 = difficile. */
export const DIFFICULTIES = [0, 1, 2] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_INFO: Record<Difficulty, { label: string; emoji: string; badge: string }> = {
  0: { label: "Facile", emoji: "🟢", badge: "bg-emerald-100 text-emerald-800" },
  1: { label: "Media", emoji: "🟠", badge: "bg-amber-100 text-amber-800" },
  2: { label: "Difficile", emoji: "🔴", badge: "bg-red-100 text-brand-red-dark" },
};

export const PRIZE_KEYS = [
  "braccialetto",
  "hamburger",
  "nuggets",
  "patatine",
  "cono",
  "profumatore",
  "gadget",
  "bigmac",
] as const;
export type PrizeKey = (typeof PRIZE_KEYS)[number];
export type PrizePool = "casette" | "bigmac";

/** Testi predefiniti dei premi. Nome e messaggio sono modificabili dall'amministratore. */
export const PRIZE_INFO: Record<PrizeKey, { label: string; winMessage: string }> = {
  braccialetto: { label: "Braccialetto", winMessage: "Hai vinto un braccialetto!" },
  hamburger: { label: "Hamburger", winMessage: "Hai vinto un hamburger!" },
  nuggets: { label: "Nuggets", winMessage: "Hai vinto i nuggets!" },
  patatine: { label: "Patatine piccole", winMessage: "Hai vinto le patatine piccole!" },
  cono: { label: "Cono", winMessage: "Hai vinto un cono!" },
  profumatore: { label: "Profumatore auto", winMessage: "Hai vinto un profumatore per l'auto!" },
  gadget: { label: "Gadget vario", winMessage: "Hai vinto un gadget!" },
  bigmac: { label: "Big Mac", winMessage: "Hai vinto un Big Mac!" },
};

/** Le cinque Case Ronald del "villaggio della solidarietà". */
export const HOUSE_KEYS = ["brescia", "firenze", "bologna", "roma-palidoro", "milano-niguarda"] as const;
export type HouseKey = (typeof HOUSE_KEYS)[number];

export const HOUSE_INFO: Record<HouseKey, { city: string; tagline: string }> = {
  brescia: { city: "Brescia", tagline: "Montagne e castello" },
  firenze: { city: "Firenze", tagline: "Cupola e colline" },
  bologna: { city: "Bologna", tagline: "Portici e torri" },
  "roma-palidoro": { city: "Roma Palidoro", tagline: "Mare e pini" },
  "milano-niguarda": { city: "Milano Niguarda", tagline: "Guglie e skyline" },
};

/**
 * Domanda come viene mostrata al cliente.
 * NON contiene (e non deve mai contenere) la risposta corretta.
 */
export interface PublicQuestion {
  id: string;
  questionText: string;
  difficulty: Difficulty;
  answers: { letter: AnswerLetter; text: string }[];
}

export interface WonPrize {
  key: PrizeKey;
  label: string;
  winMessage: string;
  imageUrl: string | null;
}

export interface Restaurant {
  key: string;
  name: string;
}

/** Disponibilità dei due giochi, mostrata nella schermata iniziale. */
export interface MenuInfo {
  restaurant: Restaurant;
  stockLeft: number;
  casette: "ok" | "no_questions" | "no_stock";
  bigmac: "ok" | "no_questions";
}

/** Stato della postazione calcolato dal server. */
export type GameState =
  | { kind: "choose_restaurant"; restaurants: Restaurant[] }
  | { kind: "menu"; menu: MenuInfo }
  | { kind: "question"; mode: GameMode; step: number; totalSteps: number; question: PublicQuestion }
  | { kind: "pick_house" }
  | { kind: "won"; mode: GameMode; prize: WonPrize | null; house: HouseKey | null }
  | { kind: "lost"; mode: GameMode; correctCount: number; totalSteps: number }
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
  difficulty: Difficulty;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedDate: string | null;
  timesUsed: number;
}

export interface ModeStats {
  played: number;
  won: number;
  lost: number;
  todayPlayed: number;
  todayWon: number;
}

export interface PrizeStats {
  key: PrizeKey;
  pool: PrizePool;
  label: string;
  stock: number | null;
  won: number;
  wonToday: number;
}

export interface RestaurantStats {
  key: string;
  name: string;
  played: number;
  todayPlayed: number;
  casetteWon: number;
  bigmacWon: number;
  stockLeft: number;
}

export interface AdminStats {
  date: string;
  /** Ristorante filtrato (null = tutti). */
  restaurant: string | null;
  restaurants: RestaurantStats[];
  casette: ModeStats;
  bigmac: ModeStats;
  abandoned: number;
  stockLeft: number;
  prizes: PrizeStats[];
  totalQuestions: number;
  /** Domande attive per difficoltà [facile, media, difficile]. */
  activeByDifficulty: [number, number, number];
}

export interface PrizeSetting {
  key: PrizeKey;
  pool: PrizePool;
  label: string;
  /** Messaggio personalizzato; null = predefinito. */
  winMessage: string | null;
  imageUrl: string | null;
  /** Pezzi disponibili per ristorante (solo casette; null per il Big Mac). */
  stocks: Record<string, number> | null;
  updatedAt: string;
}

export interface QuestionInput {
  questionText: string;
  answerA: string;
  answerB: string;
  answerC: string;
  answerD: string;
  correctAnswer: AnswerLetter;
  difficulty: Difficulty;
  isActive: boolean;
}

/** Messaggio di vittoria: quello personalizzato o, in mancanza, quello predefinito. */
export function winMessageFor(key: PrizeKey, label: string, custom: string | null | undefined): string {
  if (custom && custom.trim()) return custom.trim();
  if (label.trim().toLocaleLowerCase("it-IT") === PRIZE_INFO[key].label.toLocaleLowerCase("it-IT")) {
    return PRIZE_INFO[key].winMessage;
  }
  return `Hai vinto: ${label.trim()}!`;
}
