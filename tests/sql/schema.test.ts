/**
 * Test dello schema SQL reale (supabase/schema.sql) su PostgreSQL embedded (PGlite).
 *
 * Nota: PGlite ha una sola connessione, quindi le richieste "simultanee"
 * (Promise.all) vengono eseguite una dopo l'altra. I test verificano che la
 * logica sia corretta qualunque sia l'ordine; in PostgreSQL reale l'atomicità
 * è garantita dagli UPDATE condizionali (lock di riga) e dagli advisory lock.
 */
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

const schema = readFileSync(join(__dirname, "../../supabase/schema.sql"), "utf8");
const schemaV1 = readFileSync(join(__dirname, "fixtures/schema-v1.sql"), "utf8");

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

async function createQuestion(text: string, correct = "B", active = true) {
  return rpc<{ id: string }>(
    "public.admin_create_question($1, 'Uno', 'Due', 'Tre', 'Quattro', $2, $3)",
    [text, correct, active],
  );
}

function newToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}

async function createEntry(ttl = 60) {
  const t = newToken();
  const e = await rpc<{ id: string }>("public.cassa_create_entry($1, $2, 'cassa')", [t.hash, ttl]);
  return { ...t, id: e.id };
}

async function join_(age: number, date = "2026-11-15") {
  const e = await createEntry();
  const r = await rpc<{ status: string; participant_id: string }>(
    "public.redeem_entry($1, $2, $3::date)",
    [e.hash, age, date],
  );
  expect(r.status).toBe("ok");
  return r.participant_id;
}

async function questionOf(pid: string): Promise<string> {
  const s = await rpc<{ question: { id: string } }>("public.get_participant_state($1::uuid)", [pid]);
  return s.question.id;
}

async function correctAnswerOf(qid: string): Promise<string> {
  const r = await db.query<{ c: string }>("select correct_answer c from questions where id = $1", [qid]);
  return r.rows[0].c.trim();
}

async function wrongAnswerOf(qid: string): Promise<string> {
  const c = await correctAnswerOf(qid);
  return ["A", "B", "C", "D"].find((l) => l !== c)!;
}

beforeEach(async () => {
  db = new PGlite();
  await db.exec(ROLES);
  await db.exec(schema);
  await db.exec(schema); // idempotente
});

