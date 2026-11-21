/**
 * Test dello schema SQL reale (supabase/schema.sql) su PostgreSQL embedded (PGlite).
 *
 * Nota: PGlite ha una sola connessione, quindi le richieste "simultanee"
 * (Promise.all) vengono eseguite una dopo l'altra. I test verificano che la
 * logica sia corretta qualunque sia l'ordine; in PostgreSQL reale l'atomicità
 * è garantita dai lock di riga (FOR UPDATE) e dagli advisory lock.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

const schema = readFileSync(join(__dirname, "../../supabase/schema.sql"), "utf8");
const schemaV1 = readFileSync(join(__dirname, "fixtures/schema-v1.sql"), "utf8");
const schemaV2 = readFileSync(join(__dirname, "fixtures/schema-v2.sql"), "utf8");

const ROLES = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $$;`;

let db: PGlite;

async function rpc<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> {
  const res = await db.query<{ r: T }>(`select ${sql} as r`, params);
  return res.rows[0].r;
}

/** Risposta corretta sempre "B" (salvo diversa indicazione). */
async function createQuestion(text: string, difficulty = 0, correct = "B", active = true) {
  return rpc<{ id: string }>(
    "public.admin_create_question($1, 'Uno', 'Due', 'Tre', 'Quattro', $2, $3, $4)",
    [text, correct, difficulty, active],
  );
}

async function seedAllLevels(perLevel = 3) {
  for (const lvl of [0, 1, 2]) {
    for (let i = 0; i < perLevel; i++) await createQuestion(`L${lvl}-${i}`, lvl);
  }
}

interface GameState {
  mode: string;
  status: string;
  step: number;
  total_steps: number;
  correct_count: number;
  house: string | null;
  question: { id: string; difficulty: number; question_text: string } | null;
  prize: { key: string; label: string } | null;
}

async function start(mode: "casette" | "bigmac", date = "2026-11-15") {
  const r = await rpc<{ status: string; game_id: string }>("public.start_game($1, $2::date)", [mode, date]);
  expect(r.status).toBe("ok");
  return r.game_id;
}

const state = (gid: string) => rpc<GameState>("public.get_game_state($1::uuid)", [gid]);
const answer = (gid: string, a: string) =>
  rpc<{ status: string; correct?: boolean }>("public.submit_game_answer($1::uuid, $2)", [gid, a]);
const house = (gid: string, h = "firenze") =>
  rpc<{ status: string; prize_key: string | null }>("public.pick_house($1::uuid, $2)", [gid, h]);

async function stockOf(key: string): Promise<number | null> {
  const r = await db.query<{ stock: number | null }>("select stock from prizes where key = $1", [key]);
  return r.rows[0].stock;
}

async function totalStock(): Promise<number> {
  const r = await db.query<{ n: number }>("select coalesce(sum(stock), 0)::int n from prizes");
  return r.rows[0].n;
}

beforeEach(async () => {
  db = new PGlite();
  await db.exec(ROLES);
  await db.exec(schema);
  await db.exec(schema); // idempotente
});

describe("premi iniziali", () => {
  it("scorte delle casette e Big Mac senza scorta", async () => {
    const list = await rpc<{ key: string; pool: string; stock: number | null; label: string }[]>("public.admin_list_prizes()");
    expect(list.map((p) => [p.key, p.stock])).toEqual([
      ["braccialetto", 55],
      ["hamburger", 10],
      ["nuggets", 10],
      ["patatine", 10],
      ["cono", 10],
      ["profumatore", 10],
      ["gadget", 50],
      ["bigmac", null],
    ]);
    expect(list.at(-1)).toMatchObject({ pool: "bigmac", label: "Big Mac" });
    expect(await totalStock()).toBe(155);
  });

  it("rieseguire lo schema non azzera le scorte", async () => {
    await db.query("update prizes set stock = 3 where key = 'cono'");
    await db.exec(schema);
    expect(await stockOf("cono")).toBe(3);
  });
});

