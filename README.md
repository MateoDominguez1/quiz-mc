# Il Quiz del Giorno 🍟

Web app mobile-first per i ristoranti McDonald's Italia: il cliente inquadra un QR code, legge **la domanda del giorno**, risponde e scopre subito se ha vinto. L'amministratore gestisce le domande da **/admin**, senza toccare il codice.

- **Una sola domanda al giorno**, uguale per tutti, che cambia da sola alle **00:00 ora italiana** (Europe/Rome), senza cron job.
- **La risposta corretta non arriva mai al browser**: la verifica avviene nel database, che restituisce solo `corretta / sbagliata`.
- Una sola risposta per partecipante al giorno (cookie anonimo + vincolo nel DB).
- Pannello amministrativo responsive (card su smartphone, tabella su desktop), login protetto contro brute force.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL) · Lucide React · Vercel.

---

## Indice

1. [Creare il progetto Supabase](#1-creare-il-progetto-supabase)
2. [Eseguire lo schema SQL](#2-eseguire-lo-schema-sql)
3. [Configurare le variabili d'ambiente](#3-configurare-le-variabili-dambiente)
4. [Avviare il progetto in locale](#4-avviare-il-progetto-in-locale)
5. [Pubblicare su Vercel](#5-pubblicare-su-vercel)
6. [Configurare il dominio personalizzato](#6-configurare-il-dominio-personalizzato)
7. [Logo ufficiale e QR code](#7-logo-ufficiale-e-qr-code)
8. [Come funziona](#8-come-funziona)
9. [Sicurezza](#9-sicurezza)
10. [Struttura del progetto](#10-struttura-del-progetto)
11. [API](#11-api)
12. [Test](#12-test)

---

## 1. Creare il progetto Supabase

1. Vai su <https://supabase.com> e accedi (o crea un account).
2. **New project** → scegli l'organizzazione, un nome (es. `quiz-del-giorno`), una password del database e la regione **Central EU (Frankfurt)** o la più vicina all'Italia.
3. Attendi qualche minuto che il progetto sia pronto.

## 2. Eseguire lo schema SQL

1. Nel progetto Supabase apri **SQL Editor → New query**.
2. Copia **tutto** il contenuto di [`supabase/schema.sql`](supabase/schema.sql), incollalo e premi **Run**.
3. Dovresti vedere `Success. No rows returned`. Lo script è idempotente: puoi rieseguirlo dopo un aggiornamento.

Lo schema crea:

| Tabella | Scopo |
| --- | --- |
| `questions` | Domande, 4 risposte, risposta corretta, stato attivo/disattivo, date di creazione/modifica |
| `daily_questions` | Assegnazione domanda ↔ data italiana (`question_date` **UNIQUE**: una sola domanda per giorno) |
| `responses` | Risposte anonime (per statistiche e per impedire più risposte nello stesso giorno) |
| `rate_limits` | Contatori per rate limiting e protezione brute force |

Tutte le tabelle hanno **RLS attivo senza policy pubbliche**: con la chiave `anon` non si può leggere né modificare nulla. Le funzioni SQL sono eseguibili solo dalla `service_role`, usata esclusivamente dal server Next.js.

## 3. Configurare le variabili d'ambiente

Copia `.env.example` in `.env.local` e compila:

| Variabile | Dove trovarla / come generarla | Obbligatoria |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase → **Project Settings → API → Project URL** | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → **Project Settings → API → service_role** (segreta!) | ✅ |
| `ADMIN_USERNAME` | Nome utente a scelta per /admin | ✅ |
| `ADMIN_PASSWORD` | Password lunga e unica (≥ 12 caratteri consigliati) | ✅ |
| `ADMIN_SESSION_SECRET` | Stringa casuale ≥ 32 caratteri (vedi comando sotto) | ✅ |
| `NEXT_PUBLIC_LOGO_URL` | Percorso del logo in `/public`, es. `/logo.svg` | – |
| `NEXT_PUBLIC_BRAND_NAME` | Nome mostrato se non c'è il logo (default `McDonald's`) | – |

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> ⚠️ Non usare mai il prefisso `NEXT_PUBLIC_` per la service role key o per le credenziali admin: verrebbero esposte nel browser.
>
> Cambiando `ADMIN_USERNAME` o `ADMIN_SESSION_SECRET` tutte le sessioni admin attive vengono invalidate.

## 4. Avviare il progetto in locale

Requisiti: **Node.js ≥ 20.9** e npm.

```bash
npm install
```

```bash
npm run dev
```

Apri <http://localhost:3000> (quiz) e <http://localhost:3000/admin> (pannello).

Altri comandi:

```bash
npm run build
```

```bash
npm test
```

```bash
npm run lint
```

## 5. Pubblicare su Vercel

1. Esegui il push del repository su GitHub.
2. Su <https://vercel.com> → **Add New… → Project** → importa il repository. Framework: **Next.js** (rilevato automaticamente, nessuna modifica necessaria).
3. In **Environment Variables** aggiungi tutte le variabili della tabella al punto 3 (ambiente *Production*, e se vuoi anche *Preview*).
4. **Deploy**. Al termine apri l'URL `https://<progetto>.vercel.app`.
5. Accedi a `/admin`, crea almeno una domanda **attiva**: da quel momento il quiz è operativo 24 ore su 24.

Se modifichi le variabili d'ambiente in seguito, esegui un **Redeploy** affinché vengano applicate.

## 6. Configurare il dominio personalizzato

1. Vercel → progetto → **Settings → Domains** → **Add** → inserisci il dominio (es. `quiz.tuodominio.it`).
2. Vercel mostra i record DNS da creare presso il tuo provider:
   - sottodominio (`quiz.tuodominio.it`): record **CNAME** verso `cname.vercel-dns.com`;
   - dominio principale (`tuodominio.it`): record **A** verso l'IP indicato da Vercel.
3. Attendi la propagazione DNS (da pochi minuti a qualche ora). Il certificato HTTPS viene emesso automaticamente.
4. Genera il QR code con l'URL definitivo (vedi sotto).

## 7. Logo ufficiale e QR code

**Logo.** Per scelta non è incluso alcun logo: viene mostrato il nome in forma testuale. Quando avrai il logo ufficiale autorizzato:

1. copia il file in `public/` (es. `public/logo.svg`);
2. imposta `NEXT_PUBLIC_LOGO_URL=/logo.svg` (in locale e su Vercel) e rifai il deploy.

Le icone dell'app (favicon, icona iOS/Android) sono generiche (punto interrogativo giallo su rosso) e si trovano in `src/app/icon.svg` e `src/lib/icon-art.tsx`.

**QR code.** Genera un QR code che punti all'URL pubblico (es. `https://quiz.tuodominio.it`) con qualsiasi generatore affidabile, stampalo ad alta risoluzione e prova a scansionarlo con iPhone e Android prima di esporlo. Non serve installare nulla: l'app funziona direttamente in Safari e Chrome. Facoltativamente i clienti possono aggiungerla alla schermata Home (manifest PWA incluso).

## 8. Come funziona

### Domanda del giorno

- Il server calcola la data corrente nel fuso **Europe/Rome** (`src/lib/date.ts`) – l'orologio del telefono non conta.
- La funzione SQL `get_daily_question(data)`:
  1. se per quella data esiste già una domanda attiva, la restituisce (percorso veloce);
  2. altrimenti, sotto un *advisory lock*, ne sceglie una tra le **attive**, privilegiando quelle **mai usate** e poi quelle usate meno di recente (rotazione), e la salva in `daily_questions`.
- Il vincolo `UNIQUE (question_date)` garantisce una sola domanda per data, anche con migliaia di accessi simultanei. Tutti ricevono la stessa domanda, anche ricaricando la pagina o cambiando dispositivo.
- Alla mezzanotte italiana la prima richiesta del nuovo giorno assegna automaticamente la nuova domanda: **nessun cron job**, nessuna azione manuale.
- Se l'amministratore **disattiva** o **elimina** la domanda del giorno, ne viene scelta subito un'altra; se non ci sono domande attive compare *"Al momento non ci sono domande disponibili. Torna a trovarci presto!"*.
- Se una persona lascia la pagina aperta oltre la mezzanotte e risponde, il server rileva il cambio di giorno e mostra la nuova domanda.

### Risposta

1. Il browser invia `{ questionId, answer }` a `POST /api/answer`.
2. La funzione SQL `submit_answer` verifica che sia la domanda di oggi, confronta la risposta con quella salvata e registra l'esito.
3. L'API restituisce **solo** `correct: true/false`. Nessuna indicazione della risposta giusta in caso di errore.
4. Un cookie anonimo `httpOnly` (`qdg_pid`, UUID casuale, nessun dato personale) e il vincolo `UNIQUE (question_date, participant_id)` impediscono di rispondere di nuovo: ricaricando la pagina si rivede il proprio esito.

> Nota: senza account non è possibile impedire in modo assoluto che qualcuno risponda di nuovo cancellando i cookie o usando un altro dispositivo. La schermata di vittoria riporta la data del giorno (dopo aver premuto "Fantastico!") così il personale alla cassa può verificarla.

## 9. Sicurezza

- **Risposta corretta mai esposta:** le API pubbliche usano una whitelist di campi (`toPublicQuestion`) e la verifica avviene nel DB. Test automatici controllano che nessun componente client importi codice server.
- **Service role key solo sul server:** i moduli server importano `server-only`, che blocca la build se finissero nel bundle del browser.
- **RLS:** attivo e forzato su tutte le tabelle; nessuna policy per `anon`/`authenticated`; permessi `EXECUTE` revocati a tutti tranne `service_role`.
- **Autenticazione admin:** credenziali da variabili d'ambiente, confronto a tempo costante, sessione JWT firmata (HS256, 8 ore) in cookie `httpOnly`, `Secure`, `SameSite=Strict`. Le rotte `/admin/*` sono protette sia dal `proxy` sia in ogni pagina e API.
- **Brute force:** max 5 tentativi di login ogni 15 minuti per IP, con ritardo artificiale sugli errori. Contatori persistiti su Supabase (funziona con più istanze serverless). Gli IP sono salvati solo come hash.
- **Rate limiting:** risposte max 30 ogni 5 minuti per IP (soglia generosa perché il Wi‑Fi del ristorante può condividere lo stesso IP); lettura domanda max 120 al minuto.
- **CSRF:** controllo dell'header `Origin` su tutte le richieste che modificano dati.
- **Validazione server-side** con Zod (oltre ai vincoli `CHECK` nel DB): campi obbligatori, lunghezze massime, una sola risposta corretta tra A–D, risposte non duplicate.
- **Header di sicurezza** (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`) e `noindex` sul pannello.

## 10. Struttura del progetto

```
supabase/schema.sql            Schema DB, RLS e funzioni SQL (logica giornaliera, verifica, rate limit)
src/
  proxy.ts                     Protezione ottimistica delle rotte /admin
  app/
    page.tsx                   Pagina partecipante (render lato server)
    admin/page.tsx             Login amministratore
    admin/(panel)/             Area protetta: dashboard, gestione domande, nuova/modifica
    api/question/today         GET  domanda del giorno
    api/answer                 POST verifica risposta
    api/admin/login|logout     Autenticazione
    api/admin/questions/...    CRUD domande e stato attivo/disattivo
    manifest.ts, icon.svg, apple-icon.tsx, pwa-icon/   PWA e icone
  components/
    quiz/                      UI partecipante (domanda, vittoria, ringraziamento)
    admin/                     UI amministratore (shell, form, lista, dialog, toast)
    brand/BrandLogo.tsx        Spazio per il logo ufficiale
  lib/
    services/                  Logica di business (quiz, domande, rate limit)
    auth/                      Credenziali, token di sessione, guard
    supabase/server.ts         Client Supabase (solo server)
    date.ts                    Fuso orario Europe/Rome
    validation.ts              Schemi Zod
    http.ts                    Helper API (errori, IP, CSRF)
  types/quiz.ts                Tipi TypeScript
tests/                         Test (schema SQL su PostgreSQL embedded, date, sicurezza)
```

## 11. API

| Metodo | Endpoint | Accesso | Descrizione |
| --- | --- | --- | --- |
| GET | `/api/question/today` | pubblico | Domanda del giorno senza risposta corretta |
| POST | `/api/answer` | pubblico | `{ questionId, answer }` → `{ correct }` |
| POST | `/api/admin/login` | pubblico | `{ username, password }` → cookie di sessione |
| POST | `/api/admin/logout` | admin | Termina la sessione |
| GET | `/api/admin/questions` | admin | Elenco domande |
| POST | `/api/admin/questions` | admin | Crea domanda |
| GET | `/api/admin/questions/:id` | admin | Dettaglio |
| PUT | `/api/admin/questions/:id` | admin | Modifica |
| DELETE | `/api/admin/questions/:id` | admin | Elimina |
| PATCH | `/api/admin/questions/:id/status` | admin | `{ isActive }` attiva/disattiva |

## 12. Test

```bash
npm test
```

- `tests/sql/schema.test.ts` esegue il **vero** `supabase/schema.sql` su PostgreSQL embedded (PGlite): domanda unica per giorno, rotazione, sostituzione se disattivata/eliminata, verifica risposta, doppia risposta, rate limiting, permessi RLS.
- `tests/unit/date.test.ts`: cambio giorno alla mezzanotte italiana con ora solare/legale.
- `tests/unit/security.test.ts`: nessuna fuga della risposta corretta, nessun import server nei componenti client, validazioni.

L'interfaccia è stata verificata su viewport 360, 375, 393, 430 px, tablet (768 px) e desktop.
