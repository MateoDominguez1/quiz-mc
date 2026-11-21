import { z } from "zod";
import { ANSWER_LETTERS, GAME_MODES, HOUSE_KEYS, PRIZE_KEYS } from "@/types/quiz";

const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label}: campo obbligatorio` })
    .trim()
    .min(1, { error: `${label}: campo obbligatorio` })
    .max(max, { error: `${label}: massimo ${max} caratteri` });

export const answerLetterSchema = z.enum(ANSWER_LETTERS, {
  error: "Seleziona la risposta corretta (A, B, C o D)",
});

export const questionInputSchema = z
  .object({
    questionText: requiredText("Domanda", 500),
    answerA: requiredText("Risposta A", 200),
    answerB: requiredText("Risposta B", 200),
    answerC: requiredText("Risposta C", 200),
    answerD: requiredText("Risposta D", 200),
    correctAnswer: answerLetterSchema,
    difficulty: z.union([z.literal(0), z.literal(1), z.literal(2)], {
      error: "Scegli la difficoltà (facile, media o difficile)",
    }),
    isActive: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    const answers = [value.answerA, value.answerB, value.answerC, value.answerD].map((a) =>
      a.toLocaleLowerCase("it-IT"),
    );
    if (new Set(answers).size !== answers.length) {
      ctx.addIssue({
        code: "custom",
        path: ["answerA"],
        message: "Le quattro risposte devono essere diverse tra loro",
      });
    }
  });

export const statusInputSchema = z.object({
  isActive: z.boolean({ error: "Stato non valido" }),
});

/** La domanda è nota al server (partita in corso): si invia solo la lettera. */
export const answerSubmissionSchema = z.object({
  answer: answerLetterSchema,
});

export const startGameSchema = z.object({
  mode: z.enum(GAME_MODES, { error: "Gioco non valido" }),
});

export const houseSchema = z.object({
  house: z.enum(HOUSE_KEYS, { error: "Casetta non valida" }),
});

export const prizeKeySchema = z.enum(PRIZE_KEYS);

const restaurantKey = z.string({ error: "Ristorante non valido" }).regex(/^[a-z0-9-]{2,30}$/, {
  error: "Ristorante non valido",
});

export const restaurantSchema = z.object({ restaurant: restaurantKey });

/** Pezzi disponibili di un premio in un ristorante. */
export const stockUpdateSchema = z.object({
  restaurant: restaurantKey,
  prize: prizeKeySchema,
  stock: z
    .number({ error: "Pezzi disponibili: inserisci un numero" })
    .int({ error: "Pezzi disponibili: numero intero" })
    .min(0, { error: "Pezzi disponibili: minimo 0" })
    .max(99999, { error: "Pezzi disponibili: massimo 99999" }),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, { error: "Inserisci il nome utente" }).max(100),
  password: z.string().min(1, { error: "Inserisci la password" }).max(200),
});

export const uuidSchema = z.uuid();

/** Converte gli errori zod in { campo: messaggio } per i form. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Parola da digitare per confermare l'azzeramento delle statistiche. */
export const RESET_CONFIRM_WORD = "AZZERA";

export const resetStatsSchema = z.object({
  confirm: z.literal(RESET_CONFIRM_WORD, { error: `Scrivi ${RESET_CONFIRM_WORD} per confermare` }),
});

export const prizeUpdateSchema = z.object({
  label: z
    .string({ error: "Inserisci il nome del premio" })
    .trim()
    .min(1, { error: "Inserisci il nome del premio" })
    .max(40, { error: "Nome: massimo 40 caratteri" }),
  winMessage: z
    .string()
    .trim()
    .max(120, { error: "Messaggio: massimo 120 caratteri" })
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
});