describe("QR monouso", () => {
  it("primo utilizzo valido, secondo utilizzo rifiutato", async () => {
    await createQuestion("D1");
    const e = await createEntry();
    expect((await rpc("public.entry_status($1, null)", [e.hash])).status).toBe("valid");

    const first = await rpc("public.redeem_entry($1, 30, '2026-11-15'::date)", [e.hash]);
    expect(first.status).toBe("ok");
    const second = await rpc("public.redeem_entry($1, 30, '2026-11-15'::date)", [e.hash]);
    expect(second.status).toBe("invalid");
    expect((await rpc("public.entry_status($1, null)", [e.hash])).status).toBe("invalid");
    // Lo stesso partecipante che ricarica la pagina viene riconosciuto.
    expect((await rpc("public.entry_status($1, $2::uuid)", [e.hash, first.participant_id])).status).toBe("mine");
  });

  it("due scansioni simultanee: una sola ha successo", async () => {
    await createQuestion("D1");
    const e = await createEntry();
    const results = await Promise.all([
      rpc("public.redeem_entry($1, 20, '2026-11-15'::date)", [e.hash]),
      rpc("public.redeem_entry($1, 40, '2026-11-15'::date)", [e.hash]),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["invalid", "ok"]);
    const n = await db.query<{ c: number }>("select count(*)::int c from participants");
    expect(n.rows[0].c).toBe(1);
  });

  it("token inesistente, scaduto o annullato non è valido", async () => {
    expect((await rpc("public.redeem_entry($1, 30, null)", ["0".repeat(64)])).status).toBe("invalid");

    const expired = await createEntry(1);
    await db.query("update entry_qr_codes set expires_at = now() - interval '1 second' where id = $1", [expired.id]);
    expect((await rpc("public.redeem_entry($1, 30, null)", [expired.hash])).status).toBe("invalid");
    expect((await rpc("public.cassa_entry_status($1::uuid)", [expired.id])).status).toBe("expired");

    const cancelled = await createEntry();
    expect((await rpc("public.cassa_cancel_entry($1::uuid)", [cancelled.id])).cancelled).toBe(true);
    expect((await rpc("public.redeem_entry($1, 30, null)", [cancelled.hash])).status).toBe("invalid");
  });

  it("rifiuta età non valide senza consumare il QR", async () => {
    const e = await createEntry();
    await expect(rpc("public.redeem_entry($1, -1, null)", [e.hash])).rejects.toThrow(/invalid_age/);
    await expect(rpc("public.redeem_entry($1, 121, null)", [e.hash])).rejects.toThrow(/invalid_age/);
    expect((await rpc("public.entry_status($1, null)", [e.hash])).status).toBe("valid");
  });

  it("salva solo l'hash del token", async () => {
    const e = await createEntry();
    const r = await db.query<{ token_hash: string }>("select token_hash from entry_qr_codes where id = $1", [e.id]);
    expect(r.rows[0].token_hash).toBe(e.hash);
    expect(r.rows[0].token_hash).not.toContain(e.token);
  });
});

describe("domande casuali", () => {
  it("partecipanti diversi ricevono domande diverse finché disponibili", async () => {
    for (let i = 0; i < 5; i++) await createQuestion(`D${i}`);
    const pids = await Promise.all([1, 2, 3, 4, 5].map(() => join_(30)));
    const qs = await Promise.all(pids.map(questionOf));
    expect(new Set(qs).size).toBe(5);
  });

  it("esaurite le domande inizia un nuovo ciclo, senza ripetere subito l'ultima", async () => {
    for (let i = 0; i < 3; i++) await createQuestion(`D${i}`);
    const qs: string[] = [];
    for (let i = 0; i < 9; i++) qs.push(await questionOf(await join_(30)));
    // Ogni ciclo di 3 contiene tutte le domande.
    for (let c = 0; c < 3; c++) expect(new Set(qs.slice(c * 3, c * 3 + 3)).size).toBe(3);
    // Mai la stessa domanda due volte di fila.
    for (let i = 1; i < qs.length; i++) expect(qs[i]).not.toBe(qs[i - 1]);
  });

  it("con una sola domanda attiva la assegna comunque", async () => {
    await createQuestion("Unica");
    const a = await questionOf(await join_(30));
    const b = await questionOf(await join_(30));
    expect(a).toBe(b);
  });

  it("ignora le domande disattivate", async () => {
    const off = await createQuestion("Spenta", "A", false);
    await createQuestion("Accesa");
    for (let i = 0; i < 3; i++) expect(await questionOf(await join_(30))).not.toBe(off.id);
  });

  it("alle 00:00 italiane riparte il ciclo e lo storico resta", async () => {
    for (let i = 0; i < 3; i++) await createQuestion(`D${i}`);
    const day1 = [];
    for (let i = 0; i < 3; i++) day1.push(await questionOf(await join_(30, "2026-11-15")));
    const day2 = [];
    for (let i = 0; i < 3; i++) day2.push(await questionOf(await join_(30, "2026-11-16")));
    expect(new Set(day1).size).toBe(3);
    expect(new Set(day2).size).toBe(3);
    const hist = await db.query<{ d: string; c: number }>(
      "select assignment_date::text d, count(*)::int c from daily_question_assignments group by 1 order by 1",
    );
    expect(hist.rows).toEqual([
      { d: "2026-11-15", c: 3 },
      { d: "2026-11-16", c: 3 },
    ]);
  });

  it("senza domande attive il partecipante viene creato ma senza domanda", async () => {
    const e = await createEntry();
    const r = await rpc("public.redeem_entry($1, 30, null)", [e.hash]);
    expect(r.status).toBe("ok");
    expect(r.has_question).toBe(false);
    const res = await rpc("public.submit_participant_answer($1::uuid, 'A')", [r.participant_id]);
    expect(res.status).toBe("no_question");
  });
});

describe("risposta e premi per età", () => {
  it.each([
    [0, "braccialetto"],
    [10, "braccialetto"],
    [11, "cono"],
    [17, "cono"],
    [18, "caffe"],
    [90, "caffe"],
  ])("età %i → %s", async (age, prize) => {
    await createQuestion("D");
    const pid = await join_(age);
    const qid = await questionOf(pid);
    const res = await rpc("public.submit_participant_answer($1::uuid, $2)", [pid, await correctAnswerOf(qid)]);
    expect(res).toEqual({ status: "ok", correct: true });
    const st = await rpc<{ prize: { type: string; code: string; status: string } }>(
      "public.get_participant_state($1::uuid)",
      [pid],
    );
    expect(st.prize.type).toBe(prize);
    expect(st.prize.code).toMatch(/^QUIZ-[2-9A-HJ-NP-Z]{6}$/);
    expect(st.prize.status).toBe("pending");
  });

  it("risposta sbagliata: nessun premio e nessuna risposta corretta esposta", async () => {
    await createQuestion("D");
    const pid = await join_(30);
    const qid = await questionOf(pid);
    const res = await rpc("public.submit_participant_answer($1::uuid, $2)", [pid, await wrongAnswerOf(qid)]);
    expect(res).toEqual({ status: "ok", correct: false });
    const st = await rpc("public.get_participant_state($1::uuid)", [pid]);
    expect(st.prize).toBeNull();
    expect(JSON.stringify(st)).not.toMatch(/correct_answer/);
    const n = await db.query<{ c: number }>("select count(*)::int c from prize_codes");
    expect(n.rows[0].c).toBe(0);
  });

  it("una sola risposta per partecipazione, anche con invii simultanei", async () => {
    await createQuestion("D");
    const pid = await join_(30);
    const qid = await questionOf(pid);
    const right = await correctAnswerOf(qid);
    const wrong = await wrongAnswerOf(qid);
    const [a, b] = await Promise.all([
      rpc("public.submit_participant_answer($1::uuid, $2)", [pid, wrong]),
      rpc("public.submit_participant_answer($1::uuid, $2)", [pid, right]),
    ]);
    expect(a).toEqual({ status: "ok", correct: false });
    expect(b).toEqual({ status: "already_answered", correct: false });
    const n = await db.query<{ c: number }>("select count(*)::int c from prize_codes");
    expect(n.rows[0].c).toBe(0);
  });

  it("i codici premio sono univoci", async () => {
    await createQuestion("D", "A");
    const codes = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const pid = await join_(30);
      await rpc("public.submit_participant_answer($1::uuid, 'A')", [pid]);
      const st = await rpc<{ prize: { code: string } }>("public.get_participant_state($1::uuid)", [pid]);
      codes.add(st.prize.code);
    }
    expect(codes.size).toBe(40);
  });

  it("rifiuta lettere non valide", async () => {
    await createQuestion("D");
    const pid = await join_(30);
    await expect(rpc("public.submit_participant_answer($1::uuid, 'E')", [pid])).rejects.toThrow(/invalid_answer/);
  });
});

