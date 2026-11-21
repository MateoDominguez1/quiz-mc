"use client";

import { CircleAlert, CircleCheck, Lock, RefreshCw, RotateCcw, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { HouseArt } from "@/components/quiz/HouseArt";
import { LoseScreen, WinScreen } from "@/components/quiz/ResultScreens";
import { Spinner } from "@/components/ui/Spinner";
import { apiFetch, type ApiResult } from "@/lib/client/api";
import {
  DIFFICULTY_INFO,
  GAME_INFO,
  GAME_MODES,
  HOUSE_INFO,
  HOUSE_KEYS,
  type AnswerLetter,
  type GameMode,
  type GameState,
  type HouseKey,
  type MenuInfo,
  type PublicQuestion,
} from "@/types/quiz";

type Payload = { state: GameState; correct?: boolean | null };

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

/** Chiamate alle API della partita; se il dispositivo non è più abilitato torna al login. */
function useGameApi() {
  const router = useRouter();
  return useCallback(
    async (url: string, method: string, body?: unknown): Promise<ApiResult<Payload>> => {
      const res = await apiFetch<Payload>(url, { method, body });
      if (res.status === 401 && res.code === "no_station") {
        router.replace("/postazione");
        router.refresh();
      }
      return res;
    },
    [router],
  );
}

export function QuizApp({ initialState }: { initialState: GameState }) {
  const call = useGameApi();
  const [state, setState] = useState<GameState>(initialState);
  /** Dopo una risposta esatta della sfida Big Mac: "Prossima domanda". */
  const [nextUp, setNextUp] = useState<Extract<GameState, { kind: "question" }> | null>(null);
  /** Banner "Risposta esatta!" sopra le casette. */
  const [justCorrect, setJustCorrect] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Se il server invia un nuovo stato (es. dopo "Riprova"), lo si adotta.
  const [prevState, setPrevState] = useState(initialState);
  if (initialState !== prevState) {
    setPrevState(initialState);
    setState(initialState);
    setNextUp(null);
  }

  function apply(next: GameState, correct?: boolean | null) {
    setJustCorrect(correct === true && next.kind === "pick_house");
    if (correct === true && next.kind === "question") {
      setNextUp(next);
      return;
    }
    setNextUp(null);
    setState(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function newCustomer() {
    if (resetting) return;
    setResetting(true);
    const res = await call("/api/game", "DELETE");
    setResetting(false);
    setConfirmReset(false);
    if (res.ok && res.data) apply(res.data.state);
    else if (res.status !== 401) setState({ kind: "error" });
  }

  const inProgress = state.kind === "question" || state.kind === "pick_house";

  if (state.kind === "won") {
    return <WinScreen state={state} busy={resetting} onNewCustomer={newCustomer} />;
  }
  if (state.kind === "lost") {
    return <LoseScreen state={state} busy={resetting} onNewCustomer={newCustomer} />;
  }

  return (
    <QuizLayout onNewCustomer={inProgress ? () => setConfirmReset(true) : undefined}>
      {nextUp && state.kind === "question" ? (
        <CorrectCard
          answered={state.step}
          total={state.totalSteps}
          onNext={() => {
            setState(nextUp);
            setNextUp(null);
          }}
        />
      ) : (
        <>
          {state.kind === "menu" && <MenuView menu={state.menu} call={call} onState={apply} />}
          {state.kind === "question" && (
            <QuestionView key={state.question.id} state={state} call={call} onState={apply} />
          )}
          {state.kind === "pick_house" && <HousePicker justCorrect={justCorrect} call={call} onState={apply} />}
          {state.kind === "error" && <ErrorCard />}
        </>
      )}

      <ConfirmDialog
        open={confirmReset}
        title="Nuovo cliente?"
        description={
          state.kind === "pick_house"
            ? "La casetta non è ancora stata scelta: il premio non verrà assegnato. Tornare alla scelta del gioco?"
            : "La partita in corso verrà annullata e si tornerà alla scelta del gioco."
        }
        confirmLabel="Nuovo cliente"
        loading={resetting}
        onConfirm={newCustomer}
        onCancel={() => setConfirmReset(false)}
      />
    </QuizLayout>
  );
}

export function QuizLayout({ children, onNewCustomer }: { children: ReactNode; onNewCustomer?: () => void }) {
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
        {onNewCustomer && (
          <button
            type="button"
            onClick={onNewCustomer}
            className="absolute right-3 top-[calc(var(--safe-top)+12px)] z-10 flex h-10 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-extrabold transition hover:bg-white/25"
          >
            <RotateCcw className="size-4" aria-hidden /> Nuovo cliente
          </button>
        )}
        <div className="mx-auto flex max-w-lg flex-col items-center gap-2">
          {/* Durante la partita al loro posto c'è il pulsante "Nuovo cliente". */}
          <p aria-hidden className={`text-2xl leading-none ${onNewCustomer ? "invisible" : ""}`}>
            🏠 🍔 🏠
          </p>
          <BrandLogo size="md" />
          <p className="text-base font-bold text-white/95">Le casette della fortuna &amp; la sfida Big Mac</p>
        </div>
        <svg className="absolute inset-x-0 -bottom-px h-8 w-full text-cream" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden>
          <path d="M0 10 C 30 0, 70 0, 100 10 Z" fill="currentColor" />
        </svg>
      </header>

      <div className="mx-auto -mt-10 flex w-full max-w-lg flex-1 flex-col px-4 pb-[calc(var(--safe-bottom)+20px)]">
        {children}
        <footer className="mt-auto space-y-1 pt-8 text-center text-ink-soft">
          <p className="text-[15px] font-bold">❤️ McHappy Days · Partecipazione gratuita, donazione volontaria.</p>
          <p className="text-sm font-semibold text-neutral-500">Premi da ritirare presso il personale.</p>
        </footer>
      </div>
    </main>
  );
}

type Call = ReturnType<typeof useGameApi>;
type OnState = (s: GameState, correct?: boolean | null) => void;

function MenuView({ menu, call, onState }: { menu: MenuInfo; call: Call; onState: OnState }) {
  const [loading, setLoading] = useState<GameMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmLock, setConfirmLock] = useState(false);
  const [locking, setLocking] = useState(false);
  const router = useRouter();

  async function start(mode: GameMode) {
    if (loading) return;
    setLoading(mode);
    setError(null);
    const res = await call("/api/game", "POST", { mode });
    setLoading(null);
    if (res.ok && res.data) {
      onState(res.data.state);
      return;
    }
    if (res.status !== 401) setError(res.error);
    // Disponibilità cambiata (es. premi esauriti): si aggiorna il menu.
    if (res.code === "no_stock" || res.code === "no_questions") router.refresh();
  }

  async function lock() {
    setLocking(true);
    await apiFetch("/api/postazione/logout", { method: "POST", body: {} });
    router.replace("/postazione");
    router.refresh();
  }

  const unavailable: Record<GameMode, string | null> = {
    casette:
      menu.casette === "no_stock"
        ? "Premi delle casette esauriti"
        : menu.casette === "no_questions"
          ? "Nessuna domanda facile attiva"
          : null,
    bigmac: menu.bigmac === "no_questions" ? "Servono domande attive facili, medie e difficili" : null,
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="relative z-10 animate-fade-up rounded-3xl border-4 border-brand-yellow bg-white px-5 py-6 text-center shadow-[0_10px_30px_-10px_rgba(0,0,0,0.25)]">
        <h1 className="text-[28px] font-black leading-tight text-ink">Scegli la tua sfida!</h1>
        <p className="mt-1 font-bold text-ink-soft">Rispondi correttamente e vinci un premio.</p>
      </section>

      {GAME_MODES.map((mode, i) => {
        const info = GAME_INFO[mode];
        const reason = unavailable[mode];
        const isLoading = loading === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => start(mode)}
            disabled={Boolean(reason) || loading !== null}
            style={{ animationDelay: `${0.08 * (i + 1)}s` }}
            className={`flex w-full animate-fade-up items-center gap-4 rounded-3xl border-[3px] px-5 py-5 text-left transition active:scale-[0.98] disabled:cursor-not-allowed ${
              mode === "bigmac"
                ? "border-brand-red bg-brand-red text-white shadow-[0_5px_0_0_var(--color-brand-red-darker)]"
                : "border-brand-yellow-dark bg-brand-yellow text-ink shadow-[0_5px_0_0_var(--color-brand-yellow-dark)]"
            } ${reason ? "opacity-50" : ""}`}
          >
            <span aria-hidden className="grid size-16 shrink-0 place-items-center rounded-2xl bg-white text-4xl shadow-sm">
              {isLoading ? <Spinner className="size-7 text-brand-red" /> : info.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[22px] font-black leading-tight">{info.title}</span>
              <span className={`mt-1 block text-[15px] font-bold ${mode === "bigmac" ? "text-white/90" : "text-ink-soft"}`}>
                {reason ?? info.subtitle}
              </span>
            </span>
          </button>
        );
      })}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 font-bold text-brand-red-dark">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <div className="mt-2 flex flex-col items-center gap-2 text-center">
        <p className="text-sm font-bold text-ink-soft">Premi delle casette rimasti: {menu.stockLeft}</p>
        <button
          type="button"
          onClick={() => setConfirmLock(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-neutral-400 hover:bg-neutral-100 hover:text-ink-soft"
        >
          <Lock className="size-3.5" aria-hidden /> Disabilita dispositivo
        </button>
      </div>

      <ConfirmDialog
        open={confirmLock}
        title="Disabilitare il dispositivo?"
        description="Per far giocare di nuovo i clienti servirà la password della postazione."
        confirmLabel="Disabilita"
        loading={locking}
        onConfirm={lock}
        onCancel={() => setConfirmLock(false)}
      />
    </div>
  );
}

function ProgressHeader({ state }: { state: Extract<GameState, { kind: "question" }> }) {
  const info = GAME_INFO[state.mode];
  const level = DIFFICULTY_INFO[state.question.difficulty];
  return (
    <div className="mb-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 text-sm font-black">
        <span className="text-brand-red">
          {info.emoji} {info.title}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs ${level.badge}`}>
          {level.emoji} {level.label}
        </span>
      </div>
      {state.totalSteps > 1 && (
        <div>
          <div className="mb-1 flex justify-between text-xs font-extrabold text-ink-soft">
            <span>
              Domanda {state.step}/{state.totalSteps}
            </span>
            <span>
              {state.step - 1} {state.step - 1 === 1 ? "risposta esatta" : "risposte esatte"}
            </span>
          </div>
          <div
            className="h-3 overflow-hidden rounded-full bg-neutral-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={state.totalSteps}
            aria-valuenow={state.step - 1}
            aria-label="Risposte esatte"
          >
            <div
              className="h-full rounded-full bg-brand-red transition-[width] duration-500"
              style={{ width: `${((state.step - 1) / state.totalSteps) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionView({
  state,
  call,
  onState,
}: {
  state: Extract<GameState, { kind: "question" }>;
  call: Call;
  onState: OnState;
}) {
  const question: PublicQuestion = state.question;
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

    const res = await call("/api/game/answer", "POST", { answer: selected });
    if (res.ok && res.data) {
      onState(res.data.state, res.data.correct);
      return;
    }
    if (res.status !== 401) setError(res.error ?? "Si è verificato un errore. Riprova.");
    setSubmitting(false);
    inFlight.current = false;
  }

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-labelledby="question-text"
        className="relative z-10 animate-fade-up rounded-3xl border-4 border-brand-yellow bg-white px-5 py-6 text-center shadow-[0_10px_30px_-10px_rgba(0,0,0,0.25)]"
      >
        <ProgressHeader state={state} />
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
          "Verifica risposta"
        ) : (
          "Scegli una risposta"
        )}
      </button>
    </div>
  );
}

/** Tra una domanda e l'altra della sfida Big Mac. */
function CorrectCard({ answered, total, onNext }: { answered: number; total: number; onNext: () => void }) {
  return (
    <MessageCard
      icon={<CircleCheck className="size-11 text-emerald-600" aria-hidden />}
      title="✅ Risposta esatta!"
      text={`${answered} ${answered === 1 ? "risposta esatta" : "risposte esatte"} su ${total}. Avanti così!`}
    >
      <button
        type="button"
        onClick={onNext}
        autoFocus
        className="mx-auto mt-6 flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-brand-red text-xl font-black text-white shadow-[0_5px_0_0_var(--color-brand-red-darker)] transition active:translate-y-1 active:shadow-none"
      >
        Prossima domanda 🎲
      </button>
    </MessageCard>
  );
}

function HousePicker({ justCorrect, call, onState }: { justCorrect: boolean; call: Call; onState: OnState }) {
  const [picked, setPicked] = useState<HouseKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(house: HouseKey) {
    if (picked) return;
    setPicked(house);
    setError(null);
    // Un attimo di suspense prima di scoprire il premio.
    const [res] = await Promise.all([
      call("/api/game/house", "POST", { house }),
      new Promise((r) => setTimeout(r, 900)),
    ]);
    if (res.ok && res.data) {
      onState(res.data.state);
      return;
    }
    if (res.status !== 401) setError(res.error ?? "Si è verificato un errore. Riprova.");
    setPicked(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="relative z-10 animate-fade-up rounded-3xl border-4 border-brand-yellow bg-white px-5 py-6 text-center shadow-[0_10px_30px_-10px_rgba(0,0,0,0.25)]">
        {justCorrect && (
          <p className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 font-black text-emerald-800">
            <CircleCheck className="size-5" aria-hidden /> Risposta esatta!
          </p>
        )}
        <h1 className="text-[26px] font-black leading-tight text-ink">Il villaggio della solidarietà</h1>
        <p className="mt-1 font-bold text-ink-soft">Scegli una delle cinque Case Ronald e scopri il tuo premio!</p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        {HOUSE_KEYS.map((h, i) => {
          const info = HOUSE_INFO[h];
          const isPicked = picked === h;
          const isLast = i === HOUSE_KEYS.length - 1 && HOUSE_KEYS.length % 2 === 1;
          return (
            <button
              key={h}
              type="button"
              onClick={() => pick(h)}
              disabled={picked !== null}
              aria-label={`Casa Ronald ${info.city}`}
              style={{ animationDelay: `${0.06 * (i + 1)}s` }}
              className={`group flex animate-fade-up flex-col items-center rounded-3xl border-[3px] bg-white p-3 text-center transition duration-150 hover:-translate-y-0.5 active:scale-[0.97] disabled:cursor-default ${
                isPicked ? "border-brand-red shadow-[0_5px_0_0_var(--color-brand-red-dark)]" : "border-brand-yellow shadow-[0_4px_0_0_var(--color-brand-yellow-dark)]"
              } ${picked && !isPicked ? "opacity-40" : ""} ${isLast ? "col-span-2 mx-auto w-[calc(50%-0.375rem)]" : ""}`}
            >
              <span className={`relative block w-full max-w-[150px] ${isPicked ? "animate-heartbeat" : ""}`}>
                <HouseArt house={h} className="block h-auto w-full" />
                {isPicked && (
                  <span className="absolute inset-0 grid place-items-center">
                    <Spinner className="size-8 text-brand-red" />
                  </span>
                )}
              </span>
              <span className="mt-2 block text-[15px] font-black leading-tight text-ink">
                Casa Ronald
                <br />
                {info.city}
              </span>
              <span className="mt-0.5 block text-xs font-bold text-ink-soft">{info.tagline}</span>
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs font-semibold text-neutral-500">Illustrazioni ispirate alle città italiane</p>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 font-bold text-brand-red-dark">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
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

