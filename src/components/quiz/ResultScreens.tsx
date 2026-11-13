"use client";

import { BadgeCheck, CircleX, Heart, Trophy } from "lucide-react";
import { useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Confetti } from "@/components/quiz/Confetti";
import { formatItalianDate } from "@/lib/date";

export function WinScreen({ date, alreadyAnswered }: { date: string; alreadyAnswered?: boolean }) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-gradient-to-b from-mc-red via-mc-red to-mc-red-dark text-white">
      {!acknowledged && <Confetti />}

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center px-5 pb-[calc(var(--safe-bottom)+24px)] pt-[calc(var(--safe-top)+20px)] text-center">
        <BrandLogo size="sm" />

        <div className="flex flex-1 flex-col items-center justify-center py-6">
          <div className="relative mb-6 grid size-40 place-items-center">
            <div className="sunburst absolute inset-0" aria-hidden />
            <div className="relative grid size-28 animate-pop-in place-items-center rounded-full bg-mc-yellow shadow-[0_8px_0_0_var(--color-mc-yellow-dark)]">
              <Trophy className="size-14 animate-float text-mc-red" strokeWidth={2.4} aria-hidden />
            </div>
          </div>

          <h1
            className="bg-[linear-gradient(110deg,#ffc72c_35%,#fff6d6_50%,#ffc72c_65%)] bg-[length:200%_auto] bg-clip-text text-[44px] font-black leading-none tracking-tight text-transparent animate-shine sm:text-5xl"
            style={{ animationDelay: "0.1s" }}
          >
            COMPLIMENTI!
          </h1>
          <p className="mt-3 animate-fade-up text-xl font-extrabold" style={{ animationDelay: "0.2s" }}>
            Hai indovinato! 🎉
          </p>
          <p className="mt-1 animate-fade-up text-4xl font-black" style={{ animationDelay: "0.3s" }}>
            Hai vinto!
          </p>

          <div
            className="mt-6 w-full animate-fade-up rounded-3xl bg-white p-5 text-ink shadow-xl"
            style={{ animationDelay: "0.4s" }}
          >
            <p className="text-xl font-black leading-snug">Avvicinati alla cassa per ritirare il tuo premio.</p>
            {acknowledged && (
              <div className="mt-4 animate-fade-up rounded-2xl border-2 border-dashed border-mc-yellow-dark bg-mc-yellow-light px-4 py-3">
                <p className="flex items-center justify-center gap-2 font-black text-emerald-700">
                  <BadgeCheck className="size-5" aria-hidden /> Risposta corretta verificata
                </p>
                <p className="mt-1 text-sm font-bold text-ink-soft first-letter:uppercase">{formatItalianDate(date)}</p>
                <p className="mt-1 text-sm font-semibold text-ink-soft">Mostra questa schermata al personale.</p>
              </div>
            )}
            {alreadyAnswered && !acknowledged && (
              <p className="mt-2 text-sm font-semibold text-ink-soft">Hai già partecipato al quiz di oggi.</p>
            )}
          </div>
        </div>

        {!acknowledged && (
          <button
            type="button"
            onClick={() => setAcknowledged(true)}
            className="h-16 w-full animate-fade-up rounded-2xl bg-mc-yellow text-xl font-black text-ink shadow-[0_5px_0_0_var(--color-mc-yellow-dark)] transition active:translate-y-1 active:shadow-none"
            style={{ animationDelay: "0.5s" }}
          >
            Fantastico!
          </button>
        )}
      </div>
    </main>
  );
}

export function LoseScreen({ alreadyAnswered }: { alreadyAnswered?: boolean }) {
  return (
    <main className="flex min-h-dvh flex-col bg-cream">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-5 pb-[calc(var(--safe-bottom)+32px)] pt-[calc(var(--safe-top)+20px)] text-center">
        <BrandLogo size="sm" />
        <div className="flex flex-1 flex-col items-center justify-center py-8">
          <div className="mb-6 grid size-28 animate-pop-in place-items-center rounded-full bg-mc-red/10">
            <CircleX className="size-16 text-mc-red" strokeWidth={2.4} aria-hidden />
          </div>
          {/* Si comunica che la risposta è sbagliata, senza mai indicare quella giusta. */}
          <p className="animate-fade-up text-sm font-black uppercase tracking-[0.2em] text-mc-red">
            Risposta sbagliata
          </p>
          <h1
            className="mt-2 animate-fade-up text-[36px] font-black leading-tight text-ink"
            style={{ animationDelay: "0.1s" }}
          >
            Peccato, non hai vinto!
          </h1>
          <div
            className="mt-6 w-full animate-fade-up rounded-3xl bg-white px-5 py-5 shadow-sm"
            style={{ animationDelay: "0.2s" }}
          >
            <p className="flex items-center justify-center gap-2 text-xl font-black text-ink">
              <Heart className="size-6 shrink-0 animate-heartbeat fill-mc-red text-mc-red" aria-hidden />
              Grazie per aver partecipato!
            </p>
            <p className="mt-2 text-lg font-bold text-ink-soft">Ti aspettiamo domani per una nuova domanda.</p>
          </div>
          {alreadyAnswered && (
            <p className="mt-6 animate-fade-up rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-soft shadow-sm" style={{ animationDelay: "0.3s" }}>
              Hai già partecipato al quiz di oggi.
            </p>
          )}
        </div>
        <p className="text-sm font-bold text-neutral-500">Il Quiz del Giorno</p>
      </div>
    </main>
  );
}
