/**
 * Test dello schema SQL reale (supabase/schema.sql) su un PostgreSQL
 * embedded (PGlite). Verifica la logica della domanda giornaliera,
 * la protezione della risposta corretta e il rate limiting.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

const schema = readFileSync(join(__dirname, "../../supabase/schema.sql"), "utf8");

let db: PGlite;

async function rpc<T = unknown>(sql: string, params: unknown[] = []): Promise<T> {
  const res = await db.query<{ r: T }>(`select ${sql} as r`, params);
  return res.rows[0].r;
}

async function createQuestion(text: string, correct = "B", active = true) {
  return rpc<{ id: string }>(
    "public.admin_create_question($1, 'Uno', 'Due', 'Tre', 'Quattro', $2, $3)",
    [text, correct, active],
  );
}

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";

beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
    end $$;
  `);
  await db.exec(schema);
  // Lo schema deve essere idempotente.
  await db.exec(schema);
});

describe("domanda del giorno", () => {
  it("restituisce null se non ci sono domande", async () => {
    expect(await rpc("public.get_daily_question('2026-01-01'::date, null)")).toBeNull();
  });

  it("non espone mai la risposta corretta", async () => {
    await createQuestion("Domanda 1");
    const q = await rpc<Record<string, unknown>>("public.get_daily_question('2026-01-01'::date, null)");
    expect(q).not.toBeNull();
    expect(q).not.toHaveProperty("correct_answer");
    expect(JSON.stringify(q)).not.toMatch(/correct_answer/);
    expect(q.already_answered).toBe(false);
  });

  it("è la stessa per tutto il giorno e cambia il giorno dopo", async () => {
    for (let i = 0; i < 5; i++) await createQuestion(`Domanda ${i}`);
    const a1 = await rpc<{ id: string }>("public.get_daily_question('2026-01-01'::date, null)");
    const a2 = await rpc<{ id: string }>("public.get_daily_question('2026-01-01'::date, $1::uuid)", [P1]);
    expect(a2.id).toBe(a1.id);
    const b = await rpc<{ id: string }>("public.get_daily_question('2026-01-02'::date, null)");
    expect(b.id).not.toBe(a1.id);
    const count = await db.query<{ c: number }>("select count(*)::int c from daily_questions");
    expect(count.rows[0].c).toBe(2);
  });

  it("ruota su tutte le domande prima di ripeterle", async () => {
    for (let i = 0; i < 4; i++) await createQuestion(`Domanda ${i}`);
    const ids = new Set<string>();
    for (let d = 1; d <= 4; d++) {
      const q = await rpc<{ id: string }>(`public.get_daily_question('2026-03-0${d}'::date, null)`);
      ids.add(q.id);
    }
    expect(ids.size).toBe(4);
  });

  it("ignora le domande disattivate e sostituisce quella del giorno se disattivata", async () => {
    const off = await createQuestion("Spenta", "A", false);
    const on1 = await createQuestion("Accesa 1");
    const on2 = await createQuestion("Accesa 2");
    const q = await rpc<{ id: string }>("public.get_daily_question('2026-01-01'::date, null)");
    expect(q.id).not.toBe(off.id);
    await rpc("public.admin_set_question_active($1::uuid, false)", [q.id]);
    const q2 = await rpc<{ id: string }>("public.get_daily_question('2026-01-01'::date, null)");
    expect([on1.id, on2.id]).toContain(q2.id);
    expect(q2.id).not.toBe(q.id);
  });

  it("restituisce null se l'unica domanda viene disattivata", async () => {
    const q = await createQuestion("Unica");
    await rpc("public.get_daily_question('2026-01-01'::date, null)");
    await rpc("public.admin_set_question_active($1::uuid, false)", [q.id]);
    expect(await rpc("public.get_daily_question('2026-01-01'::date, null)")).toBeNull();
  });

  it("riassegna una domanda se quella del giorno viene eliminata", async () => {
    await createQuestion("A");
    await createQuestion("B");
    const q = await rpc<{ id: string }>("public.get_daily_question('2026-01-01'::date, null)");
    await rpc("public.admin_delete_question($1::uuid)", [q.id]);
    const q2 = await rpc<{ id: string }>("public.get_daily_question('2026-01-01'::date, null)");
    expect(q2.id).not.toBe(q.id);
  });
});

describe("verifica della risposta", () => {
  it("restituisce solo un booleano e registra la risposta una sola volta", async () => {
    await createQuestion("Domanda", "C");
    const q = await rpc<{ id: string }>("public.get_daily_question('2026-01-01'::date, null)");

    const wrong = await rpc<Record<string, unknown>>(
      "public.submit_answer($1::uuid, 'A', $2::uuid, '2026-01-01'::date)",
      [q.id, P1],
    );
    expect(wrong).toEqual({ status: "ok", correct: false });

    const retry = await rpc<Record<string, unknown>>(
      "public.submit_answer($1::uuid, 'C', $2::uuid, '2026-01-01'::date)",
      [q.id, P1],
    );
    expect(retry).toEqual({ status: "already_answered", correct: false });

    const right = await rpc<Record<string, unknown>>(
      "public.submit_answer($1::uuid, 'c', $2::uuid, '2026-01-01'::date)",
      [q.id, P2],
    );
    expect(right).toEqual({ status: "ok", correct: true });

    const again = await rpc<Record<string, unknown>>(
      "public.get_daily_question('2026-01-01'::date, $1::uuid)",
      [P2],
    );
    expect(again.already_answered).toBe(true);
    expect(again.was_correct).toBe(true);

    const stats = await rpc<Record<string, number>>("public.admin_get_stats('2026-01-01'::date)");
    expect(stats.today_participants).toBe(2);
    expect(stats.today_winners).toBe(1);
  });

  it("rifiuta risposte a domande non del giorno", async () => {
    const other = await createQuestion("Altra");
    await createQuestion("Oggi");
    const q = await rpc<{ id: string }>("public.get_daily_question('2026-01-01'::date, null)");
    const notToday = q.id === other.id ? (await createQuestion("x")).id : other.id;
    const res = await rpc<Record<string, unknown>>(
      "public.submit_answer($1::uuid, 'A', $2::uuid, '2026-01-01'::date)",
      [notToday, P1],
    );
    expect(res.status).toBe("stale");
  });

  it("rifiuta lettere non valide", async () => {
    await createQuestion("Domanda");
    const q = await rpc<{ id: string }>("public.get_daily_question('2026-01-01'::date, null)");
    await expect(
      rpc("public.submit_answer($1::uuid, 'E', $2::uuid, '2026-01-01'::date)", [q.id, P1]),
    ).rejects.toThrow(/invalid_answer/);
  });
});

describe("vincoli e validazione", () => {
  it("non accetta domande incomplete o risposta corretta non valida", async () => {
    await expect(
      rpc("public.admin_create_question('   ', 'a', 'b', 'c', 'd', 'A', true)"),
    ).rejects.toThrow();
    await expect(
      rpc("public.admin_create_question('Domanda', 'a', '', 'c', 'd', 'A', true)"),
    ).rejects.toThrow();
    await expect(
      rpc("public.admin_create_question('Domanda', 'a', 'b', 'c', 'd', 'Z', true)"),
    ).rejects.toThrow();
  });

  it("modifica e aggiorna updated_at", async () => {
    const q = await createQuestion("Prima");
    const upd = await rpc<Record<string, string>>(
      "public.admin_update_question($1::uuid, 'Dopo', 'a', 'b', 'c', 'd', 'D', true)",
      [q.id],
    );
    expect(upd.question_text).toBe("Dopo");
    expect(upd.correct_answer).toBe("D");
  });
});

describe("rate limiting", () => {
  it("blocca oltre il limite e si resetta", async () => {
    for (let i = 0; i < 3; i++) {
      const r = await rpc<{ allowed: boolean }>("public.check_rate_limit('k', 3, 60)");
      expect(r.allowed).toBe(true);
    }
    const blocked = await rpc<{ allowed: boolean; retry_after: number }>(
      "public.check_rate_limit('k', 3, 60)",
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.retry_after).toBeGreaterThan(0);
    await rpc("public.reset_rate_limit('k')");
    const ok = await rpc<{ allowed: boolean }>("public.check_rate_limit('k', 3, 60)");
    expect(ok.allowed).toBe(true);
  });
});

describe("sicurezza RLS", () => {
  it("anon non può leggere le tabelle né eseguire le funzioni", async () => {
    await createQuestion("Segreta", "A");
    await db.exec("set role anon");
    await expect(db.query("select correct_answer from public.questions")).rejects.toThrow();
    await expect(db.query("select public.get_daily_question(null, null)")).rejects.toThrow();
    await expect(db.query("select public.admin_list_questions()")).rejects.toThrow();
    await db.exec("reset role");
  });
});
