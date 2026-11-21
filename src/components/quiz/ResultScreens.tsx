"use client";

import { CircleX, Gift, Heart, RotateCcw } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Confetti } from "@/components/quiz/Confetti";
import { HouseArt } from "@/components/quiz/HouseArt";
import { PrizeImage } from "@/components/quiz/PrizeImage";
import { Spinner } from "@/components/ui/Spinner";
import { HOUSE_INFO, type GameState } from "@/types/quiz";

function NewCustomerButton({ onClick, busy, tone }: { onClick: () => void; busy: boolean; tone: "yellow" | "red" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex h-16 w-full items-center justify-center gap-3 rounded-2xl text-xl font-black transition active:translate-y-1 active:shadow-none disabled:opacity-70 ${
        tone === "yellow"
          ? "bg-brand-yellow text-ink shadow-[0_5px_0_0_var(--color-brand-yellow-dark)]"
          : "bg-brand-red text-white shadow-[0_5px_0_0_var(--color-brand-red-darker)]"
      }`}
    >
      {busy ? <Spinner className="size-6" /> : <RotateCcw className="size-6" aria-hidden />}
      Nuovo cliente
    </button>
  );
}

export function WinScreen({
  state,
  busy,
  onNewCustomer,
}: {
  state: Extract<GameState, { kind: "won" }>;
  busy: boolean;
  onNewCustomer: () => void;
}) {
  const { prize, house, mode } = state;
  const intro =
    mode === "bigmac"
      ? "Tre risposte esatte su tre!"
      : house
        ? `Hai scelto Casa Ronald ${HOUSE_INFO[house].city}!`
        : "Risposta esatta! 🎉";

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-gradient-to-b from-brand-red via-brand-red to-brand-red-dark text-white">
      {prize && <Confetti />}

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center px-5 pb-[calc(var(--safe-bottom)+24px)] pt-[calc(var(--safe-top)+16px)] text-center">
        <BrandLogo size="sm" />

        <h1 className="mt-5 bg-[linear-gradient(110deg,#ffc72c_35%,#fff6d6_50%,#ffc72c_65%)] bg-[length:200%_auto] bg-clip-text text-[42px] font-black leading-none tracking-tight text-transparent animate-shine">
          COMPLIMENTI!
        </h1>
        <p className="mt-2 animate-fade-up text-xl font-extrabold leading-snug" style={{ animationDelay: "0.1s" }}>
          {intro}
        </p>

        {prize ? (
          <>
            <div className="relative mt-5 animate-pop-in" style={{ animationDelay: "0.15s" }}>
              <PrizeImage prizeKey={prize.key} label={prize.label} imageUrl={prize.imageUrl} className="size-44 sm:size-52" />
              {house && (
                <span className="absolute -bottom-4 -left-6 block w-20 rotate-[-8deg] rounded-2xl bg-white p-1 shadow-lg">
                  <HouseArt house={house} className="block h-auto w-full" />
                </span>
              )}
            </div>
            <p className="mt-7 animate-fade-up text-[28px] font-black leading-tight text-brand-yellow" style={{ animationDelay: "0.25s" }}>
              {prize.winMessage}
            </p>
          </>
        ) : (
          <p className="mt-6 animate-fade-up rounded-3xl bg-white/10 px-5 py-4 text-lg font-bold">
            Purtroppo i premi delle casette sono esauriti. Grazie di cuore per aver giocato!
          </p>
        )}

        <section
          className="mt-6 w-full animate-fade-up rounded-3xl bg-white p-5 text-ink shadow-xl"
          style={{ animationDelay: "0.35s" }}
        >
          <p className="flex items-center justify-center gap-2 text-lg font-black">
            <Gift className="size-5 shrink-0 text-brand-red" aria-hidden />
            {prize ? "Ritira il tuo premio presso il personale." : "Grazie per aver partecipato!"}
          </p>
          <p className="mt-1 text-[15px] font-semibold text-ink-soft">❤️ McHappy Days · grazie per il tuo sostegno.</p>
        </section>

        <div className="mt-auto w-full pt-6">
          <NewCustomerButton onClick={onNewCustomer} busy={busy} tone="yellow" />
        </div>
      </div>
    </main>
  );
}

export function LoseScreen({
  state,
  busy,
  onNewCustomer,
}: {
  state: Extract<GameState, { kind: "lost" }>;
  busy: boolean;
  onNewCustomer: () => void;
}) {
  const multi = state.totalSteps > 1;
  return (
    <main className="flex min-h-dvh flex-col bg-cream">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-5 pb-[calc(var(--safe-bottom)+24px)] pt-[calc(var(--safe-top)+20px)] text-center">
        <BrandLogo size="sm" tone="dark" />
        <div className="flex flex-1 flex-col items-center justify-center py-8">
          <div className="mb-6 grid size-28 animate-pop-in place-items-center rounded-full bg-brand-red/10">
            <CircleX className="size-16 text-brand-red" strokeWidth={2.4} aria-hidden />
          </div>
          {/* Si comunica che la risposta è sbagliata, senza mai indicare quella giusta. */}
          <p className="animate-fade-up text-sm font-black uppercase tracking-[0.2em] text-brand-red">Risposta sbagliata</p>
          <h1 className="mt-2 animate-fade-up text-[36px] font-black leading-tight text-ink" style={{ animationDelay: "0.1s" }}>
            Peccato, non hai vinto!
          </h1>
          {multi && (
            <p className="mt-3 animate-fade-up text-lg font-extrabold text-ink-soft" style={{ animationDelay: "0.15s" }}>
              {state.correctCount}/{state.totalSteps} risposte corrette
            </p>
          )}
          <div className="mt-6 w-full animate-fade-up rounded-3xl bg-neutral-50 px-5 py-5" style={{ animationDelay: "0.2s" }}>
            <p className="flex items-center justify-center gap-2 text-xl font-black text-ink">
              <Heart className="size-6 shrink-0 animate-heartbeat fill-brand-red text-brand-red" aria-hidden />
              Grazie per aver giocato!
            </p>
            <p className="mt-2 text-lg font-bold text-ink-soft">La tua donazione aiuta le Case Ronald.</p>
          </div>
        </div>
        <NewCustomerButton onClick={onNewCustomer} busy={busy} tone="red" />
      </div>
    </main>
  );
}
