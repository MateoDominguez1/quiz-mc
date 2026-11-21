"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/admin/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { apiFetch } from "@/lib/client/api";
import { RESET_CONFIRM_WORD } from "@/lib/validation";

/**
 * "Zona pericolosa" della dashboard: doppia conferma (apertura della finestra
 * + parola AZZERA da digitare). L'operazione avviene sul server.
 */
export function ResetStats() {
  const router = useRouter();
  const toast = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
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
  }

  const confirmed = word.trim().toUpperCase() === RESET_CONFIRM_WORD;

  async function reset() {
    if (!confirmed || loading) return;
    setLoading(true);
    const res = await apiFetch<{ result: { gamesDeleted: number } }>("/api/admin/stats/reset", {
      method: "POST",
      body: { confirm: RESET_CONFIRM_WORD },
    });
    setLoading(false);
    if (res.ok && res.data) {
      toast.show("success", `Statistiche azzerate: ${res.data.result.gamesDeleted} partite eliminate.`);
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
        Azzera partite e vincite. Domande, premi, foto e scorte non vengono toccati (le scorte si modificano in Premi e
        scorte). L&apos;operazione non può essere annullata.
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
            Tutte le partite e le statistiche verranno eliminate. Le domande continuano a ruotare senza ripetersi.
          </p>

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
