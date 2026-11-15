"use client";

import { CircleAlert, Clock, QrCode, RefreshCw, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { LoseScreen, WinScreen } from "@/components/quiz/ResultScreens";
import { Spinner } from "@/components/ui/Spinner";
import { apiFetch } from "@/lib/client/api";
import { NO_SESSION_MESSAGE } from "@/lib/messages";
import type { AnswerLetter, ParticipantState, PublicQuestion } from "@/types/quiz";

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
  const [state, setState] = useState<ParticipantState>(initialState);

  // Se il server invia un nuovo stato (es. dopo "Riprova"), lo si adotta.
  const [prevState, setPrevState] = useState(initialState);
  if (initialState !== prevState) {
    setPrevState(initialState);
    setState(initialState);
  }

  if (state.kind === "won") return <WinScreen prize={state.prize} />;
  if (state.kind === "lost") return <LoseScreen />;

  return (
    <QuizLayout>
      {state.kind === "question" && (
        <QuestionView key={state.question.id} question={state.question} onState={setState} />
      )}
      {state.kind === "no_session" && (
        <MessageCard
          icon={<QrCode className="size-10 text-brand-red" aria-hidden />}
          title={NO_SESSION_MESSAGE}
          text="Scansiona il codice con la fotocamera del telefono e inizia a giocare."
        />
      )}
      {state.kind === "no_question" && (
        <MessageCard
          icon={<Clock className="size-10 text-brand-red" aria-hidden />}
          title="Al momento non ci sono domande disponibili."
          text="Rivolgiti alla cassa: il personale ti aiuterà."
        />
      )}
      {state.kind === "error" && <ErrorCard />}
    </QuizLayout>
  );
}

export function QuizLayout({ children, intro = true }: { children: ReactNode; intro?: boolean }) {
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
      <header className="relative bg-brand-red px-5 pb-14 pt-[calc(var(--safe-top)+16px)] text-center text-white">
        <div className="mx-auto flex max-w-md flex-col items-center gap-3">
          <BrandLogo size="md" />
          {intro && <p className="text-base font-bold text-white/95">Rispondi correttamente e vinci un premio!</p>}
        </div>
        <svg className="absolute inset-x-0 -bottom-px h-8 w-full text-cream" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden>
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

function QuestionView({ question, onState }: { question: PublicQuestion; onState: (s: ParticipantState) => void }) {
  const [selected, setSelected] = useState<AnswerLetter | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  function choose(letter: AnswerLetter) {
    if (submitting) return;
    setSelected(letter);
    setError(null);
    requestAnimationFrame(() => confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  async function submit() {
    // Protezione contro richieste duplicate (doppio tocco).
    if (!selected || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);

    const res = await apiFetch<{ state: ParticipantState }>("/api/answer", {
      method: "POST",
      body: { answer: selected },
    });
    if (res.ok && res.data) {
      onState(res.data.state);
      return;
    }
    if (res.code === "no_session") {
      onState({ kind: "no_session" });
      return;
    }
    setError(res.error ?? "Si è verificato un errore. Riprova.");
    setSubmitting(false);
    inFlight.current = false;
  }

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-labelledby="question-text"
        className="relative z-10 animate-fade-up rounded-3xl border-4 border-brand-yellow bg-white px-5 py-6 text-center shadow-[0_10px_30px_-10px_rgba(0,0,0,0.25)]"
      >
        <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-brand-red">La tua domanda</p>
        <h1 id="question-text" className="text-[24px] font-black leading-snug text-ink [overflow-wrap:anywhere] sm:text-[26px]">
          {question.questionText}
        </h1>
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
              aria-label={`${a.letter}: ${a.text}`}
              disabled={submitting}
              onClick={() => choose(a.letter)}
              style={{ animationDelay: `${0.08 * (i + 1)}s` }}
              className={`flex min-h-16 w-full animate-fade-up items-center gap-4 rounded-2xl border-[3px] px-4 py-3 text-left transition-[transform,background-color,border-color,box-shadow] duration-150 active:scale-[0.98] disabled:cursor-not-allowed ${
                isSelected
                  ? "border-brand-red bg-brand-yellow shadow-[0_4px_0_0_var(--color-brand-red-dark)]"
                  : "border-neutral-200 bg-white shadow-[0_3px_0_0_rgba(0,0,0,0.08)] hover:border-brand-yellow"
              } ${submitting && !isSelected ? "opacity-50" : ""}`}
            >
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-xl text-xl font-black transition-colors ${
                  isSelected ? "bg-brand-red text-white" : "bg-brand-yellow text-ink"
                }`}
                aria-hidden
              >
                {a.letter}
              </span>
              <span className="min-w-0 flex-1 text-[19px] font-extrabold leading-snug text-ink [overflow-wrap:anywhere]">{a.text}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 font-bold text-brand-red-dark">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <button
        ref={confirmRef}
        type="button"
        onClick={submit}
        disabled={!selected || submitting}
        className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-brand-red text-xl font-black text-white shadow-[0_5px_0_0_var(--color-brand-red-darker)] transition active:translate-y-1 active:shadow-none disabled:bg-neutral-300 disabled:text-neutral-500 disabled:shadow-[0_5px_0_0_#bdbdbd]"
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

export function MessageCard({ icon, title, text, children }: { icon: ReactNode; title: string; text?: string; children?: ReactNode }) {
  return (
    <section className="relative z-10 animate-fade-up rounded-3xl bg-white px-6 py-10 text-center shadow-[0_10px_30px_-10px_rgba(0,0,0,0.25)]">
      <div className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-brand-yellow-light">{icon}</div>
      <h1 className="text-2xl font-black leading-snug text-ink">{title}</h1>
      {text && <p className="mt-3 text-lg font-bold text-ink-soft">{text}</p>}
      {children}
    </section>
  );
}

function ErrorCard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <MessageCard
      icon={<WifiOff className="size-10 text-brand-red" aria-hidden />}
      title="Ops! Qualcosa non ha funzionato"
      text="Controlla la connessione e riprova."
    >
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
        className="mx-auto mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-red text-lg font-black text-white shadow-[0_4px_0_0_var(--color-brand-red-darker)] active:translate-y-0.5 active:shadow-none disabled:opacity-70"
      >
        {pending ? <Spinner /> : <RefreshCw className="size-5" aria-hidden />}
        Riprova
      </button>
    </MessageCard>
  );
}