describe("Le casette della fortuna", () => {
  it("una domanda facile → scelta della casetta → premio estratto e scorta scalata", async () => {
    await createQuestion("Facile", 0);
    await createQuestion("Difficile", 2);
    const gid = await start("casette");

    const s1 = await state(gid);
    expect(s1).toMatchObject({ mode: "casette", status: "playing", step: 1, total_steps: 1 });
    expect(s1.question?.difficulty).toBe(0);
    expect(JSON.stringify(s1)).not.toMatch(/correct_answer/);

    expect(await answer(gid, "b")).toEqual({ status: "ok", correct: true });
    expect((await state(gid)).status).toBe("pick_house");
    // Non si può rispondere di nuovo.
    expect((await answer(gid, "B")).status).toBe("not_playing");

    const before = await totalStock();
    const picked = await house(gid, "roma-palidoro");
    expect(picked.status).toBe("ok");
    expect(picked.prize_key).toBeTruthy();
    expect(await totalStock()).toBe(before - 1);

    const s2 = await state(gid);
    expect(s2).toMatchObject({ status: "won", house: "roma-palidoro", question: null });
    expect(s2.prize?.key).toBe(picked.prize_key);

    // Una sola casetta per partita.
    expect((await house(gid, "brescia")).status).toBe("not_allowed");
    expect(await totalStock()).toBe(before - 1);
  });

  it("risposta sbagliata: partita persa, nessuna casetta", async () => {
    await createQuestion("Facile", 0);
    const gid = await start("casette");
    expect(await answer(gid, "A")).toEqual({ status: "ok", correct: false });
    const s = await state(gid);
    expect(s.status).toBe("lost");
    expect(s.prize).toBeNull();
    expect((await house(gid)).status).toBe("not_allowed");
    expect(await totalStock()).toBe(155);
  });

  it("l'estrazione segue le scorte: un premio esaurito non esce più", async () => {
    await createQuestion("Facile", 0);
    await db.query("update prizes set stock = 0 where pool = 'casette'");
    await db.query("update prizes set stock = 2 where key = 'nuggets'");
    await db.query("update prizes set stock = 1 where key = 'cono'");
    const won: string[] = [];
    for (let i = 0; i < 3; i++) {
      const gid = await start("casette");
      await answer(gid, "B");
      won.push((await house(gid)).prize_key!);
    }
    expect(won.sort()).toEqual(["cono", "nuggets", "nuggets"]);
    expect(await totalStock()).toBe(0);
  });

  it("premi esauriti: il gioco non parte", async () => {
    await createQuestion("Facile", 0);
    await db.query("update prizes set stock = 0 where pool = 'casette'");
    expect((await rpc("public.start_game('casette', null)")).status).toBe("no_stock");
    expect((await rpc("public.game_availability()")).casette).toBe("no_stock");
  });

  it("se le scorte finiscono durante la partita la risposta giusta viene registrata senza premio", async () => {
    await createQuestion("Facile", 0);
    const gid = await start("casette");
    await db.query("update prizes set stock = 0 where pool = 'casette'");
    expect((await answer(gid, "B")).correct).toBe(true);
    const s = await state(gid);
    expect(s.status).toBe("won");
    expect(s.prize).toBeNull();
  });

  it("due tocchi simultanei sulla casetta: un solo premio", async () => {
    await createQuestion("Facile", 0);
    const gid = await start("casette");
    await answer(gid, "B");
    const res = await Promise.all([house(gid, "bologna"), house(gid, "firenze")]);
    expect(res.map((r) => r.status).sort()).toEqual(["not_allowed", "ok"]);
    expect(await totalStock()).toBe(154);
  });

  it("rifiuta casette inesistenti", async () => {
    await createQuestion("Facile", 0);
    const gid = await start("casette");
    await answer(gid, "B");
    await expect(house(gid, "napoli")).rejects.toThrow(/invalid_house/);
    expect((await state(gid)).status).toBe("pick_house");
  });

  it("serve almeno una domanda facile attiva", async () => {
    await createQuestion("Media", 1);
    await createQuestion("Facile spenta", 0, "B", false);
    expect((await rpc("public.start_game('casette', null)")).status).toBe("no_questions");
    const n = await db.query<{ c: number }>("select count(*)::int c from games");
    expect(n.rows[0].c).toBe(0);
  });
});