describe("riscatto premi in cassa", () => {
  async function winner(age = 30) {
    await createQuestion("D", "A");
    const pid = await join_(age);
    await rpc("public.submit_participant_answer($1::uuid, 'A')", [pid]);
    const st = await rpc<{ prize: { code: string } }>("public.get_participant_state($1::uuid)", [pid]);
    return st.prize.code;
  }

  it("verifica, riscatta e impedisce il doppio riscatto", async () => {
    const code = await winner(15);
    const look = await rpc("public.cassa_lookup_prize($1)", [code]);
    expect(look).toMatchObject({ status: "pending", code, prize_type: "cono", label: "Cono" });

    const r1 = await rpc("public.cassa_redeem_prize($1, 'cassa')", [code]);
    expect(r1.status).toBe("redeemed");
    expect(r1.redeemed_at).toBeTruthy();

    const r2 = await rpc("public.cassa_redeem_prize($1, 'cassa')", [code]);
    expect(r2.status).toBe("already_redeemed");
    expect(r2.redeemed_at).toBe(r1.redeemed_at);
    expect((await rpc("public.cassa_lookup_prize($1)", [code])).status).toBe("redeemed");
  });

  it("due operatori simultanei: un solo riscatto", async () => {
    const code = await winner();
    const res = await Promise.all([
      rpc("public.cassa_redeem_prize($1, 'op1')", [code]),
      rpc("public.cassa_redeem_prize($1, 'op2')", [code]),
    ]);
    expect(res.map((r) => r.status).sort()).toEqual(["already_redeemed", "redeemed"]);
  });

  it("accetta il codice scritto in modo libero", async () => {
    const code = await winner();
    const suffix = code.slice(5);
    for (const variant of [code.toLowerCase(), ` ${suffix} `, `quiz ${suffix}`, `QUIZ${suffix}`]) {
      expect((await rpc("public.cassa_lookup_prize($1)", [variant])).code).toBe(code);
    }
  });

  it("codice inesistente", async () => {
    expect((await rpc("public.cassa_lookup_prize('QUIZ-AAAAAA')")).status).toBe("not_found");
    expect((await rpc("public.cassa_redeem_prize('QUIZ-AAAAAA', 'x')")).status).toBe("not_found");
    expect((await rpc("public.cassa_lookup_prize('')")).status).toBe("not_found");
  });

  it("storico riscossioni", async () => {
    const code = await winner();
    await rpc("public.cassa_redeem_prize($1, 'cassa')", [code]);
    const h = await rpc<{ items: { code: string }[]; pending_total: number }>("public.cassa_list_redemptions(50)");
    expect(h.items.map((i) => i.code)).toEqual([code]);
    expect(h.pending_total).toBe(0);
  });
});

