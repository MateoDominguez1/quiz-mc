import "server-only";
import { getRomeDateString } from "@/lib/date";
import { callRpc } from "@/lib/supabase/server";
import { prizeImageUrl } from "@/lib/supabase/storage";
import {
  HOUSE_KEYS,
  winMessageFor,
  type AnswerLetter,
  type Difficulty,
  type GameMode,
  type GameState,
  type HouseKey,
  type MenuInfo,
  type PrizeKey,
  type PublicQuestion,
  type Restaurant,
} from "@/types/quiz";

interface QuestionRow {
  id: string;
  question_text: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  difficulty?: number;
}

interface StateRow {
  game_id: string;
  mode: GameMode;
  restaurant: string | null;
  status: "playing" | "pick_house" | "won" | "lost" | "abandoned";
  step: number;
  total_steps: number;
  correct_count: number;
  house: string | null;
  question: QuestionRow | null;
  prize: { key: PrizeKey; label: string; win_message: string | null; image_path: string | null } | null;
}

/**
 * Whitelist esplicita dei campi: anche se il DB restituisse altro,
 * la risposta corretta non potrebbe arrivare al browser.
 */
export function toPublicQuestion(row: QuestionRow): PublicQuestion {
  const d = Number(row.difficulty ?? 0);
  return {
    id: row.id,
    questionText: row.question_text,
    difficulty: (d === 1 || d === 2 ? d : 0) as Difficulty,
    answers: [
      { letter: "A", text: row.answer_a },
      { letter: "B", text: row.answer_b },
      { letter: "C", text: row.answer_c },
      { letter: "D", text: row.answer_d },
    ],
  };
}

export async function listRestaurants(): Promise<Restaurant[]> {
  const rows = await callRpc<{ key: string; name: string }[]>("list_restaurants");
  return (rows ?? []).map((r) => ({ key: r.key, name: r.name }));
}

export async function findRestaurant(key: string | null): Promise<Restaurant | null> {
  if (!key) return null;
  return (await listRestaurants()).find((r) => r.key === key) ?? null;
}

async function menuState(restaurantKey: string | null): Promise<GameState> {
  const restaurants = await listRestaurants();
  const restaurant = restaurants.find((r) => r.key === restaurantKey);
  if (!restaurant) return { kind: "choose_restaurant", restaurants };
  const r = await callRpc<{ stock_left: number; casette: MenuInfo["casette"]; bigmac: MenuInfo["bigmac"] }>(
    "game_availability",
    { p_restaurant: restaurant.key },
  );
  return {
    kind: "menu",
    menu: { restaurant, stockLeft: Number(r.stock_left), casette: r.casette, bigmac: r.bigmac },
  };
}

/**
 * Stato della postazione: scelta del ristorante (se il dispositivo non ne ha
 * uno), la partita in corso (o appena conclusa) oppure la scelta del gioco.
 */
export async function getGameState(gameId: string | null, restaurantKey: string | null): Promise<GameState> {
  const row = gameId ? await callRpc<StateRow | null>("get_game_state", { p_game: gameId }) : null;
  if (!row || row.status === "abandoned" || row.restaurant !== restaurantKey) {
    return menuState(restaurantKey);
  }
  switch (row.status) {
    case "playing":
      if (!row.question) return menuState(restaurantKey);
      return {
        kind: "question",
        mode: row.mode,
        step: Number(row.step),
        totalSteps: Number(row.total_steps),
        question: toPublicQuestion(row.question),
      };
    case "pick_house":
      return { kind: "pick_house" };
    case "won":
      return {
        kind: "won",
        mode: row.mode,
        house: HOUSE_KEYS.includes(row.house as HouseKey) ? (row.house as HouseKey) : null,
        prize: row.prize
          ? {
              key: row.prize.key,
              label: row.prize.label,
              winMessage: winMessageFor(row.prize.key, row.prize.label, row.prize.win_message),
              imageUrl: prizeImageUrl(row.prize.image_path),
            }
          : null,
      };
    case "lost":
      return {
        kind: "lost",
        mode: row.mode,
        correctCount: Number(row.correct_count),
        totalSteps: Number(row.total_steps),
      };
  }
}

export type StartResult = { status: "ok"; gameId: string } | { status: "no_questions" | "no_stock" };

export async function startGame(mode: GameMode, restaurant: string): Promise<StartResult> {
  const r = await callRpc<{ status: "ok" | "no_questions" | "no_stock"; game_id?: string }>("start_game", {
    p_mode: mode,
    p_restaurant: restaurant,
    p_date: getRomeDateString(),
  });
  if (r.status === "ok" && r.game_id) return { status: "ok", gameId: r.game_id };
  return { status: r.status === "no_stock" ? "no_stock" : "no_questions" };
}

export type SubmitResult =
  | { status: "ok"; correct: boolean }
  | { status: "not_playing" | "no_question" | "not_found" };

/** Verifica la risposta esclusivamente nel DB. */
export async function submitAnswer(gameId: string, answer: AnswerLetter): Promise<SubmitResult> {
  const r = await callRpc<{ status: "ok" | "not_playing" | "no_question" | "not_found"; correct?: boolean }>(
    "submit_game_answer",
    { p_game: gameId, p_answer: answer },
  );
  if (r.status === "ok") return { status: "ok", correct: Boolean(r.correct) };
  return { status: r.status };
}

/** Scelta della casetta: il premio viene estratto (e scalato) nel DB. */
export async function pickHouse(gameId: string, house: HouseKey): Promise<"ok" | "not_allowed" | "not_found"> {
  const r = await callRpc<{ status: "ok" | "not_allowed" | "not_found" }>("pick_house", {
    p_game: gameId,
    p_house: house,
  });
  return r.status;
}

/** "Nuovo cliente": annulla la partita se non è ancora conclusa. */
export async function abandonGame(gameId: string): Promise<void> {
  await callRpc("abandon_game", { p_game: gameId });
}