describe("La sfida Big Mac", () => {
  it("tre domande (facile, media, difficile): tutte giuste = Big Mac", async () => {
    await seedAllLevels();
    const gid = await start("bigmac");
    const seen: string[] = [];
    for (const lvl of [0, 1, 2]) {
      const s = await state(gid);
      expect(s).toMatchObject({ status: "playing", step: lvl + 1, total_steps: 3, correct_count: lvl });
      expect(s.question?.difficulty).toBe(lvl);
      seen.push(s.question!.id);
      expect(await answer(gid, "B")).toEqual({ status: "ok", correct: true });
    }
    expect(new Set(seen).size).toBe(3);
    const end = await state(gid);
    expect(end).toMatchObject({ status: "won", correct_count: 3, house: null });
    expect(end.prize).toMatchObject({ key: "bigmac", label: "Big Mac" });
    // Il Big Mac non tocca le scorte delle casette.
    expect(await totalStock()).toBe(155);
  });

  it("un errore alla seconda domanda chiude la partita", async () => {
    await seedAllLevels();
    const gid = await start("bigmac");
    await answer(gid, "B");
    expect(await answer(gid, "D")).toEqual({ status: "ok", correct: false });
    const s = await state(gid);
    expect(s).toMatchObject({ status: "lost", step: 2, correct_count: 1, prize: null });
    expect((await answer(gid, "B")).status).toBe("not_playing");
  });

  it("servono domande attive di tutte e tre le difficoltà", async () => {
    await createQuestion("F", 0);
    await createQuestion("M", 1);
    expect((await rpc("public.start_game('bigmac', null)")).status).toBe("no_questions");
    await createQuestion("D", 2);
    expect((await rpc("public.start_game('bigmac', null)")).status).toBe("ok");
  });

  it("se la domanda successiva non è più disponibile se ne usa un'altra attiva", async () => {
    await createQuestion("F1", 0);
    await createQuestion("F2", 0);
    await createQuestion("M", 1);
    const d = await createQuestion("D", 2);
    const gid = await start("bigmac");
    await answer(gid, "B");
    await answer(gid, "B");
    await rpc("public.admin_set_question_active($1::uuid, false)", [d.id]);
    // (la terza domanda era già assegnata: la partita continua con quella)
    expect((await answer(gid, "B")).correct).toBe(true);
    expect((await state(gid)).status).toBe("won");
  });

  it("domanda eliminata a metà partita: partita annullata", async () => {
    await seedAllLevels(1);
    const gid = await start("bigmac");
    const q = (await state(gid)).question!;
    await rpc("public.admin_delete_question($1::uuid)", [q.id]);
    expect((await answer(gid, "B")).status).toBe("no_question");
    expect((await state(gid)).status).toBe("abandoned");
  });

  it("una sola risposta per passo anche con doppio invio", async () => {
    await seedAllLevels();
    const gid = await start("bigmac");
    const res = await Promise.all([answer(gid, "B"), answer(gid, "B")]);
    expect(res.every((r) => r.status === "ok")).toBe(true);
    // Il secondo invio vale per la domanda successiva (nuova domanda già assegnata),
    // mai due volte per la stessa.
    const answered = await db.query<{ c: number }>(
      "select count(*)::int c from game_questions where game_id = $1 and selected_answer is not null",
      [gid],
    );
    expect(answered.rows[0].c).toBe(2);
    const steps = await db.query<{ step: number }>(
      "select step from game_questions where game_id = $1 order by step",
      [gid],
    );
    expect(steps.rows.map((r) => r.step)).toEqual([1, 2, 3]);
  });
});

describe("rotazione delle domande (un solo dispositivo, clienti in fila)", () => {
  it("una domanda non si ripete finché non sono uscite almeno i 2/3 delle altre", async () => {
    const n = 9;
    for (let i = 0; i < n; i++) await createQuestion(`F${i}`, 0);
    const sequence: string[] = [];
    for (let i = 0; i < 40; i++) {
      const gid = await start("casette");
      sequence.push((await state(gid)).question!.question_text);
      await rpc("public.abandon_game($1::uuid)", [gid]);
    }
    const last = new Map<string, number>();
    let minGap = Infinity;
    sequence.forEach((q, i) => {
      if (last.has(q)) minGap = Math.min(minGap, i - last.get(q)! - 1);
      last.set(q, i);
    });
    expect(minGap).toBeGreaterThanOrEqual(n - Math.ceil(n / 3));
    // Prima di ripetere qualcosa escono tutte quelle mai usate.
    expect(new Set(sequence.slice(0, n)).size).toBe(n);
  });

  it("vale anche tra i due giochi e per tutte le difficoltà", async () => {
    await seedAllLevels(4);
    const easy: string[] = [];
    for (let i = 0; i < 12; i++) {
      const gid = await start(i % 2 ? "casette" : "bigmac");
      easy.push((await state(gid)).question!.question_text);
      await rpc("public.abandon_game($1::uuid)", [gid]);
    }
    for (let i = 1; i < easy.length; i++) {
      expect(easy.slice(Math.max(0, i - 2), i)).not.toContain(easy[i]);
    }
    expect(new Set(easy.slice(0, 4)).size).toBe(4);
  });

  it("le domande nuove vengono proposte subito e le disattivate mai", async () => {
    await createQuestion("Vecchia", 0);
    for (let i = 0; i < 3; i++) await rpc("public.abandon_game($1::uuid)", [await start("casette")]);
    await createQuestion("Nuova", 0);
    await createQuestion("Spenta", 0, "B", false);
    const gid = await start("casette");
    expect((await state(gid)).question?.question_text).toBe("Nuova");
    for (let i = 0; i < 6; i++) {
      const g = await start("casette");
      expect((await state(g)).question?.question_text).not.toBe("Spenta");
      await rpc("public.abandon_game($1::uuid)", [g]);
    }
  });

  it("con una sola domanda facile la usa comunque", async () => {
    await createQuestion("Unica", 0);
    for (let i = 0; i < 3; i++) {
      const gid = await start("casette");
      expect((await state(gid)).question?.question_text).toBe("Unica");
    }
  });
});