describe("statistiche cumulative", () => {
  it("conteggi, premi ed età", async () => {
    await createQuestion("D", "A");
    const plan: [number, string, boolean][] = [
      [8, "A", true],
      [15, "A", true],
      [40, "A", true],
      [70, "B", false],
    ];
    const codes: string[] = [];
    for (const [i, [age, ans]] of plan.entries()) {
      const pid = await join_(age, i < 2 ? "2026-11-14" : "2026-11-15");
      await rpc("public.submit_participant_answer($1::uuid, $2)", [pid, ans]);
      const st = await rpc<{ prize: { code: string } | null }>("public.get_participant_state($1::uuid)", [pid]);
      if (st.prize) codes.push(st.prize.code);
    }
    // Un partecipante entrato ma che non ha ancora risposto.
    await join_(25, "2026-11-15");
    await rpc("public.cassa_redeem_prize($1, 'cassa')", [codes[0]]);

    const s = await rpc<Record<string, unknown>>("public.admin_get_stats('2026-11-15'::date)");
    expect(s.total_participants).toBe(5);
    expect(s.total_winners).toBe(3);
    expect(s.prizes_redeemed).toBe(1);
    expect(s.prizes_pending).toBe(2);
    expect(s.today_participants).toBe(3);
    expect(s.today_winners).toBe(1);
    expect(Number(s.average_age)).toBeCloseTo((8 + 15 + 40 + 70 + 25) / 5, 1);
    const br = s.age_brackets as { label: string; count: number; percent: number }[];
    expect(Object.fromEntries(br.map((b) => [b.label, b.count]))).toEqual({
      "0–10": 1, "11–17": 1, "18–29": 1, "30–44": 1, "45–64": 0, "65+": 1,
    });
    expect(br.reduce((a, b) => a + Number(b.percent), 0)).toBeCloseTo(100, 0);
    expect((s.prizes_by_type as Record<string, { won: number; redeemed: number }>).braccialetto).toMatchObject({ label: "Braccialetto", won: 1, redeemed: 1 });
  });

  it("database vuoto", async () => {
    const s = await rpc<Record<string, unknown>>("public.admin_get_stats(null)");
    expect(s.total_participants).toBe(0);
    expect(s.average_age).toBeNull();
  });
});

