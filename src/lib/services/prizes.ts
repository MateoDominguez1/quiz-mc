import "server-only";
import { randomBytes } from "node:crypto";
import { callRpc } from "@/lib/supabase/server";
import { prizeImageUrl, removePrizeImage, uploadPrizeImage } from "@/lib/supabase/storage";
import type { PrizeKey, PrizePool, PrizeSetting } from "@/types/quiz";

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const SIGNATURES: { type: string; ext: string; check: (b: Uint8Array) => boolean }[] = [
  { type: "image/jpeg", ext: "jpg", check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: "image/png",
    ext: "png",
    check: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    type: "image/webp",
    ext: "webp",
    check: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

/** Riconosce il formato dai byte reali del file (non dal nome o dal MIME dichiarato). */
export function detectImageType(bytes: Uint8Array): { type: string; ext: string } | null {
  if (bytes.length < 12) return null;
  const sig = SIGNATURES.find((s) => s.check(bytes));
  return sig ? { type: sig.type, ext: sig.ext } : null;
}

export async function listPrizeSettings(): Promise<PrizeSetting[]> {
  const rows = await callRpc<
    {
      key: PrizeKey;
      pool: PrizePool;
      label: string;
      win_message: string | null;
      image_path: string | null;
      stock: number | null;
      updated_at: string;
    }[]
  >("admin_list_prizes");
  return rows.map((r) => ({
    key: r.key,
    pool: r.pool,
    label: r.label,
    winMessage: r.win_message,
    imageUrl: prizeImageUrl(r.image_path),
    stock: r.stock === null ? null : Number(r.stock),
    updatedAt: r.updated_at,
  }));
}

/** Carica la nuova foto, aggiorna il DB e rimuove quella precedente. */
export async function replacePrizeImage(key: PrizeKey, bytes: Uint8Array): Promise<string | null> {
  const detected = detectImageType(bytes);
  if (!detected) throw new Error("Formato non supportato");
  // Nome nuovo a ogni caricamento: evita problemi di cache sui dispositivi.
  const path = `${key}-${Date.now()}-${randomBytes(4).toString("hex")}.${detected.ext}`;
  await uploadPrizeImage(path, bytes, detected.type);
  const res = await callRpc<{ previous_path: string | null } | null>("admin_set_prize_image", {
    p_key: key,
    p_image_path: path,
  });
  if (res?.previous_path) {
    await removePrizeImage(res.previous_path).catch(() => undefined);
  }
  return prizeImageUrl(path);
}

/**
 * Modifica nome, messaggio di vittoria (null/vuoto = predefinito) e pezzi
 * disponibili (solo casette; null = invariati).
 */
export async function updatePrize(
  key: PrizeKey,
  label: string,
  winMessage: string | null,
  stock: number | null,
): Promise<boolean> {
  const row = await callRpc<unknown | null>("admin_update_prize", {
    p_key: key,
    p_label: label,
    p_win_message: winMessage,
    p_stock: stock,
  });
  return row !== null;
}
