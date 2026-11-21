import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { toPublicQuestion } from "@/lib/services/quiz";
import {
  answerSubmissionSchema,
  houseSchema,
  prizeKeySchema,
  prizeUpdateSchema,
  questionInputSchema,
  startGameSchema,
} from "@/lib/validation";

describe("protezione della risposta corretta", () => {
  it("toPublicQuestion scarta qualsiasi campo non previsto (es. correct_answer)", () => {
    const row = {
      id: "7bfe2b8b-0adb-44c2-a874-735e08b51835",
      question_text: "Domanda?",
      answer_a: "a",
      answer_b: "b",
      answer_c: "c",
      answer_d: "d",
      difficulty: 2,
      correct_answer: "C",
      is_correct: true,
    };
    const pub = toPublicQuestion(row);
    expect(JSON.stringify(pub)).not.toMatch(/correct/i);
    expect(pub.difficulty).toBe(2);
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
    difficulty: 1,
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
    expect(questionInputSchema.safeParse({ ...valid, difficulty: 3 }).success).toBe(false);
    expect(questionInputSchema.safeParse({ ...valid, difficulty: "1" }).success).toBe(false);
  });

  it("rifiuta invii di risposta malformati", () => {
    expect(answerSubmissionSchema.safeParse({ answer: "A" }).success).toBe(true);
    expect(answerSubmissionSchema.safeParse({ answer: "AB" }).success).toBe(false);
    expect(answerSubmissionSchema.safeParse({ answer: "e" }).success).toBe(false);
    expect(answerSubmissionSchema.safeParse({}).success).toBe(false);
  });

  it("gioco, casetta e premi ammessi", () => {
    expect(startGameSchema.safeParse({ mode: "casette" }).success).toBe(true);
    expect(startGameSchema.safeParse({ mode: "bigmac" }).success).toBe(true);
    expect(startGameSchema.safeParse({ mode: "tombola" }).success).toBe(false);
    expect(houseSchema.safeParse({ house: "roma-palidoro" }).success).toBe(true);
    expect(houseSchema.safeParse({ house: "napoli" }).success).toBe(false);
    expect(prizeKeySchema.safeParse("profumatore").success).toBe(true);
    expect(prizeKeySchema.safeParse("caffe").success).toBe(false);
  });

  it("pezzi disponibili: interi da 0 a 99999 (o null)", () => {
    expect(prizeUpdateSchema.parse({ label: "Cono", stock: 10 }).stock).toBe(10);
    expect(prizeUpdateSchema.parse({ label: "Big Mac" }).stock).toBeNull();
    for (const bad of [-1, 1.5, 100000, "5"]) {
      expect(prizeUpdateSchema.safeParse({ label: "Cono", stock: bad }).success, String(bad)).toBe(false);
    }
  });
});