describe("azzeramento statistiche", () => {
  async function scenario() {
    await createQuestion("D", "A");
    const winners: string[] = [];
    for (const age of [8, 30, 15]) {
      const pid = await join_(age);
      await rpc("public.submit_participant_answer($1::uuid, 'A')", [pid]);
      const st = await rpc<{ prize: { code: string } }>("public.get_participant_state($1::uuid)", [pid]);
      winners.push(st.prize.code);
    }
    const loser = await join_(50);
    await rpc("public.submit_participant_answer($1::uuid, 'B')", [loser]);
    await rpc("public.cassa_redeem_prize($1, 'cassa')", [winners[0]]);
    const unused = await createEntry();
    return { winners, unused };
  }

  it("azzera tutto ma conserva domande e foto", async () => {
    const { winners, unused } = await scenario();
    await rpc("public.admin_set_prize_image('cono', 'cono.webp')");
    const res = await rpc("public.admin_reset_stats(false)");
    expect(res).toMatchObject({ participants_deleted: 4, prizes_deleted: 3, pending_kept: 0 });

    const s = await rpc<Record<string, unknown>>("public.admin_get_stats(null)");
    expect([s.total_participants, s.total_winners, s.prizes_redeemed, s.prizes_pending]).toEqual([0, 0, 0, 0]);
    expect(s.average_age).toBeNull();
    expect(s.total_questions).toBe(1);
    expect((await rpc("public.cassa_lookup_prize($1)", [winners[1]])).status).toBe("not_found");
    expect((await rpc("public.entry_status($1, null)", [unused.hash])).status).toBe("invalid");
    const photos = await rpc<{ image_path: string | null }[]>("public.admin_list_prize_settings()");
    expect(photos[1].image_path).toBe("cono.webp");
    // Il quiz continua a funzionare dopo l'azzeramento.
    await join_(20);
  });

  it("conserva i premi da ritirare se richiesto", async () => {
    const { winners } = await scenario();
    const res = await rpc("public.admin_reset_stats(true)");
    expect(res).toMatchObject({ participants_deleted: 2, prizes_deleted: 1, pending_kept: 2 });

    const s = await rpc<Record<string, unknown>>("public.admin_get_stats(null)");
    expect([s.total_participants, s.total_winners, s.prizes_redeemed, s.prizes_pending]).toEqual([2, 2, 0, 2]);
    // I codici non ancora ritirati restano validi e riscattabili.
    expect((await rpc("public.cassa_lookup_prize($1)", [winners[1]])).status).toBe("pending");
    expect((await rpc("public.cassa_redeem_prize($1, 'cassa')", [winners[2]])).status).toBe("redeemed");
    expect((await rpc("public.cassa_lookup_prize($1)", [winners[0]])).status).toBe("not_found");
  });

  it("anon non può azzerare", async () => {
    await db.exec("set role anon");
    await expect(db.query("select public.admin_reset_stats(false)")).rejects.toThrow();
    await db.exec("reset role");
  });
});

