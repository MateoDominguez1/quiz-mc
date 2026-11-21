"use client";

import { ArrowRightLeft, CircleAlert, CircleCheck, Lock, MapPin, RefreshCw, RotateCcw, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { HouseArt } from "@/components/quiz/HouseArt";
import { LoseScreen, WinScreen } from "@/components/quiz/ResultScreens";
import { Spinner } from "@/components/ui/Spinner";
import { apiFetch, type ApiResult } from "@/lib/client/api";
import {
  DIFFICULTIES,
  DIFFICULTY_INFO,
  GAME_INFO,
  HOUSE_INFO,
  HOUSE_KEYS,
  type AnswerLetter,
  type GameMode,
  type GameState,
  type HouseKey,
  type MenuInfo,
  type PublicQuestion,
  type Restaurant,
} from "@/types/quiz";

type Payload = { state: GameState; correct?: boolean | null };

/** Colori delle lettere delle risposte: più vivace di un elenco tutto uguale. */
const LETTER_STYLE: Record<AnswerLetter, string> = {
  A: "bg-brand-red text-white",
  B: "bg-brand-yellow text-ink",
  C: "bg-emerald-500 text-white",
  D: "bg-sky-500 text-white",
};

const shortName = (name: string) => name.replace(/^McDonald's\s*/i, "");

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

export function QuizApp({ initialState, restaurant }: { initialState: GameState; restaurant: Restaurant | null }) {
  const call = useGameApi();
  const [state, setState] = useState<GameState>(initialState);
  const [place, setPlace] = useState<Restaurant | null>(restaurant);
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
    setPlace(restaurant);
    setNextUp(null);
  }

  function apply(next: GameState, correct?: boolean | null) {
    if (next.kind === "menu") setPlace(next.menu.restaurant);
    if (next.kind === "choose_restaurant") setPlace(null);
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
    return <WinScreen state={state} restaurant={place} busy={resetting} onNewCustomer={newCustomer} />;
  }
  if (state.kind === "lost") {
    return <LoseScreen state={state} restaurant={place} busy={resetting} onNewCustomer={newCustomer} />;
  }

  return (
    <QuizLayout restaurant={place} onNewCustomer={inProgress ? () => setConfirmReset(true) : undefined}>
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
          {state.kind === "choose_restaurant" && (
            <RestaurantPicker restaurants={state.restaurants} call={call} onState={apply} />
          )}
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

export function QuizLayout({
  children,
  restaurant,
  onNewCustomer,
}: {
  children: ReactNode;
  restaurant?: Restaurant | null;
  onNewCustomer?: () => void;
}) {
  const online = useOnlineStatus();
  return (
    <main className="quiz-bg flex min-h-dvh flex-col">
      {!online && (
        <div
          role="status"
          className="sticky top-0 z-20 flex items-center justify-center gap-2 bg-ink px-4 pb-2 pt-[calc(var(--safe-top)+8px)] text-sm font-bold text-white"
        >
          <WifiOff className="size-4" aria-hidden /> Sei offline: controlla la connessione.
        </div>
      )}
      <header className="quiz-header relative overflow-hidden px-5 pb-16 pt-[calc(var(--safe-top)+14px)] text-center text-white">
        {/* Decorazioni */}
        <span aria-hidden className="pointer-events-none absolute -left-6 top-6 text-6xl opacity-15 rotate-[-12deg]">
          🍟
        </span>
        <span aria-hidden className="pointer-events-none absolute -right-4 bottom-10 text-6xl opacity-15 rotate-[14deg]">
          🥤
        </span>

        <div className="relative mx-auto flex max-w-lg items-center justify-between gap-2">
          {restaurant ? (
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-extrabold backdrop-blur">
              <MapPin className="size-3.5 shrink-0 text-brand-yellow" aria-hidden />
              <span className="truncate">{restaurant.name}</span>
            </span>
          ) : (
            <span />
          )}
          {onNewCustomer && (
            <button
              type="button"
              onClick={onNewCustomer}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-black text-brand-red shadow-md transition hover:bg-brand-yellow-light"
            >
              <RotateCcw className="size-3.5" aria-hidden /> Nuovo cliente
            </button>
          )}
        </div>

        <div className="relative mx-auto mt-3 flex max-w-lg flex-col items-center gap-1">
          <p aria-hidden className="text-3xl leading-none drop-shadow">
            🏠 🍔 🏠
          </p>
          <h1 className="title-pop text-[40px] font-black leading-none tracking-tight text-brand-yellow sm:text-5xl">
            McHappy Quiz!
          </h1>
          <p className="mt-1 text-[15px] font-bold text-white/90">Le casette della fortuna &amp; la sfida Big Mac</p>
        </div>
        <svg className="absolute inset-x-0 -bottom-px h-10 w-full text-cream" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden>
          <path d="M0 10 C 25 0, 75 0, 100 10 Z" fill="currentColor" />
        </svg>
      </header>

      <div className="mx-auto -mt-12 flex w-full max-w-lg flex-1 flex-col px-4 pb-[calc(var(--safe-bottom)+20px)]">
        {children}
        <footer className="mt-auto space-y-1 pt-8 text-center text-ink-soft">
          <p className="text-[15px] font-bold">❤️ McHappy Days · Partecipazione gratuita, donazione volontaria.</p>
          <p className="text-sm font-semibold opacity-80">Premi da ritirare presso il personale.</p>
        </footer>
      </div>
    </main>
  );
}

type Call = ReturnType<typeof useGameApi>;
type OnState = (s: GameState, correct?: boolean | null) => void;

/** Bianco, arrotondato, con bordo e ombra calda: la "card" del quiz. */
const CARD =
  "relative z-10 rounded-[28px] border border-white/80 bg-white/95 shadow-[0_18px_40px_-18px_rgba(124,10,28,0.35)] backdrop-blur";

function RestaurantPicker({ restaurants, call, onState }: { restaurants: Restaurant[]; call: Call; onState: OnState }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const COLORS = [
    "from-brand-red to-brand-red-dark text-white",
    "from-brand-yellow to-brand-yellow-dark text-ink",
    "from-emerald-500 to-emerald-700 text-white",
    "from-sky-500 to-sky-700 text-white",
  ];

  async function choose(key: string) {
    if (busy) return;
    setBusy(key);
    setError(null);
    const res = await call("/api/postazione/restaurant", "POST", { restaurant: key });
    setBusy(null);
    if (res.ok && res.data) onState(res.data.state);
    else if (res.status !== 401) setError(res.error);
  }

  return (
    <div className="flex flex-col gap-4">
      <section className={`${CARD} animate-fade-up px-5 py-6 text-center`}>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-red">Configurazione dispositivo</p>
        <h2 className="mt-1 text-[26px] font-black leading-tight text-ink">In quale ristorante siamo?</h2>
        <p className="mt-1 font-bold text-ink-soft">Premi e partite sono separati per ogni ristorante.</p>
      </section>
      <div className="grid grid-cols-2 gap-3">
        {restaurants.map((r, i) => (
          <button
            key={r.key}
            type="button"
            onClick={() => choose(r.key)}
            disabled={busy !== null}
            style={{ animationDelay: `${0.06 * (i + 1)}s` }}
            className={`flex min-h-32 animate-fade-up flex-col justify-between rounded-3xl bg-gradient-to-br p-4 text-left shadow-[0_10px_24px_-12px_rgba(0,0,0,0.45)] transition active:scale-[0.97] disabled:opacity-60 ${COLORS[i % COLORS.length]}`}
          >
            <span className="grid size-10 place-items-center rounded-2xl bg-white/25">
              {busy === r.key ? <Spinner className="size-5" /> : <MapPin className="size-5" aria-hidden />}
            </span>
            <span>
              <span className="block text-xs font-extrabold uppercase tracking-wider opacity-80">McDonald&apos;s</span>
              <span className="block text-2xl font-black leading-tight">{shortName(r.name)}</span>
            </span>
          </button>
        ))}
      </div>
      {error && <ErrorBanner text={error} />}
    </div>
  );
}

function MenuView({ menu, call, onState }: { menu: MenuInfo; call: Call; onState: OnState }) {
  const [loading, setLoading] = useState<GameMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"lock" | "restaurant" | null>(null);
  const [working, setWorking] = useState(false);
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
    if (res.code === "no_stock" || res.code === "no_questions" || res.code === "no_restaurant") router.refresh();
  }

  async function confirmAction() {
    setWorking(true);
    if (confirm === "lock") {
      await apiFetch("/api/postazione/logout", { method: "POST", body: {} });
      router.replace("/postazione");
      router.refresh();
      return;
    }
    const res = await call("/api/postazione/restaurant", "DELETE");
    setWorking(false);
    setConfirm(null);
    if (res.ok && res.data) onState(res.data.state);
    else if (res.status !== 401) setError(res.error);
  }

  const reason: Record<GameMode, string | null> = {
    casette:
      menu.casette === "no_stock"
        ? "Premi delle casette esauriti"
        : menu.casette === "no_questions"
          ? "Nessuna domanda facile attiva"
          : null,
    bigmac: menu.bigmac === "no_questions" ? "Servono domande facili, medie e difficili" : null,
  };

  return (
    <div className="flex flex-col gap-4">
      <section className={`${CARD} animate-fade-up px-5 py-5 text-center`}>
        <h2 className="text-[28px] font-black leading-tight text-ink">Scegli la tua sfida!</h2>
        <p className="mt-0.5 font-bold text-ink-soft">Rispondi bene e vinci un premio 🎁</p>
      </section>

      {/* Le casette della fortuna */}
      <button
        type="button"
        onClick={() => start("casette")}
        disabled={Boolean(reason.casette) || loading !== null}
        className="group relative animate-fade-up overflow-hidden rounded-[28px] border-2 border-brand-yellow-dark/40 bg-gradient-to-br from-[#fff8e7] via-brand-yellow-light to-brand-yellow p-5 text-left shadow-[0_14px_30px_-16px_rgba(240,173,0,0.9)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        style={{ animationDelay: "0.08s" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-black text-emerald-700">
              {DIFFICULTY_INFO[0].emoji} 1 domanda facile
            </span>
            <span className="mt-2 block text-[24px] font-black leading-tight text-ink">
              {GAME_INFO.casette.emoji} {GAME_INFO.casette.title}
            </span>
            <span className="mt-1 block text-[15px] font-bold text-ink-soft">
              {reason.casette ?? "Indovina, scegli una Casa Ronald e scopri il premio misterioso!"}
            </span>
          </div>
          {loading === "casette" && <Spinner className="size-7 shrink-0 text-brand-red" />}
        </div>
        <div className="mt-4 flex items-end gap-1.5" aria-hidden>
          {HOUSE_KEYS.map((h, i) => (
            <HouseArt
              key={h}
              house={h}
              className={`h-auto w-1/5 rounded-xl shadow-sm transition-transform duration-300 group-hover:-translate-y-1 ${i % 2 ? "translate-y-1" : ""}`}
            />
          ))}
        </div>
        <span className="mt-3 inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-xs font-black text-ink-soft">
          🎁 {menu.stockLeft} premi rimasti
        </span>
      </button>

      {/* La sfida Big Mac */}
      <button
        type="button"
        onClick={() => start("bigmac")}
        disabled={Boolean(reason.bigmac) || loading !== null}
        className="group relative animate-fade-up overflow-hidden rounded-[28px] bg-gradient-to-br from-[#e01436] via-brand-red to-brand-red-darker p-5 text-left text-white shadow-[0_16px_32px_-16px_rgba(124,10,28,0.9)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        style={{ animationDelay: "0.16s" }}
      >
        <span aria-hidden className="pointer-events-none absolute -right-3 -top-2 text-[110px] leading-none opacity-90 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105">
          🍔
        </span>
        <span className="relative block max-w-[70%]">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-black">
            3 domande di fila
          </span>
          <span className="mt-2 block text-[24px] font-black leading-tight text-brand-yellow">{GAME_INFO.bigmac.title}</span>
          <span className="mt-1 block text-[15px] font-bold text-white/90">
            {reason.bigmac ?? "Tre risposte esatte e il Big Mac è tuo!"}
          </span>
        </span>
        <span className="relative mt-4 flex items-center gap-2">
          {DIFFICULTIES.map((d, i) => (
            <span key={d} className="flex items-center gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-ink">
                {DIFFICULTY_INFO[d].emoji} {DIFFICULTY_INFO[d].label}
              </span>
              {i < 2 && <span aria-hidden className="text-white/60">›</span>}
            </span>
          ))}
          {loading === "bigmac" && <Spinner className="ml-auto size-6" />}
        </span>
      </button>

      {error && <ErrorBanner text={error} />}

      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setConfirm("restaurant")}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/70 px-3 text-xs font-bold text-ink-soft shadow-sm hover:bg-white"
        >
          <ArrowRightLeft className="size-3.5" aria-hidden /> Cambia ristorante
        </button>
        <button
          type="button"
          onClick={() => setConfirm("lock")}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/70 px-3 text-xs font-bold text-ink-soft shadow-sm hover:bg-white"
        >
          <Lock className="size-3.5" aria-hidden /> Disabilita dispositivo
        </button>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "lock" ? "Disabilitare il dispositivo?" : "Cambiare ristorante?"}
        description={
          confirm === "lock"
            ? "Per far giocare di nuovo i clienti servirà la password della postazione."
            : `Ora il dispositivo usa i premi di ${menu.restaurant.name}. Scegli un altro ristorante solo se il dispositivo è stato spostato.`
        }
        confirmLabel={confirm === "lock" ? "Disabilita" : "Cambia ristorante"}
        loading={working}
        onConfirm={confirmAction}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function ErrorBanner({ text }: { text: string | null }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 font-bold text-brand-red-dark">
      <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
      {text}
    </p>
  );
}

function ProgressHeader({ state }: { state: Extract<GameState, { kind: "question" }> }) {
  const info = GAME_INFO[state.mode];
  const level = DIFFICULTY_INFO[state.question.difficulty];
  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-sm font-black">
        <span className="truncate text-brand-red">
          {info.emoji} {info.title}
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${level.badge}`}>
          {level.emoji} {level.label}
        </span>
      </div>
      {state.totalSteps > 1 && (
        <ol className="grid grid-cols-3 gap-2" aria-label={`Domanda ${state.step} di ${state.totalSteps}`}>
          {DIFFICULTIES.map((d, i) => {
            const n = i + 1;
            const done = n < state.step;
            const current = n === state.step;
            return (
              <li
                key={d}
                className={`flex h-9 items-center justify-center gap-1 rounded-xl text-xs font-black transition ${
                  done
                    ? "bg-emerald-500 text-white"
                    : current
                      ? "bg-brand-yellow text-ink ring-2 ring-brand-yellow-dark"
                      : "bg-neutral-100 text-neutral-400"
                }`}
              >
                {done ? "✓" : n}. {DIFFICULTY_INFO[d].label}
              </li>
            );
          })}
        </ol>
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
    <div className="flex flex-col gap-4">
      <section aria-labelledby="question-text" className={`${CARD} animate-fade-up px-5 py-5`}>
        <ProgressHeader state={state} />
        <h2 id="question-text" className="text-center text-[24px] font-black leading-snug text-ink [overflow-wrap:anywhere] sm:text-[26px]">
          {question.questionText}
        </h2>
      </section>

      <div role="radiogroup" aria-labelledby="question-text" className="flex flex-col gap-2.5">
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
              style={{ animationDelay: `${0.07 * (i + 1)}s` }}
              className={`flex min-h-16 w-full animate-fade-up items-center gap-4 rounded-2xl border-2 px-3.5 py-3 text-left transition-[transform,background-color,border-color,box-shadow] duration-150 active:scale-[0.98] disabled:cursor-not-allowed ${
                isSelected
                  ? "border-brand-red bg-brand-yellow-light shadow-[0_5px_0_0_var(--color-brand-red)]"
                  : "border-white bg-white/95 shadow-[0_4px_14px_-8px_rgba(48,37,34,0.4)] hover:border-brand-yellow"
              } ${submitting && !isSelected ? "opacity-50" : ""}`}
            >
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-xl text-xl font-black shadow-sm transition ${LETTER_STYLE[a.letter]} ${
                  isSelected ? "scale-110" : ""
                }`}
                aria-hidden
              >
                {a.letter}
              </span>
              <span className="min-w-0 flex-1 text-[19px] font-extrabold leading-snug text-ink [overflow-wrap:anywhere]">{a.text}</span>
              {isSelected && <CircleCheck className="size-6 shrink-0 text-brand-red" aria-hidden />}
            </button>
          );
        })}
      </div>

      {error && <ErrorBanner text={error} />}

      <button
        ref={confirmRef}
        type="button"
        onClick={submit}
        disabled={!selected || submitting}
        className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-b from-[#e01436] to-brand-red text-xl font-black text-white shadow-[0_5px_0_0_var(--color-brand-red-darker)] transition active:translate-y-1 active:shadow-none disabled:from-neutral-300 disabled:to-neutral-300 disabled:text-neutral-500 disabled:shadow-[0_5px_0_0_#bdbdbd]"
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
    <section className={`${CARD} animate-pop-in px-6 py-9 text-center`}>
      <div className="mx-auto mb-4 grid size-20 place-items-center rounded-full bg-emerald-100">
        <CircleCheck className="size-11 text-emerald-600" aria-hidden />
      </div>
      <h2 className="text-[28px] font-black leading-tight text-ink">Risposta esatta!</h2>
      <div className="mx-auto mt-4 flex max-w-xs justify-center gap-2" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-3 flex-1 rounded-full ${i < answered ? "bg-emerald-500" : "bg-neutral-200"}`}
          />
        ))}
      </div>
      <p className="mt-3 text-lg font-bold text-ink-soft">
        {answered} su {total} · {total - answered === 1 ? "manca solo l'ultima!" : "avanti così!"}
      </p>
      <button
        type="button"
        onClick={onNext}
        autoFocus
        className="mx-auto mt-6 flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-brand-yellow text-xl font-black text-ink shadow-[0_5px_0_0_var(--color-brand-yellow-dark)] transition active:translate-y-1 active:shadow-none"
      >
        Prossima domanda 🎲
      </button>
    </section>
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
      <section className={`${CARD} animate-fade-up px-5 py-5 text-center`}>
        {justCorrect && (
          <p className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 font-black text-emerald-800">
            <CircleCheck className="size-5" aria-hidden /> Risposta esatta!
          </p>
        )}
        <h2 className="text-[26px] font-black leading-tight text-ink">Il villaggio della solidarietà</h2>
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
              className={`group flex animate-fade-up flex-col items-center rounded-3xl border-2 bg-white/95 p-3 text-center transition duration-150 hover:-translate-y-1 active:scale-[0.97] disabled:cursor-default ${
                isPicked
                  ? "border-brand-red shadow-[0_6px_0_0_var(--color-brand-red)]"
                  : "border-white shadow-[0_10px_22px_-12px_rgba(124,10,28,0.45)] hover:border-brand-yellow"
              } ${picked && !isPicked ? "opacity-40" : ""} ${isLast ? "col-span-2 mx-auto w-[calc(50%-0.375rem)]" : ""}`}
            >
              <span className={`relative block w-full max-w-[150px] ${isPicked ? "animate-heartbeat" : ""}`}>
                <HouseArt house={h} className="block h-auto w-full rounded-2xl" />
                {isPicked && (
                  <span className="absolute inset-0 grid place-items-center">
                    <Spinner className="size-8 text-brand-red" />
                  </span>
                )}
              </span>
              <span className="mt-2 block text-[15px] font-black leading-tight text-ink">
                Casa Ronald
                <br />
                <span className="text-brand-red">{info.city}</span>
              </span>
              <span className="mt-0.5 block text-xs font-bold text-ink-soft">{info.tagline}</span>
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs font-semibold text-ink-soft opacity-80">Illustrazioni ispirate alle città italiane</p>

      {error && <ErrorBanner text={error} />}
    </div>
  );
}

export function MessageCard({ icon, title, text, children }: { icon: ReactNode; title: string; text?: string; children?: ReactNode }) {
  return (
    <section className={`${CARD} animate-fade-up px-6 py-10 text-center`}>
      <div className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-brand-yellow-light">{icon}</div>
      <h2 className="text-2xl font-black leading-snug text-ink">{title}</h2>
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