describe("nuovo cliente", () => {
  it("abbandona la partita in corso; le partite concluse restano invariate", async () => {
    await createQuestion("F", 0);
    const g1 = await start("casette");
    expect((await rpc("public.abandon_game($1::uuid)", [g1])).abandoned).toBe(true);
    expect((await state(g1)).status).toBe("abandoned");
    expect((await answer(g1, "B")).status).toBe("not_playing");

    const g2 = await start("casette");
    await answer(g2, "A");
    expect((await rpc("public.abandon_game($1::uuid)", [g2])).abandoned).toBe(false);
    expect((await state(g2)).status).toBe("lost");
  });
});

describe("statistiche", () => {
  it("partite, vincite, premi e scorte", async () => {
    await seedAllLevels();
    // Casette: 2 vinte (una ieri), 1 persa; Big Mac: 1 vinto, 1 perso; 1 abbandonata.
    for (const [date, ok] of [["2026-11-14", true], ["2026-11-15", true], ["2026-11-15", false]] as const) {
      const gid = await start("casette", date);
      await answer(gid, ok ? "B" : "A");
      if (ok) await house(gid);
    }
    const win = await start("bigmac");
    for (let i = 0; i < 3; i++) await answer(win, "B");
    const lose = await start("bigmac");
    await answer(lose, "C");
    await rpc("public.abandon_game($1::uuid)", [await start("casette")]);

    const s = await rpc<{
      casette: Record<string, number>;
      bigmac: Record<string, number>;
      abandoned: number;
      stock_left: number;
      prizes: { key: string; won: number; stock: number | null }[];
      total_questions: number;
      active_by_difficulty: number[];
    }>("public.admin_get_stats('2026-11-15'::date)");
    expect(s.casette).toEqual({ played: 3, won: 2, lost: 1, today_played: 2, today_won: 1 });
    expect(s.bigmac).toEqual({ played: 2, won: 1, lost: 1, today_played: 2, today_won: 1 });
    expect(s.abandoned).toBe(1);
    expect(s.stock_left).toBe(153);
    expect(s.prizes.find((p) => p.key === "bigmac")).toMatchObject({ won: 1, stock: null });
    expect(s.prizes.filter((p) => p.key !== "bigmac").reduce((a, p) => a + p.won, 0)).toBe(2);
    expect(s.total_questions).toBe(9);
    expect(s.active_by_difficulty).toEqual([3, 3, 3]);
  });

  it("azzeramento: via le partite, restano domande, premi, scorte e rotazione", async () => {
    await createQuestion("A", 0);
    await createQuestion("B", 0);
    const gid = await start("casette");
    const first = (await state(gid)).question!.question_text;
    await answer(gid, "B");
    await house(gid);
    await rpc("public.admin_set_prize_image('cono', 'cono.webp')");

    expect(await rpc("public.admin_reset_stats()")).toEqual({ games_deleted: 1 });
    const s = await rpc<{ casette: { played: number }; stock_left: number; total_questions: number }>(
      "public.admin_get_stats(null)",
    );
    expect(s.casette.played).toBe(0);
    expect(s.stock_left).toBe(154);
    expect(s.total_questions).toBe(2);
    const prizes = await rpc<{ key: string; image_path: string | null }[]>("public.admin_list_prizes()");
    expect(prizes.find((p) => p.key === "cono")?.image_path).toBe("cono.webp");
    // La domanda appena uscita non viene riproposta subito.
    const next = await start("casette");
    expect((await state(next)).question?.question_text).not.toBe(first);
  });
});