describe("nomi dei premi", () => {
  it("l'admin rinomina il premio e il nuovo nome compare ovunque", async () => {
    const upd = await rpc("public.admin_update_prize('caffe', '  Cappuccino ', 'Complimenti! Hai vinto un cappuccino!')");
    expect(upd).toMatchObject({ label: "Cappuccino", win_message: "Complimenti! Hai vinto un cappuccino!" });

    await createQuestion("D", "A");
    const pid = await join_(40);
    await rpc("public.submit_participant_answer($1::uuid, 'A')", [pid]);
    const st = await rpc<{ prize: { type: string; label: string; win_message: string; code: string } }>(
      "public.get_participant_state($1::uuid)",
      [pid],
    );
    // Il tipo (deciso dall'età) non cambia; cambiano nome e messaggio.
    expect(st.prize).toMatchObject({ type: "caffe", label: "Cappuccino", win_message: "Complimenti! Hai vinto un cappuccino!" });
    expect((await rpc("public.cassa_lookup_prize($1)", [st.prize.code])).label).toBe("Cappuccino");
    const stats = await rpc<{ prizes_by_type: Record<string, { label: string }> }>("public.admin_get_stats(null)");
    expect(stats.prizes_by_type.caffe.label).toBe("Cappuccino");
    const list = await rpc<{ prize_type: string; label: string }[]>("public.admin_list_prize_settings()");
    expect(list.find((p) => p.prize_type === "caffe")?.label).toBe("Cappuccino");
  });

  it("messaggio vuoto = messaggio predefinito; nome vuoto o troppo lungo rifiutato", async () => {
    const upd = await rpc("public.admin_update_prize('cono', 'Gelato', '   ')");
    expect(upd.win_message).toBeNull();
    await expect(rpc("public.admin_update_prize('cono', '   ', null)")).rejects.toThrow();
    await expect(rpc("public.admin_update_prize('cono', $1, null)", ["x".repeat(41)])).rejects.toThrow();
    await expect(rpc("public.admin_update_prize('cono', 'Ok', $1)", ["x".repeat(121)])).rejects.toThrow();
    expect(await rpc("public.admin_update_prize('pizza', 'Pizza', null)")).toBeNull();
  });
});

describe("foto premi", () => {
  it("restituisce il percorso precedente per poterlo eliminare", async () => {
    const a = await rpc("public.admin_set_prize_image('cono', 'cono-1.webp')");
    expect(a.previous_path).toBeNull();
    const b = await rpc("public.admin_set_prize_image('cono', 'cono-2.webp')");
    expect(b.previous_path).toBe("cono-1.webp");
    const list = await rpc<{ prize_type: string; image_path: string | null }[]>("public.admin_list_prize_settings()");
    expect(list.map((p) => p.prize_type)).toEqual(["braccialetto", "cono", "caffe"]);
    expect(list[1].image_path).toBe("cono-2.webp");
    expect(await rpc("public.admin_set_prize_image('pizza', 'x.webp')")).toBeNull();
  });
});

describe("sicurezza", () => {
  it("anon non può leggere tabelle né eseguire funzioni", async () => {
    await db.exec("set role anon");
    for (const sql of [
      "select correct_answer from public.questions",
      "select * from public.prize_codes",
      "select * from public.entry_qr_codes",
      "select * from public.participants",
      "select public.cassa_redeem_prize('QUIZ-AAAAAA', 'x')",
      "select public.cassa_create_entry(repeat('a', 64), 60, 'x')",
      "select public.admin_get_stats(null)",
    ]) {
      await expect(db.query(sql), sql).rejects.toThrow();
    }
    await db.exec("reset role");
  });
});

describe("aggiornamento dal database della versione precedente", () => {
  it("mantiene le domande esistenti e funziona dopo la migrazione", async () => {
    db = new PGlite();
    await db.exec(ROLES);
    await db.exec(schemaV1);
    await db.query(
      "select public.admin_create_question('Vecchia domanda', 'a', 'b', 'c', 'd', 'C', true)",
    );
    await db.query("select public.get_daily_question('2026-11-10'::date, null)");
    await db.exec(schema);

    const qs = await rpc<{ question_text: string; times_used: number }[]>("public.admin_list_questions()");
    expect(qs.map((q) => q.question_text)).toEqual(["Vecchia domanda"]);
    const pid = await join_(12);
    const res = await rpc("public.submit_participant_answer($1::uuid, 'C')", [pid]);
    expect(res).toEqual({ status: "ok", correct: true });
    const old = await db.query<{ c: number }>("select count(*)::int c from daily_questions");
    expect(old.rows[0].c).toBe(1); // storico conservato
  });
});
