"use client";

import { CircleAlert, Clock, RefreshCw, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { LoseScreen, WinScreen } from "@/components/quiz/ResultScreens";
import { Spinner } from "@/components/ui/Spinner";
import { apiFetch } from "@/lib/client/api";
import type { AnswerLetter, ParticipantState, PublicQuestion } from "@/types/quiz";

type Phase =
  | { kind: "question"; question: PublicQuestion; notice?: string }
  | { kind: "result"; question: PublicQuestion; correct: boolean; alreadyAnswered: boolean }
  | { kind: "empty" }
  | { kind: "error" };

function initialPhase(state: ParticipantState): Phase {
  switch (state.kind) {
    case "question":
      return { kind: "question", question: state.question };
    case "answered":
      return { kind: "result", question: state.question, correct: state.correct, alreadyAnswered: true };
    default:
      return { kind: state.kind };
  }
}

function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export function QuizApp({ initialState }: { initialState: ParticipantState }) {
  const [phase, setPhase] = useState<Phase>(() => initialPhase(initialState));

  // Se il server invia un nuovo stato (es. dopo "Riprova"), lo si adotta.
  const [prevState, setPrevState] = useState(initialState);
  if (initialState !== prevState) {
    setPrevState(initialState);
    setPhase(initialPhase(initialState));
  }

  if (phase.kind === "result") {
    return phase.correct ? (
      <WinScreen date={phase.question.date} alreadyAnswered={phase.alreadyAnswered} />
    ) : (
      <LoseScreen alreadyAnswered={phase.alreadyAnswered} />
    );
  }

  return (
    <QuizLayout>
      {phase.kind === "question" && (
        <QuestionView
          key={phase.question.id}
          question={phase.question}
          notice={phase.notice}
          onResult={(correct, alreadyAnswered) =>
            setPhase({ kind: "result", question: phase.question, correct, alreadyAnswered })
          }
          onChanged={(next) => setPhase(next)}
        />
      )}
      {phase.kind === "empty" && (
        <MessageCard
          icon={<Clock className="size-10 text-mc-red" aria-hidden />}
          title="Al momento non ci sono domande disponibili."
          text="Torna a trovarci presto!"
        />
      )}
      {phase.kind === "error" && <ErrorCard />}
    </QuizLayout>
  );
}

function QuizLayout({ children }: { children: React.ReactNode }) {
  const online = useOnlineStatus();
  return (
    <main className="flex min-h-dvh flex-col bg-cream">
      {!online && (
        <div
          role="status"
          className="sticky top-0 z-20 flex items-center justify-center gap-2 bg-ink px-4 pb-2 pt-[calc(var(--safe-top)+8px)] text-sm font-bold text-white"
        >
          <WifiOff className="size-4" aria-hidden /> Sei offline: controlla la connessione.
        </div>
      )}
      <header className="relative bg-mc-red px-5 pb-14 pt-[calc(var(--safe-top)+16px)] text-center text-white">
        <div className="mx-auto flex max-w-md flex-col items-center gap-3">
          <BrandLogo size="md" />
          <h1 className="mt-1 text-[28px] font-black leading-none tracking-tight text-mc-yellow sm:text-3xl">
            IL QUIZ DEL GIORNO
          </h1>
          <p className="text-base font-bold text-white/95">Rispondi correttamente e vinci un premio!</p>
        </div>
        <svg
          className="absolute inset-x-0 -bottom-px h-8 w-full text-cream"
          viewBox="0 0 100 10"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M0 10 C 30 0, 70 0, 100 10 Z" fill="currentColor" />
        </svg>
      </header>

      <div className="mx-auto -mt-10 flex w-full max-w-md flex-1 flex-col px-4 pb-[calc(var(--safe-bottom)+20px)]">
        {children}
        <footer className="mt-auto pt-8 text-center text-[15px] font-bold text-ink-soft">
          Buona fortuna e grazie per aver partecipato!
        </footer>
      </div>
    </main>
  );
}

function QuestionView({
  question,
  notice,
  onResult,
  onChanged,
}: {
  question: PublicQuestion;
  notice?: string;
  onResult: (correct: boolean, alreadyAnswered: boolean) => void;
  onChanged: (next: Phase) => void;
}) {
  const [selected, setSelected] = useState<AnswerLetter | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  function choose(letter: AnswerLetter) {
    if (submitting) return;
    setSelected(letter);
    setError(null);
    // Porta il pulsante di conferma in vista sugli schermi piccoli.
    requestAnimationFrame(() => confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  async function reloadToday(message: string) {
    const res = await apiFetch<{
      question: PublicQuestion | null;
      alreadyAnswered?: boolean;
      correct?: boolean;
    }>("/api/question/today");
    if (!res.ok || !res.data) {
      onChanged({ kind: "error" });
    } else if (!res.data.question) {
      onChanged({ kind: "empty" });
    } else if (res.data.alreadyAnswered) {
      onChanged({ kind: "result", question: res.data.question, correct: Boolean(res.data.correct), alreadyAnswered: true });
    } else {
      onChanged({ kind: "question", question: res.data.question, notice: message });
    }
  }

  async function submit() {
    // Protezione contro richieste duplicate (doppio tocco).
    if (!selected || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);

    const res = await apiFetch<{ correct: boolean; alreadyAnswered: boolean }>("/api/answer", {
      method: "POST",
      body: { questionId: question.id, answer: selected },
    });

    if (res.ok && res.data) {
      onResult(res.data.correct, res.data.alreadyAnswered);
      return;
    }
    if (res.code === "stale") {
      await reloadToday("È iniziato un nuovo giorno: ecco la nuova domanda!");
      return;
    }
    if (res.code === "no_question") {
      onChanged({ kind: "empty" });
      return;
    }
    setError(res.error ?? "Si è verificato un errore. Riprova.");
    setSubmitting(false);
    inFlight.current = false;
  }

  return (
    <div className="flex flex-col gap-5">
      {notice && (
        <p role="status" className="animate-fade-up rounded-2xl bg-mc-yellow px-4 py-3 text-center font-extrabold text-ink">
          {notice}
        </p>
      )}

      <section
        aria-labelledby="question-text"
        className="relative z-10 animate-fade-up rounded-3xl border-4 border-mc-yellow bg-white px-5 py-6 text-center shadow-[0_10px_30px_-10px_rgba(0,0,0,0.25)]"
      >
        <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-mc-red">La domanda del giorno!</p>
        <h2 id="question-text" className="text-[24px] font-black leading-snug text-ink [overflow-wrap:anywhere] sm:text-[26px]">
          {question.questionText}
        </h2>
      </section>

      <div role="radiogroup" aria-labelledby="question-text" className="flex flex-col gap-3">
        {question.answers.map((a, i) => {
          const isSelected = selected === a.letter;
          return (
            <button
              key={a.letter}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={submitting}
              onClick={() => choose(a.letter)}
              style={{ animationDelay: `${0.08 * (i + 1)}s` }}
              className={`flex min-h-16 w-full animate-fade-up items-center gap-4 rounded-2xl border-[3px] px-4 py-3 text-left transition-[transform,background-color,border-color,box-shadow] duration-150 active:scale-[0.98] disabled:cursor-not-allowed ${
                isSelected
                  ? "border-mc-red bg-mc-yellow shadow-[0_4px_0_0_var(--color-mc-red-dark)]"
                  : "border-transparent bg-white shadow-[0_3px_0_0_rgba(0,0,0,0.08)] hover:border-mc-yellow"
              } ${submitting && !isSelected ? "opacity-50" : ""}`}
            >
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-xl text-xl font-black transition-colors ${
                  isSelected ? "bg-mc-red text-white" : "bg-mc-yellow text-ink"
                }`}
                aria-hidden
              >
                {a.letter}
              </span>
              <span className="min-w-0 flex-1 text-[19px] font-extrabold leading-snug text-ink [overflow-wrap:anywhere]">
                {a.text}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 font-bold text-mc-red-dark">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <button
        ref={confirmRef}
        type="button"
        onClick={submit}
        disabled={!selected || submitting}
        className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-mc-red text-xl font-black text-white shadow-[0_5px_0_0_var(--color-mc-red-darker)] transition active:translate-y-1 active:shadow-none disabled:bg-neutral-300 disabled:text-neutral-500 disabled:shadow-[0_5px_0_0_#bdbdbd]"
      >
        {submitting ? (
          <>
            <Spinner className="size-6" /> Verifica in corso…
          </>
        ) : selected ? (
          "Conferma risposta"
        ) : (
          "Scegli una risposta"
        )}
      </button>
    </div>
  );
}

function MessageCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <section className="relative z-10 animate-fade-up rounded-3xl bg-white px-6 py-10 text-center shadow-[0_10px_30px_-10px_rgba(0,0,0,0.25)]">
      <div className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-mc-yellow-light">{icon}</div>
      <h2 className="text-2xl font-black leading-snug text-ink">{title}</h2>
      <p className="mt-3 text-lg font-bold text-ink-soft">{text}</p>
    </section>
  );
}

function ErrorCard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <section className="relative z-10 animate-fade-up rounded-3xl bg-white px-6 py-10 text-center shadow-[0_10px_30px_-10px_rgba(0,0,0,0.25)]">
      <div className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-red-50">
        <WifiOff className="size-10 text-mc-red" aria-hidden />
      </div>
      <h2 className="text-2xl font-black text-ink">Ops! Qualcosa non ha funzionato</h2>
      <p className="mt-3 text-lg font-bold text-ink-soft">
        Non riusciamo a caricare la domanda. Controlla la connessione e riprova.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
        className="mx-auto mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-mc-red text-lg font-black text-white shadow-[0_4px_0_0_var(--color-mc-red-darker)] active:translate-y-0.5 active:shadow-none disabled:opacity-70"
      >
        {pending ? <Spinner /> : <RefreshCw className="size-5" aria-hidden />}
        Riprova
      </button>
    </section>
  );
}
