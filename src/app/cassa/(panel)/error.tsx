"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";

export default function CassaError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-3xl bg-white p-6 text-center shadow-sm">
      <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-red-50 text-brand-red">
        <TriangleAlert className="size-7" aria-hidden />
      </div>
      <h2 className="text-xl font-black">Impossibile caricare i dati</h2>
      <p className="mt-2 text-[15px] text-ink-soft">
        Il database non risponde oppure la configurazione non è completa. Verifica la connessione e le variabili
        d&apos;ambiente di Supabase, poi riprova.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mx-auto mt-6 flex h-12 items-center gap-2 rounded-2xl bg-brand-red px-6 font-black text-white"
      >
        <RefreshCw className="size-5" aria-hidden /> Riprova
      </button>
    </div>
  );
}
