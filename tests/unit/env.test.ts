import { describe, expect, it } from "vitest";
import { ConfigError, normalizeSupabaseUrl } from "@/lib/env";

describe("normalizeSupabaseUrl", () => {
  it("tiene solo l'origine del progetto", () => {
    const base = "https://abcdxyz.supabase.co";
    expect(normalizeSupabaseUrl(base)).toBe(base);
    expect(normalizeSupabaseUrl(`${base}/`)).toBe(base);
    expect(normalizeSupabaseUrl(`${base}/rest/v1/`)).toBe(base);
    expect(normalizeSupabaseUrl(`  ${base}/rest/v1  `)).toBe(base);
  });

  it("rifiuta valori non validi", () => {
    expect(() => normalizeSupabaseUrl("abcdxyz.supabase.co")).toThrow(ConfigError);
    expect(() => normalizeSupabaseUrl("ftp://abcdxyz.supabase.co")).toThrow(ConfigError);
  });
});
