"use client";

import { CircleCheck, CircleX, Clock, CreditCard, Plus, RefreshCw, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/admin/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { apiFetch } from "@/lib/client/api";

interface Entry {
  id: string;
  url: string;
  svg: string;
  expiresAt: string;
}

type EntryStatus = "pending" | "used" | "cancelled" | "expired";

/**
 * Controllo automatico dello stato del QR: ogni 5 secondi e solo per i primi
 * 3 minuti (e solo con la pagina visibile), per contenere il consumo del
 * server. Dopo, l'operatore può verificare a mano con "Controlla stato".
 */
const POLL_INTERVAL_MS = 5000;
const POLL_WINDOW_MS = 3 * 60 * 1000;

function minutesLeft(expiresAt: string, now: number) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 60000));
}

export function NewEntry() {
  const toast = useToast();
  const router = useRouter();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [status, setStatus] = useState<EntryStatus>("pending");
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [createdAt, setCreatedAt] = useState(0);
  const [checking, setChecking] = useState(false);
  const inFlight = useRef(false);
  const autoCheck = entry !== null && status === "pending" && now - createdAt < POLL_WINDOW_MS;

  const checkStatus = useCallback(async (id: string) => {
    const res = await apiFetch<{ status: EntryStatus }>(`/api/cassa/entries/${id}`);
    if (res.ok && res.data && res.data.status !== "pending") setStatus(res.data.status);
    return res.ok;
  }, []);

  const create = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setCreating(true);
    const res = await apiFetch<Entry>("/api/cassa/entries", { method: "POST", body: {} });
    setCreating(false);
    inFlight.current = false;
    if (res.ok && res.data) {
      setEntry(res.data);
      setStatus("pending");
      const t = Date.now();
      setNow(t);
      setCreatedAt(t);
    } else {
      if (res.status === 401) router.replace("/cassa");
      toast.show("error", res.error ?? "Impossibile generare il QR code.");
    }
  }, [toast, router]);

  // Orologio per il conto alla rovescia (nessuna chiamata al server).
  useEffect(() => {
    if (!entry || status !== "pending") return;
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [entry, status]);

  // Controllo automatico limitato (vedi POLL_*).
  useEffect(() => {
    if (!entry || !autoCheck) return;
    const id = entry.id;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void checkStatus(id);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [entry, autoCheck, checkStatus]);

  async function manualCheck() {
    if (!entry || checking) return;
    setChecking(true);
    const ok = await checkStatus(entry.id);
    setChecking(false);
    setNow(Date.now());
    if (!ok) toast.show("error", "Impossibile verificare lo stato. Riprova.");
  }

  async function cancel() {
    if (!entry || cancelling) return;
    setCancelling(true);
    const res = await apiFetch<{ cancelled: boolean }>(`/api/cassa/entries/${entry.id}`, { method: "DELETE" });
    setCancelling(false);
    if (res.ok && res.data?.cancelled) {
      setStatus("cancelled");
      toast.show("success", "QR code annullato.");
    } else if (res.ok) {
      toast.show("error", "Il QR code è già stato utilizzato o è scaduto.");
    } else {
      toast.show("error", res.error ?? "Operazione non riuscita.");
    }
  }

  if (!entry) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-brand-yellow-light">
          <CreditCard className="size-8 text-brand-red" aria-hidden />
        </div>
        <p className="text-lg font-bold text-ink-soft">Quando il cliente ha pagato, premi il pulsante per generare il suo QR code personale.</p>
        <button
          type="button"
          onClick={create}
          disabled={creating}
          className="mt-6 flex h-20 w-full items-center justify-center gap-3 rounded-2xl bg-brand-red text-2xl font-black text-white shadow-[0_5px_0_0_var(--color-brand-red-darker)] transition active:translate-y-1 active:shadow-none disabled:opacity-70"
        >
          {creating ? <Spinner className="size-7" /> : <CircleCheck className="size-7" aria-hidden />}
          Pagamento ricevuto
        </button>
      </div>
    );
  }

  const left = minutesLeft(entry.expiresAt, now);
  const expired = status === "expired" || (status === "pending" && left === 0);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="rounded-3xl bg-white p-5 text-center shadow-sm sm:p-6">
        {status === "pending" && !expired && (
          <>
            <p className="text-xl font-black">Fai scansionare questo QR code al cliente</p>
            <div
              className="mx-auto mt-4 aspect-square w-full max-w-[340px] rounded-2xl border-4 border-brand-yellow bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
              role="img"
              aria-label="QR code per partecipare al quiz"
              // SVG generato dal server con la libreria qrcode (nessun input utente).
              dangerouslySetInnerHTML={{ __html: entry.svg }}
            />
            {autoCheck ? (
              <p className="mt-4 flex items-center justify-center gap-2 font-bold text-ink-soft">
                <Spinner className="size-4" /> In attesa della scansione…
              </p>
            ) : (
              <button
                type="button"
                onClick={manualCheck}
                disabled={checking}
                className="mx-auto mt-4 flex h-12 items-center gap-2 rounded-2xl bg-neutral-100 px-5 font-black text-ink hover:bg-neutral-200 disabled:opacity-60"
              >
                {checking ? <Spinner /> : <RefreshCw className="size-5" aria-hidden />}
                Controlla stato
              </button>
            )}
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-neutral-500">
              <Clock className="size-4" aria-hidden /> Valido una sola volta · scade tra {left} {left === 1 ? "minuto" : "minuti"}
            </p>
          </>
        )}
        {status === "used" && (
          <div className="py-6">
            <CircleCheck className="mx-auto size-20 text-emerald-600" aria-hidden />
            <p className="mt-3 text-2xl font-black">QR code utilizzato</p>
            <p className="mt-1 font-semibold text-ink-soft">Il cliente sta giocando. Il codice non è più valido.</p>
          </div>
        )}
        {(status === "cancelled" || expired) && (
          <div className="py-6">
            <CircleX className="mx-auto size-20 text-brand-red" aria-hidden />
            <p className="mt-3 text-2xl font-black">{status === "cancelled" ? "QR code annullato" : "QR code scaduto"}</p>
            <p className="mt-1 font-semibold text-ink-soft">Non può più essere utilizzato.</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={create}
          disabled={creating}
          className="flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-red text-lg font-black text-white shadow-[0_4px_0_0_var(--color-brand-red-darker)] active:translate-y-0.5 active:shadow-none disabled:opacity-70"
        >
          {creating ? <Spinner /> : <Plus className="size-6" aria-hidden />}
          Nuova partecipazione
        </button>
        {status === "pending" && !expired && (
          <button
            type="button"
            onClick={cancel}
            disabled={cancelling}
            className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-lg font-black text-ink shadow-sm disabled:opacity-70"
          >
            {cancelling ? <Spinner /> : <RotateCcw className="size-5" aria-hidden />}
            Annulla QR
          </button>
        )}
      </div>
    </div>
  );
}
