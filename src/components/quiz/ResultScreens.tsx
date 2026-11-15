"use client";

import { BadgeCheck, CircleX, Heart, Ticket } from "lucide-react";
import { useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Confetti } from "@/components/quiz/Confetti";
import { PrizeImage } from "@/components/quiz/PrizeImage";
import { formatItalianDateTime } from "@/lib/date";
import { PRIZE_INFO, type WonPrize } from "@/types/quiz";

export function WinScreen({ prize }: { prize: WonPrize }) {
  const [celebrating, setCelebrating] = useState(prize.status === "pending");
  const redeemed = prize.status === "redeemed";

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-gradient-to-b from-brand-red via-brand-red to-brand-red-dark text-white">
      {celebrating && <Confetti />}

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center px-5 pb-[calc(var(--safe-bottom)+24px)] pt-[calc(var(--safe-top)+16px)] text-center">
        <BrandLogo size="sm" />

        <h1
          className="mt-5 bg-[linear-gradient(110deg,#ffc72c_35%,#fff6d6_50%,#ffc72c_65%)] bg-[length:200%_auto] bg-clip-text text-[42px] font-black leading-none tracking-tight text-transparent animate-shine"
        >
          COMPLIMENTI!
        </h1>
        <p className="mt-2 animate-fade-up text-xl font-extrabold leading-snug" style={{ animationDelay: "0.1s" }}>
          {PRIZE_INFO[prize.type].winMessage}
        </p>

        <div className="mt-5 animate-pop-in" style={{ animationDelay: "0.15s" }}>
          <PrizeImage type={prize.type} label={prize.label} imageUrl={prize.imageUrl} className="size-44 sm:size-52" />
        </div>

        <section
          aria-labelledby="prize-code-title"
          className="mt-6 w-full animate-fade-up rounded-3xl bg-white p-5 text-ink shadow-xl"
          style={{ animationDelay: "0.3s" }}
        >
          <p id="prize-code-title" className="flex items-center justify-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-brand-red">
            <Ticket className="size-4" aria-hidden /> Il tuo codice premio
          </p>
          <p
            className={`mt-2 select-all font-mono text-[34px] font-black tracking-wider ${redeemed ? "text-neutral-400 line-through" : "text-ink"}`}
            aria-label={`Codice premio ${prize.code.split("").join(" ")}`}
          >
            {prize.code}
          </p>
          {redeemed ? (
            <p className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 font-bold text-emerald-800">
              <BadgeCheck className="size-5 shrink-0" aria-hidden />
              Premio già ritirato{prize.redeemedAt ? ` il ${formatItalianDateTime(prize.redeemedAt)}` : ""}
            </p>
          ) : (
            <p className="mt-2 text-lg font-bold leading-snug">Mostra questo codice alla cassa per ritirare il tuo premio.</p>
          )}
        </section>

        {celebrating && (
          <button
            type="button"
            onClick={() => setCelebrating(false)}
            className="mt-auto h-16 w-full animate-fade-up rounded-2xl bg-brand-yellow text-xl font-black text-ink shadow-[0_5px_0_0_var(--color-brand-yellow-dark)] transition active:translate-y-1 active:shadow-none"
            style={{ animationDelay: "0.45s" }}
          >
            Fantastico!
          </button>
        )}
      </div>
    </main>
  );
}

export function LoseScreen() {
  return (
    <main className="flex min-h-dvh flex-col bg-cream">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-5 pb-[calc(var(--safe-bottom)+32px)] pt-[calc(var(--safe-top)+20px)] text-center">
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
          <div className="mt-6 w-full animate-fade-up rounded-3xl bg-neutral-50 px-5 py-5" style={{ animationDelay: "0.2s" }}>
            <p className="flex items-center justify-center gap-2 text-xl font-black text-ink">
              <Heart className="size-6 shrink-0 animate-heartbeat fill-brand-red text-brand-red" aria-hidden />
              Grazie per aver partecipato!
            </p>
            <p className="mt-2 text-lg font-bold text-ink-soft">Ti aspettiamo per una nuova partita.</p>
          </div>
        </div>
        <p className="text-sm font-bold text-neutral-500">Il Quiz</p>
      </div>
    </main>
  );
}
