"use client";

import { ImageUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useToast } from "@/components/admin/Toast";
import { PrizeImage } from "@/components/quiz/PrizeImage";
import { Spinner } from "@/components/ui/Spinner";
import { PRIZE_INFO, type PrizeSetting, type PrizeType } from "@/types/quiz";

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
      form.append("file", blob, `${prize.type}.${blob.type === "image/webp" ? "webp" : "jpg"}`);
      const res = await fetch(`/api/admin/prizes/${prize.type}/image`, { method: "POST", body: form, credentials: "same-origin" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; imageUrl?: string; error?: string } | null;
      if (res.ok && data?.ok) {
        setImageUrl(data.imageUrl ?? null);
        toast.show("success", `Foto del premio "${prize.label}" aggiornata.`);
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

  const info = PRIZE_INFO[prize.type as PrizeType];
  return (
    <li className="flex flex-col items-center rounded-3xl bg-white p-5 text-center shadow-sm">
      <PrizeImage type={prize.type} label={prize.label} imageUrl={imageUrl} className="size-44" />
      <p className="mt-4 text-xl font-black">{prize.label}</p>
      <p className="text-sm font-bold text-ink-soft">{info.ages}</p>
      <p className="mt-1 text-xs font-semibold text-neutral-500">{imageUrl ? "Foto caricata" : "Nessuna foto: viene mostrata un'icona"}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        id={`file-${prize.type}`}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <label
        htmlFor={`file-${prize.type}`}
        className={`mt-4 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-brand-red font-black text-white ${uploading ? "pointer-events-none opacity-70" : ""}`}
      >
        {uploading ? <Spinner /> : <ImageUp className="size-5" aria-hidden />}
        {uploading ? "Caricamento…" : imageUrl ? "Sostituisci foto" : "Carica foto"}
      </label>
    </li>
  );
}

export function PrizePhotos({ prizes }: { prizes: PrizeSetting[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {prizes.map((p) => (
        <PrizeCard key={p.type} prize={p} />
      ))}
    </ul>
  );
}
