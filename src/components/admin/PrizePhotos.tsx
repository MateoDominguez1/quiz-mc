"use client";

import { ImageUp, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useToast } from "@/components/admin/Toast";
import { PrizeImage } from "@/components/quiz/PrizeImage";
import { Spinner } from "@/components/ui/Spinner";
import { apiFetch } from "@/lib/client/api";
import { winMessageFor, type PrizeSetting } from "@/types/quiz";

const MAX_SIDE = 900;

/**
 * Ottimizza la foto nel browser prima del caricamento: lato massimo 900 px,
 * WebP (o JPEG se il browser non supporta WebP). Pesa tipicamente < 150 KB.
 */
async function optimizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.82));
  const webp = await toBlob("image/webp");
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob("image/jpeg");
  if (!jpeg) throw new Error("encode");
  return jpeg;
}

function PrizeCard({ prize }: { prize: PrizeSetting }) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState(prize.imageUrl);
  const [label, setLabel] = useState(prize.label);
  const [savedLabel, setSavedLabel] = useState(prize.label);
  const [message, setMessage] = useState(prize.winMessage ?? "");
  const [savedMessage, setSavedMessage] = useState(prize.winMessage ?? "");
  const hasStock = prize.pool === "casette";
  const [stock, setStock] = useState(String(prize.stock ?? 0));
  const [savedStock, setSavedStock] = useState(String(prize.stock ?? 0));
  const [saving, setSaving] = useState(false);
  const dirty =
    label.trim() !== savedLabel || message.trim() !== savedMessage || (hasStock && stock !== savedStock);

  async function saveTexts(e: FormEvent) {
    e.preventDefault();
    if (saving || !dirty) return;
    if (!label.trim()) {
      toast.show("error", "Inserisci il nome del premio.");
      return;
    }
    const stockValue = hasStock ? Number(stock) : null;
    if (hasStock && (!/^\d{1,5}$/.test(stock) || !Number.isInteger(stockValue))) {
      toast.show("error", "Pezzi disponibili: inserisci un numero intero da 0 a 99999.");
      return;
    }
    setSaving(true);
    const res = await apiFetch(`/api/admin/prizes/${prize.key}`, {
      method: "PATCH",
      body: { label: label.trim(), winMessage: message.trim() || null, stock: stockValue },
    });
    setSaving(false);
    if (res.ok) {
      setLabel(label.trim());
      setSavedLabel(label.trim());
      setMessage(message.trim());
      setSavedMessage(message.trim());
      setStock(String(stockValue ?? 0));
      setSavedStock(String(stockValue ?? 0));
      toast.show("success", `Premio "${label.trim()}" aggiornato.`);
      router.refresh();
    } else {
      if (res.status === 401) router.replace("/admin");
      toast.show("error", res.error ?? "Salvataggio non riuscito.");
    }
  }

  async function onFile(file: File | undefined) {
    if (!file || uploading) return;
    if (!file.type.startsWith("image/")) {
      toast.show("error", "Seleziona un'immagine (JPG, PNG o WebP).");
      return;
    }
    setUploading(true);
    try {
      const blob = await optimizeImage(file);
      const form = new FormData();
      form.append("file", blob, `${prize.key}.${blob.type === "image/webp" ? "webp" : "jpg"}`);
      const res = await fetch(`/api/admin/prizes/${prize.key}/image`, { method: "POST", body: form, credentials: "same-origin" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; imageUrl?: string; error?: string } | null;
      if (res.ok && data?.ok) {
        setImageUrl(data.imageUrl ?? null);
        toast.show("success", `Foto del premio "${savedLabel}" aggiornata.`);
        router.refresh();
      } else {
        if (res.status === 401) router.replace("/admin");
        toast.show("error", data?.error ?? "Caricamento non riuscito.");
      }
    } catch {
      toast.show("error", "Impossibile leggere l'immagine. Prova con un'altra foto.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <li className="flex flex-col items-center rounded-3xl bg-white p-5 text-center shadow-sm">
      <PrizeImage prizeKey={prize.key} label={savedLabel} imageUrl={imageUrl} className="size-44" />
      <p className="mt-4 text-xl font-black">{savedLabel}</p>
      {hasStock ? (
        <p className={`text-sm font-bold ${savedStock === "0" ? "text-brand-red" : "text-ink-soft"}`}>
          {savedStock === "0" ? "Esaurito: non viene più estratto" : `${savedStock} pezzi disponibili`}
        </p>
      ) : (
        <p className="text-sm font-bold text-ink-soft">🍔 Premio della sfida Big Mac</p>
      )}
      <p className="mt-1 text-xs font-semibold text-neutral-500">{imageUrl ? "Foto caricata" : "Nessuna foto: viene mostrata un'icona"}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        id={`file-${prize.key}`}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <label
        htmlFor={`file-${prize.key}`}
        className={`mt-4 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-brand-red font-black text-white ${uploading ? "pointer-events-none opacity-70" : ""}`}
      >
        {uploading ? <Spinner /> : <ImageUp className="size-5" aria-hidden />}
        {uploading ? "Caricamento…" : imageUrl ? "Sostituisci foto" : "Carica foto"}
      </label>

      <form onSubmit={saveTexts} noValidate className="mt-5 w-full space-y-3 border-t border-neutral-100 pt-4 text-left">
        {hasStock && (
          <div className="space-y-1.5">
            <label htmlFor={`stock-${prize.key}`} className="block text-sm font-extrabold">
              Pezzi disponibili
            </label>
            <input
              id={`stock-${prize.key}`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={stock}
              maxLength={5}
              onChange={(e) => setStock(e.target.value.replace(/\D/g, "").slice(0, 5))}
              className="h-12 w-full rounded-2xl border-2 border-neutral-200 bg-white px-4 text-lg font-black tabular-nums outline-none focus:border-brand-yellow-dark focus:ring-4 focus:ring-brand-yellow/30"
            />
            <p className="text-xs font-semibold text-neutral-500">
              Scende da solo a ogni vincita. Più pezzi = più probabilità di essere estratto.
            </p>
          </div>
        )}
        <div className="space-y-1.5">
          <label htmlFor={`label-${prize.key}`} className="block text-sm font-extrabold">
            Nome del premio
          </label>
          <input
            id={`label-${prize.key}`}
            value={label}
            maxLength={40}
            onChange={(e) => setLabel(e.target.value)}
            className="h-12 w-full rounded-2xl border-2 border-neutral-200 bg-white px-4 font-bold outline-none focus:border-brand-yellow-dark focus:ring-4 focus:ring-brand-yellow/30"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`msg-${prize.key}`} className="block text-sm font-extrabold">
            Messaggio per il vincitore <span className="font-semibold text-neutral-500">(facoltativo)</span>
          </label>
          <textarea
            id={`msg-${prize.key}`}
            value={message}
            maxLength={120}
            rows={2}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={winMessageFor(prize.key, label || savedLabel, null)}
            className="w-full resize-none rounded-2xl border-2 border-neutral-200 bg-white px-4 py-2.5 font-semibold outline-none focus:border-brand-yellow-dark focus:ring-4 focus:ring-brand-yellow/30"
          />
          <p className="text-xs font-semibold text-neutral-500">Se lo lasci vuoto viene mostrato il testo suggerito.</p>
        </div>
        <button
          type="submit"
          disabled={!dirty || saving}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink font-black text-white disabled:bg-neutral-200 disabled:text-neutral-500"
        >
          {saving ? <Spinner /> : <Save className="size-5" aria-hidden />}
          {saving ? "Salvataggio…" : dirty ? "Salva modifiche" : "Salvato"}
        </button>
      </form>
    </li>
  );
}

export function PrizePhotos({ prizes }: { prizes: PrizeSetting[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {prizes.map((p) => (
        <PrizeCard key={p.key} prize={p} />
      ))}
    </ul>
  );
}
