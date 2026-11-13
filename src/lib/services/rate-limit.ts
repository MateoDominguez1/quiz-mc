import "server-only";
import { createHash } from "node:crypto";
import { getHashSalt } from "@/lib/env";
import { callRpc } from "@/lib/supabase/server";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

/** Hash dell'identificativo (es. IP): nel DB non vengono mai salvati IP in chiaro. */
export function hashKey(value: string): string {
  return createHash("sha256").update(`${getHashSalt()}:${value}`).digest("hex").slice(0, 32);
}

/**
 * Rate limiting a finestra fissa, persistito su Supabase così da funzionare
 * correttamente anche con più istanze serverless su Vercel.
 */
export async function checkRateLimit(
  scope: string,
  identifier: string,
  max: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const res = await callRpc<{ allowed: boolean; remaining: number; retry_after: number }>(
    "check_rate_limit",
    { p_key: `${scope}:${hashKey(identifier)}`, p_max: max, p_window_seconds: windowSeconds },
  );
  return { allowed: res.allowed, remaining: res.remaining, retryAfter: res.retry_after };
}

export async function resetRateLimit(scope: string, identifier: string): Promise<void> {
  await callRpc("reset_rate_limit", { p_key: `${scope}:${hashKey(identifier)}` });
}
