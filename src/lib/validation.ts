import { z } from "zod";
import { ANSWER_LETTERS, PRIZE_TYPES } from "@/types/quiz";

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

/** La domanda è nota al server (sessione del partecipante): si invia solo la lettera. */
export const answerSubmissionSchema = z.object({
  answer: answerLetterSchema,
});

export const MIN_AGE = 0;
export const MAX_AGE = 120;
const AGE_ERROR = `Inserisci un'età valida (numero intero da ${MIN_AGE} a ${MAX_AGE})`;

/** Età: solo numeri interi, niente negativi, decimali o testo. Accetta "12" o 12. */
export const ageSchema = z
  .union([z.number(), z.string().trim().regex(/^\d{1,3}$/, { error: AGE_ERROR }).transform(Number)], {
    error: AGE_ERROR,
  })
  .pipe(z.number().int({ error: AGE_ERROR }).min(MIN_AGE, { error: AGE_ERROR }).max(MAX_AGE, { error: AGE_ERROR }));

export const entrySchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, { error: "Codice non valido" }),
  age: ageSchema,
});

/** Codice premio come digitato in cassa (la normalizzazione avviene nel DB). */
export const prizeCodeSchema = z.object({
  code: z
    .string({ error: "Inserisci il codice del premio" })
    .trim()
    .min(1, { error: "Inserisci il codice del premio" })
    .max(20, { error: "Codice non valido. Verifica il codice inserito." }),
});

export const prizeTypeSchema = z.enum(PRIZE_TYPES);

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
  mode: z.enum(["all", "keep_pending"], { error: "Scegli cosa azzerare" }),
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
