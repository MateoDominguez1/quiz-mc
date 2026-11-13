import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

let client: SupabaseClient | null = null;

/**
 * Client Supabase con SERVICE_ROLE_KEY: utilizzabile SOLO sul server
 * (l'import di "server-only" impedisce l'inclusione nel bundle del browser).
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    const { url, serviceRoleKey } = getSupabaseEnv();
    client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { "x-application-name": "quiz-del-giorno" } },
    });
  }
  return client;
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

/** Esegue una funzione SQL (RPC) e restituisce il risultato JSON. */
export async function callRpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await getSupabaseAdmin().rpc(fn, args);
  if (error) {
    throw new DatabaseError(error.message, error.code);
  }
  return data as T;
}
