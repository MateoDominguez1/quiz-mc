"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/admin/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { apiFetch } from "@/lib/client/api";
import { RESET_CONFIRM_WORD } from "@/lib/validation";

type Mode = "keep_pending" | "all";

const OPTIONS: { value: Mode; title: string; text: string }[] = [
  {
    value: "keep_pending",
    title: "Conserva i premi da ritirare",
    text: "I clienti che non hanno ancora ritirato il premio potranno usare il loro codice. Consigliato.",
  },
  {
    value: "all",
    title: "Azzera tutto",
    text: "Anche i codici premio non ancora ritirati e i QR non usati smetteranno di funzionare.",
  },
];

/**
 * "Zona pericolosa" della dashboard: doppia conferma (apertura della finestra
 * + parola AZZERA da digitare). L'operazione avviene sul server.
 */
export function ResetStats({ pendingPrizes }: { pendingPrizes: number }) {
  const router = useRouter();
  const toast = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("keep_pending");
  const [word, setWord] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  function close() {
    if (loading) return;
    setOpen(false);
    setWord("");
    setMode("keep_pending");
  }

  const confirmed = word.trim().toUpperCase() === RESET_CONFIRM_WORD;

  async function reset() {
    if (!confirmed || loading) return;
    setLoading(true);
    const res = await apiFetch<{ result: { participantsDeleted: number; pendingKept: number } }>("/api/admin/stats/reset", {
      method: "POST",
      body: { mode, confirm: RESET_CONFIRM_WORD },
    });
    setLoading(false);
    if (res.ok && res.data) {
      const { participantsDeleted, pendingKept } = res.data.result;
      toast.show(
        "success",
        `Statistiche azzerate: ${participantsDeleted} partecipazioni eliminate` +
          (pendingKept > 0 ? `, ${pendingKept} premi da ritirare conservati.` : "."),
      );
      setOpen(false);
      setWord("");
      router.refresh();
    } else {
      if (res.status === 401) router.replace("/admin");
      toast.show("error", res.error ?? "Azzeramento non riuscito.");
    }
  }

  return (
    <section className="rounded-3xl border-2 border-red-200 bg-white p-5 sm:p-6" aria-labelledby="danger-title">
      <h2 id="danger-title" className="flex items-center gap-2 text-lg font-black text-brand-red-dark">
        <TriangleAlert className="size-5" aria-hidden /> Zona pericolosa
      </h2>
      <p className="mt-1 text-[15px] text-ink-soft">
        Azzera partecipanti, vincitori, premi ed età. Domande e foto dei premi non vengono toccate. L&apos;operazione non può
        essere annullata.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 flex h-12 items-center gap-2 rounded-2xl border-2 border-brand-red px-5 font-black text-brand-red hover:bg-red-50"
      >
        <RotateCcw className="size-5" aria-hidden /> Azzera statistiche
      </button>

      <dialog
        ref={dialogRef}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl p-0 shadow-2xl backdrop:bg-black/50"
        aria-labelledby="reset-title"
      >
        <div className="max-h-[85dvh] overflow-y-auto p-6">
          <div className="mb-4 grid size-12 place-items-center rounded-full bg-red-50 text-brand-red">
            <TriangleAlert className="size-6" aria-hidden />
          </div>
          <h2 id="reset-title" className="text-xl font-black text-ink">
            Azzerare le statistiche?
          </h2>
          <p className="mt-1 text-[15px] text-ink-soft">
            Ci sono <strong>{pendingPrizes}</strong> {pendingPrizes === 1 ? "premio" : "premi"} ancora da ritirare.
          </p>

          <fieldset className="mt-4 space-y-2">
            <legend className="sr-only">Cosa azzerare</legend>
            {OPTIONS.map((o) => (
              <label
                key={o.value}
                className={`flex cursor-pointer gap-3 rounded-2xl border-2 p-3 ${
                  mode === o.value ? "border-brand-red bg-red-50/60" : "border-neutral-200"
                }`}
              >
                <input
                  type="radio"
                  name="reset-mode"
                  value={o.value}
                  checked={mode === o.value}
                  onChange={() => setMode(o.value)}
                  className="mt-1 size-5 accent-[#da291c]"
                />
                <span>
                  <span className="block font-black">{o.title}</span>
                  <span className="block text-sm text-ink-soft">{o.text}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <label htmlFor="reset-word" className="mt-4 block text-sm font-extrabold">
            Per confermare scrivi <span className="font-mono text-brand-red">{RESET_CONFIRM_WORD}</span>
          </label>
          <input
            id="reset-word"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="mt-2 h-12 w-full rounded-2xl border-2 border-neutral-200 px-4 font-mono font-black uppercase outline-none focus:border-brand-red focus:ring-4 focus:ring-brand-red/15"
          />

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={close}
              disabled={loading}
              className="h-12 rounded-2xl bg-neutral-100 px-5 font-black text-ink hover:bg-neutral-200"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={!confirmed || loading}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand-red px-5 font-black text-white disabled:opacity-40"
            >
              {loading && <Spinner />}
              Azzera definitivamente
            </button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
