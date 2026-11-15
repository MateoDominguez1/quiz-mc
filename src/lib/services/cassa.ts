import "server-only";
import { getEntryTtlMinutes } from "@/lib/env";
import { generateEntryToken } from "@/lib/participant";
import { callRpc } from "@/lib/supabase/server";
import { prizeImageUrl } from "@/lib/supabase/storage";
import type { PrizeLookup, PrizeType, Redemption } from "@/types/quiz";

export interface CreatedEntry {
  id: string;
  /** Token in chiaro: esiste solo in questa risposta e nel QR, mai nel DB. */
  token: string;
  expiresAt: string;
}

export async function createEntry(createdBy: string): Promise<CreatedEntry> {
  const { token, hash } = generateEntryToken();
  const res = await callRpc<{ id: string; expires_at: string }>("cassa_create_entry", {
    p_token_hash: hash,
    p_ttl_minutes: getEntryTtlMinutes(),
    p_created_by: createdBy,
  });
  return { id: res.id, token, expiresAt: res.expires_at };
}

export type EntryState = "pending" | "used" | "cancelled" | "expired";

export async function getEntryState(id: string): Promise<{ status: EntryState; usedAt: string | null } | null> {
  const res = await callRpc<{ status: EntryState; used_at: string | null } | null>("cassa_entry_status", { p_id: id });
  return res ? { status: res.status, usedAt: res.used_at } : null;
}

export async function cancelEntry(id: string): Promise<boolean> {
  const res = await callRpc<{ cancelled: boolean }>("cassa_cancel_entry", { p_id: id });
  return Boolean(res?.cancelled);
}

interface PrizeRow {
  status: "pending" | "redeemed" | "already_redeemed" | "not_found";
  code?: string;
  prize_type?: PrizeType;
  label?: string;
  image_path?: string | null;
  redeemed_at?: string | null;
}

function toLookup(row: PrizeRow, imagePath?: string | null): PrizeLookup {
  if (row.status === "not_found" || !row.code || !row.prize_type) return { status: "not_found" };
  return {
    status: row.status,
    code: row.code,
    prizeType: row.prize_type,
    label: row.label ?? row.prize_type,
    imageUrl: prizeImageUrl(imagePath ?? row.image_path),
    redeemedAt: row.redeemed_at ?? null,
  };
}

export async function lookupPrize(code: string): Promise<PrizeLookup> {
  return toLookup(await callRpc<PrizeRow>("cassa_lookup_prize", { p_code: code }));
}

/** Riscatto atomico nel DB (UPDATE condizionale su status = 'pending'). */
export async function redeemPrize(code: string, operator: string): Promise<PrizeLookup> {
  return toLookup(await callRpc<PrizeRow>("cassa_redeem_prize", { p_code: code, p_redeemed_by: operator }));
}

export async function listRedemptions(limit = 100): Promise<{
  items: Redemption[];
  redeemedToday: number;
  pendingTotal: number;
}> {
  const res = await callRpc<{
    items: { code: string; prize_type: PrizeType; label: string; redeemed_at: string }[];
    redeemed_today: number;
    pending_total: number;
  }>("cassa_list_redemptions", { p_limit: limit });
  return {
    items: res.items.map((i) => ({ code: i.code, prizeType: i.prize_type, label: i.label, redeemedAt: i.redeemed_at })),
    redeemedToday: Number(res.redeemed_today),
    pendingTotal: Number(res.pending_total),
  };
}
