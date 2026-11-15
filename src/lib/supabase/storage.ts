import "server-only";
import { getSupabaseEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const PRIZE_BUCKET = "prize-images";

/** URL pubblico (CDN Supabase) di una foto premio. */
export function prizeImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const { url } = getSupabaseEnv();
  return `${url}/storage/v1/object/public/${PRIZE_BUCKET}/${encodeURIComponent(path)}`;
}

export async function uploadPrizeImage(path: string, data: Uint8Array, contentType: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .storage.from(PRIZE_BUCKET)
    .upload(path, data, { contentType, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`Caricamento foto non riuscito: ${error.message}`);
}

export async function removePrizeImage(path: string): Promise<void> {
  await getSupabaseAdmin().storage.from(PRIZE_BUCKET).remove([path]);
}
