"use client";

import { Check, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useToast } from "@/components/admin/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { apiFetch } from "@/lib/client/api";
import { questionInputSchema, fieldErrors } from "@/lib/validation";
import { ANSWER_LETTERS, type AdminQuestion, type AnswerLetter } from "@/types/quiz";

type FormState = {
  questionText: string;
  answerA: string;
  answerB: string;
  answerC: string;
  answerD: string;
  correctAnswer: AnswerLetter | "";
  isActive: boolean;
};

const answerKey = (l: AnswerLetter) => `answer${l}` as const;

export function QuestionForm({ initial }: { initial?: AdminQuestion }) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = Boolean(initial);
  const [form, setForm] = useState<FormState>({
    questionText: initial?.questionText ?? "",
    answerA: initial?.answerA ?? "",
    answerB: initial?.answerB ?? "",
    answerC: initial?.answerC ?? "",
    answerD: initial?.answerD ?? "",
    correctAnswer: initial?.correctAnswer ?? "",
    isActive: initial?.isActive ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as string]) setErrors((e) => ({ ...e, [key as string]: "" }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;

    // Validazione lato client (la stessa viene ripetuta sul server).
    const parsed = questionInputSchema.safeParse(form);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors(errs);
      const first = Object.keys(errs)[0];
      document.getElementById(first === "correctAnswer" ? "correct-A" : first)?.focus();
      toast.show("error", "Completa tutti i campi obbligatori.");
      return;
    }

    inFlight.current = true;
    setSaving(true);
    const res = await apiFetch(isEdit ? `/api/admin/questions/${initial!.id}` : "/api/admin/questions", {
      method: isEdit ? "PUT" : "POST",
      body: parsed.data,
    });
    if (res.ok) {
      toast.show("success", isEdit ? "Domanda aggiornata correttamente." : "Domanda salvata correttamente.");
      router.push("/admin/domande");
      router.refresh();
      return;
    }
    if (res.status === 401) {
      toast.show("error", res.error ?? "Sessione scaduta.");
      router.replace("/admin");
      return;
    }
    if (res.fields) setErrors(res.fields);
    toast.show("error", res.error ?? "Impossibile salvare la domanda.");
    setSaving(false);
    inFlight.current = false;
  }

  const inputClass = (field: string) =>
    `w-full rounded-2xl border-2 bg-white px-4 font-semibold text-ink outline-none transition focus:ring-4 ${
      errors[field]
        ? "border-mc-red focus:ring-mc-red/20"
        : "border-neutral-200 focus:border-mc-yellow-dark focus:ring-mc-yellow/30"
    }`;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div className="space-y-2 rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <label htmlFor="questionText" className="block font-black">
          Domanda <span className="text-mc-red">*</span>
        </label>
        <textarea
          id="questionText"
          rows={4}
          maxLength={500}
          value={form.questionText}
          onChange={(e) => update("questionText", e.target.value)}
          placeholder="Es. In quale anno è stato aperto il primo ristorante in Italia?"
          className={`${inputClass("questionText")} resize-y py-3 leading-relaxed`}
          aria-invalid={Boolean(errors.questionText)}
          aria-describedby={errors.questionText ? "questionText-error" : undefined}
        />
        <div className="flex justify-between gap-3 text-sm">
          {errors.questionText ? (
            <p id="questionText-error" className="font-bold text-mc-red">
              {errors.questionText}
            </p>
          ) : (
            <span />
          )}
          <span className="tabular-nums text-neutral-500">{form.questionText.length}/500</span>
        </div>
      </div>

      <fieldset className="space-y-4 rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <legend className="sr-only">Risposte</legend>
        <p className="font-black">
          Risposte <span className="text-mc-red">*</span>
        </p>
        {ANSWER_LETTERS.map((l) => {
          const key = answerKey(l);
          return (
            <div key={l} className="space-y-1.5">
              <label htmlFor={key} className="block text-sm font-extrabold text-ink-soft">
                Risposta {l}
              </label>
              <div className="flex items-center gap-3">
                <span
                  className={`grid size-12 shrink-0 place-items-center rounded-xl text-lg font-black ${
                    form.correctAnswer === l ? "bg-emerald-500 text-white" : "bg-mc-yellow text-ink"
                  }`}
                  aria-hidden
                >
                  {l}
                </span>
                <input
                  id={key}
                  maxLength={200}
                  value={form[key]}
                  onChange={(e) => update(key, e.target.value)}
                  className={`${inputClass(key)} h-12`}
                  aria-invalid={Boolean(errors[key])}
                />
              </div>
              {errors[key] && <p className="pl-[60px] text-sm font-bold text-mc-red">{errors[key]}</p>}
            </div>
          );
        })}
      </fieldset>

      <fieldset className="space-y-3 rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <legend className="sr-only">Risposta corretta</legend>
        <p className="font-black">
          Risposta corretta <span className="text-mc-red">*</span>
        </p>
        <div role="radiogroup" aria-label="Risposta corretta" className="grid grid-cols-4 gap-2 sm:gap-3">
          {ANSWER_LETTERS.map((l) => {
            const checked = form.correctAnswer === l;
            return (
              <label
                key={l}
                className={`flex h-14 cursor-pointer items-center justify-center gap-1.5 rounded-2xl border-2 text-lg font-black transition ${
                  checked
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-neutral-200 bg-white text-ink hover:border-neutral-300"
                }`}
              >
                <input
                  id={`correct-${l}`}
                  type="radio"
                  name="correctAnswer"
                  value={l}
                  checked={checked}
                  onChange={() => update("correctAnswer", l)}
                  className="sr-only"
                />
                {checked && <Check className="size-5" aria-hidden />}
                {l}
              </label>
            );
          })}
        </div>
        {errors.correctAnswer && <p className="text-sm font-bold text-mc-red">{errors.correctAnswer}</p>}
      </fieldset>

      <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="block font-black">Domanda attiva</span>
            <span className="block text-sm text-ink-soft">
              Solo le domande attive possono essere scelte come domanda del giorno.
            </span>
          </span>
          <span className="relative inline-flex shrink-0">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => update("isActive", e.target.checked)}
              className="peer sr-only"
            />
            <span className="h-8 w-14 rounded-full bg-neutral-300 transition peer-checked:bg-emerald-500 peer-focus-visible:ring-4 peer-focus-visible:ring-mc-yellow/50" />
            <span className="absolute left-1 top-1 size-6 rounded-full bg-white shadow transition peer-checked:translate-x-6" />
          </span>
        </label>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/admin/domande"
          className="flex h-14 items-center justify-center rounded-2xl bg-white px-6 font-black text-ink shadow-sm hover:bg-neutral-50"
        >
          Annulla
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-mc-red px-8 text-lg font-black text-white shadow-[0_4px_0_0_var(--color-mc-red-darker)] transition active:translate-y-0.5 active:shadow-none disabled:opacity-70"
        >
          {saving ? <Spinner /> : <Save className="size-5" aria-hidden />}
          {saving ? "Salvataggio…" : "Salva domanda"}
        </button>
      </div>
    </form>
  );
}