describe("amministrazione premi e domande", () => {
  it("nome, messaggio e pezzi disponibili", async () => {
    const upd = await rpc("public.admin_update_prize('cono', '  Gelato ', '   ', 7)");
    expect(upd).toMatchObject({ label: "Gelato", win_message: null, stock: 7 });
    // Scorta null = invariata; per il Big Mac la scorta resta sempre null.
    expect(await rpc("public.admin_update_prize('cono', 'Gelato', 'Bravo!', null)")).toMatchObject({ stock: 7 });
    expect(await rpc("public.admin_update_prize('bigmac', 'Big Mac', null, 5)")).toMatchObject({ stock: null });
    await expect(rpc("public.admin_update_prize('cono', '   ', null, 1)")).rejects.toThrow();
    await expect(rpc("public.admin_update_prize('cono', 'Ok', null, -1)")).rejects.toThrow();
    await expect(rpc("public.admin_update_prize('cono', $1, null, 1)", ["x".repeat(41)])).rejects.toThrow();
    expect(await rpc("public.admin_update_prize('pizza', 'Pizza', null, 1)")).toBeNull();
  });

  it("foto: restituisce il percorso precedente per poterlo eliminare", async () => {
    expect((await rpc("public.admin_set_prize_image('gadget', 'g-1.webp')")).previous_path).toBeNull();
    expect((await rpc("public.admin_set_prize_image('gadget', 'g-2.webp')")).previous_path).toBe("g-1.webp");
    expect(await rpc("public.admin_set_prize_image('pizza', 'x.webp')")).toBeNull();
  });

  it("difficoltà delle domande", async () => {
    const q = await createQuestion("Q", 2);
    expect(q).toMatchObject({ difficulty: 2 });
    const upd = await rpc(
      "public.admin_update_question($1::uuid, 'Q', 'Uno', 'Due', 'Tre', 'Quattro', 'A', 1, true)",
      [q.id],
    );
    expect(upd).toMatchObject({ difficulty: 1, correct_answer: "A" });
    await expect(createQuestion("X", 3)).rejects.toThrow();
    const list = await rpc<{ difficulty: number; times_used: number; last_used_date: string | null }[]>(
      "public.admin_list_questions()",
    );
    expect(list[0]).toMatchObject({ difficulty: 1, times_used: 0, last_used_date: null });
  });
});

describe("sicurezza", () => {
  it("anon non può leggere tabelle né eseguire funzioni", async () => {
    await db.exec("set role anon");
    for (const sql of [
      "select correct_answer from public.questions",
      "select * from public.games",
      "select * from public.prizes",
      "select public.start_game('casette', null)",
      "select public.pick_house(gen_random_uuid(), 'firenze')",
      "select public.admin_get_stats(null)",
      "select public.admin_reset_stats()",
    ]) {
      await expect(db.query(sql), sql).rejects.toThrow();
    }
    await db.exec("reset role");
  });

  it("rifiuta modalità e risposte non valide", async () => {
    await expect(rpc("public.start_game('pizza', null)")).rejects.toThrow(/invalid_mode/);
    await createQuestion("F", 0);
    const gid = await start("casette");
    await expect(answer(gid, "E")).rejects.toThrow(/invalid_answer/);
    expect((await state(gid)).status).toBe("playing");
  });
});

describe("aggiornamento dalle versioni precedenti", () => {
  it("dalla versione con QR e cassa: domande e foto restano, le nuove funzioni funzionano", async () => {
    db = new PGlite();
    await db.exec(ROLES);
    await db.exec(schemaV2);
    await db.query("select public.admin_create_question('Domanda esistente', 'a', 'b', 'c', 'd', 'B', true)");
    await db.query("select public.admin_set_prize_image('cono', 'cono-vecchio.webp')");
    await db.exec(schema);
    await db.exec(schema);

    const qs = await rpc<{ question_text: string; difficulty: number }[]>("public.admin_list_questions()");
    expect(qs).toEqual([expect.objectContaining({ question_text: "Domanda esistente", difficulty: 0 })]);
    const prizes = await rpc<{ key: string; image_path: string | null }[]>("public.admin_list_prizes()");
    expect(prizes.find((p) => p.key === "cono")?.image_path).toBe("cono-vecchio.webp");
    const fns = await db.query<{ c: number }>(
      "select count(*)::int c from pg_proc where proname in ('redeem_entry', 'cassa_create_entry', 'prize_for_age')",
    );
    expect(fns.rows[0].c).toBe(0);

    const gid = await start("casette");
    expect((await answer(gid, "B")).correct).toBe(true);
    expect((await house(gid)).status).toBe("ok");
  });

  it("dalla prima versione (domanda del giorno)", async () => {
    db = new PGlite();
    await db.exec(ROLES);
    await db.exec(schemaV1);
    await db.query("select public.admin_create_question('Vecchia domanda', 'a', 'b', 'c', 'd', 'C', true)");
    await db.exec(schema);
    const gid = await start("casette");
    expect((await answer(gid, "C")).correct).toBe(true);
    const old = await db.query<{ c: number }>("select count(*)::int c from questions");
    expect(old.rows[0].c).toBe(1);
  });
});
