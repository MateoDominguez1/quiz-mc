import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { toPublicQuestion } from "@/lib/services/quiz";
import { ageSchema, answerSubmissionSchema, entrySchema, prizeTypeSchema, questionInputSchema } from "@/lib/validation";

describe("protezione della risposta corretta", () => {
  it("toPublicQuestion scarta qualsiasi campo non previsto (es. correct_answer)", () => {
    const row = {
      id: "7bfe2b8b-0adb-44c2-a874-735e08b51835",
      question_text: "Domanda?",
      answer_a: "a",
      answer_b: "b",
      answer_c: "c",
      answer_d: "d",
      question_date: "2026-11-13",
      already_answered: false,
      correct_answer: "C",
    };
    const pub = toPublicQuestion(row);
    expect(JSON.stringify(pub)).not.toMatch(/correct/i);
    expect(pub.answers.map((a) => a.letter)).toEqual(["A", "B", "C", "D"]);
  });

  it("nessun componente client importa moduli server o la service role key", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(tsx?|jsx?)$/.test(name)) files.push(p);
      }
    };
    walk(join(__dirname, "../../src"));
    const clientFiles = files.filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")));
    expect(clientFiles.length).toBeGreaterThan(0);
    for (const f of clientFiles) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/SERVICE_ROLE|supabase\/server|lib\/services|lib\/auth|lib\/env/);
    }
  });
});

describe("validazione", () => {
  const valid = {
    questionText: "Domanda?",
    answerA: "Uno",
    answerB: "Due",
    answerC: "Tre",
    answerD: "Quattro",
    correctAnswer: "B",
    isActive: true,
  };

  it("accetta una domanda completa", () => {
    expect(questionInputSchema.safeParse(valid).success).toBe(true);
  });

  it("rifiuta domande incomplete, risposte duplicate o risposta corretta non valida", () => {
    expect(questionInputSchema.safeParse({ ...valid, answerC: "   " }).success).toBe(false);
    expect(questionInputSchema.safeParse({ ...valid, questionText: "" }).success).toBe(false);
    expect(questionInputSchema.safeParse({ ...valid, correctAnswer: "E" }).success).toBe(false);
    expect(questionInputSchema.safeParse({ ...valid, correctAnswer: "" }).success).toBe(false);
    expect(questionInputSchema.safeParse({ ...valid, answerB: "uno" }).success).toBe(false);
  });

  it("rifiuta invii di risposta malformati", () => {
    expect(answerSubmissionSchema.safeParse({ answer: "A" }).success).toBe(true);
    expect(answerSubmissionSchema.safeParse({ answer: "AB" }).success).toBe(false);
    expect(answerSubmissionSchema.safeParse({ answer: "e" }).success).toBe(false);
    expect(answerSubmissionSchema.safeParse({}).success).toBe(false);
  });

  it("età: solo interi da 0 a 120", () => {
    for (const ok of [0, 10, 11, 17, 18, 120, "0", "25", " 42 "]) {
      expect(ageSchema.safeParse(ok).success, String(ok)).toBe(true);
    }
    for (const bad of [-1, 121, 12.5, "12.5", "-3", "abc", "", "1e2", null, undefined, true, "0x10"]) {
      expect(ageSchema.safeParse(bad).success, String(bad)).toBe(false);
    }
    expect(ageSchema.parse("07")).toBe(7);
  });

  it("token QR: formato base64url di 43 caratteri", () => {
    const token = "A".repeat(43);
    expect(entrySchema.safeParse({ token, age: 20 }).success).toBe(true);
    expect(entrySchema.safeParse({ token: token.slice(1), age: 20 }).success).toBe(false);
    expect(entrySchema.safeParse({ token: `${token.slice(1)}/`, age: 20 }).success).toBe(false);
  });

  it("tipi di premio ammessi", () => {
    expect(prizeTypeSchema.safeParse("cono").success).toBe(true);
    expect(prizeTypeSchema.safeParse("pizza").success).toBe(false);
  });
});
