"use client";

import { CircleAlert, CircleCheck, PackageCheck, Search, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PrizeImage } from "@/components/quiz/PrizeImage";
import { Spinner } from "@/components/ui/Spinner";
import { apiFetch } from "@/lib/client/api";
import { formatItalianDateTime } from "@/lib/date";
import type { PrizeLookup } from "@/types/quiz";

const NOT_FOUND = "Codice non valido. Verifica il codice inserito.";

export function RedeemPrize() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<PrizeLookup | null>(null);
  const [justRedeemed, setJustRedeemed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const busy = useRef(false);

  useEffect(() => inputRef.current?.focus(), []);

  function reset() {
    setCode("");
    setResult(null);
    setJustRedeemed(false);
    setError(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    if (!code.trim()) {
      setError("Inserisci il codice del premio.");
      return;
    }
    busy.current = true;
    setChecking(true);
    setError(null);
    setResult(null);
    setJustRedeemed(false);
    const res = await apiFetch<{ result: PrizeLookup }>("/api/cassa/prizes/lookup", { method: "POST", body: { code } });
    setChecking(false);
    busy.current = false;
    if (res.ok && res.data) {
      setResult(res.data.result);
      if (res.data.result.status !== "not_found") setCode(res.data.result.code);
    } else {
      if (res.status === 401) router.replace("/cassa");
      setError(res.error);
    }
  }

  async function confirm() {
    if (!result || result.status !== "pending" || busy.current) return;
    busy.current = true;
    setConfirming(true);
    // Il server riverifica lo stato e riscatta in modo atomico.
    const res = await apiFetch<{ result: PrizeLookup }>("/api/cassa/prizes/redeem", {
      method: "POST",
      body: { code: result.code },
    });
    setConfirming(false);
    busy.current = false;
    if (res.ok && res.data) {
      setResult(res.data.result);
      setJustRedeemed(res.data.result.status === "redeemed");
    } else {
      if (res.status === 401) router.replace("/cassa");
      setError(res.error);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <form onSubmit={verify} noValidate className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <label htmlFor="prize-code" className="block text-center text-sm font-black uppercase tracking-[0.15em] text-ink-soft">
          Inserisci il codice del premio
        </label>
        <input
          ref={inputRef}
          id="prize-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
            setResult(null);
          }}
          placeholder="QUIZ-XXXXXX"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          maxLength={20}
          className="mt-3 h-20 w-full rounded-2xl border-[3px] border-neutral-200 bg-white text-center font-mono text-[30px] font-black tracking-wider text-ink outline-none placeholder:text-neutral-300 focus:border-brand-yellow-dark focus:ring-4 focus:ring-brand-yellow/30"
        />
        <button
          type="submit"
          disabled={checking}
          className="mt-4 flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-xl font-black text-white transition active:translate-y-0.5 disabled:opacity-70"
        >
          {checking ? <Spinner className="size-6" /> : <Search className="size-6" aria-hidden />}
          Verifica codice
        </button>
      </form>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 font-bold text-brand-red-dark">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden /> {error}
        </p>
      )}

      {result?.status === "not_found" && (
        <div role="alert" className="flex items-center gap-3 rounded-3xl border-4 border-brand-red bg-white p-5 text-xl font-black text-brand-red-dark">
          <CircleAlert className="size-8 shrink-0" aria-hidden /> {NOT_FOUND}
        </div>
      )}

      {result && result.status !== "not_found" && (
        <div
          role="status"
          className={`rounded-3xl border-4 bg-white p-5 shadow-sm sm:p-6 ${
            justRedeemed ? "border-emerald-500" : result.status === "pending" ? "border-brand-yellow" : "border-brand-red"
          }`}
        >
          {justRedeemed && (
            <p className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-xl font-black text-emerald-800">
              <CircleCheck className="size-7 shrink-0" aria-hidden /> Premio riscattato correttamente!
            </p>
          )}
          {!justRedeemed && result.status !== "pending" && (
            <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-brand-red-dark">
              <p className="flex items-center gap-2 text-lg font-black">
                <TriangleAlert className="size-7 shrink-0" aria-hidden /> ATTENZIONE: questo premio è già stato riscattato.
              </p>
              {result.redeemedAt && (
                <p className="mt-1 pl-9 font-bold">Riscattato il {formatItalianDateTime(result.redeemedAt)}</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-4">
            <PrizeImage type={result.prizeType} label={result.label} imageUrl={result.imageUrl} className="size-24 shrink-0" />
            <dl className="min-w-0 space-y-1">
              <div>
                <dt className="text-xs font-black uppercase tracking-wider text-neutral-500">Premio</dt>
                <dd className="text-2xl font-black">{result.label}</dd>
              </div>
              <div>
                <dt className="text-xs font-black uppercase tracking-wider text-neutral-500">Codice</dt>
                <dd className="font-mono text-lg font-black">{result.code}</dd>
              </div>
              <div>
                <dt className="text-xs font-black uppercase tracking-wider text-neutral-500">Stato</dt>
                <dd className={`font-black ${result.status === "pending" ? "text-amber-700" : "text-emerald-700"}`}>
                  {result.status === "pending" ? "Premio da ritirare" : "Riscattato"}
                </dd>
              </div>
            </dl>
          </div>

          {result.status === "pending" ? (
            <button
              type="button"
              onClick={confirm}
              disabled={confirming}
              className="mt-5 flex h-20 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 text-2xl font-black text-white shadow-[0_5px_0_0_#047857] transition active:translate-y-1 active:shadow-none disabled:opacity-70"
            >
              {confirming ? <Spinner className="size-7" /> : <PackageCheck className="size-7" aria-hidden />}
              Conferma consegna
            </button>
          ) : (
            <button
              type="button"
              onClick={reset}
              className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-neutral-100 text-lg font-black text-ink"
            >
              Nuovo codice
            </button>
          )}
        </div>
      )}
    </div>
  );
}
