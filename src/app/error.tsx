"use client";

import { RefreshCw } from "lucide-react";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cream px-6 text-center">
      <h1 className="text-3xl font-black">Ops! Qualcosa non ha funzionato</h1>
      <p className="text-lg font-bold text-ink-soft">Controlla la connessione e riprova.</p>
      <button
        type="button"
        onClick={reset}
        className="flex h-14 items-center gap-2 rounded-2xl bg-mc-red px-8 text-lg font-black text-white"
      >
        <RefreshCw className="size-5" aria-hidden /> Riprova
      </button>
    </main>
  );
}
