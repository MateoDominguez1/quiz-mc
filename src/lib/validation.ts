import { z } from "zod";
import { ANSWER_LETTERS } from "@/types/quiz";

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

export const answerSubmissionSchema = z.object({
  questionId: z.uuid({ error: "Domanda non valida" }),
  answer: answerLetterSchema,
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
