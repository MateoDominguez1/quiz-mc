# Il Quiz ❓

Web app mobile-first per un quiz a premi in negozio:

1. il cliente paga alla cassa;
2. l'operatore preme **"Pagamento ricevuto"** e mostra un **QR code monouso**;
3. il cliente lo scansiona, indica **quanti anni ha** e riceve una **domanda casuale**;
4. se risponde correttamente vince il premio della sua fascia d'età e riceve un **codice premio univoco** (es. `QUIZ-8F3K92`);
5. alla cassa l'operatore inserisce il codice e **conferma la consegna**: il codice viene invalidato per sempre.

Tutto è deciso dal server e dal database (domanda, verifica, premio, codici): dal browser non è possibile manipolare il risultato.

| Area | URL | Accesso |
| --- | --- | --- |
| Partecipante | `/` e `/q/<token>` (dal QR) | Pubblico, solo con QR valido |
| Cassa | `/cassa` | `CASSA_USERNAME` / `CASSA_PASSWORD` |
| Amministrazione | `/admin` | `ADMIN_USERNAME` / `ADMIN_PASSWORD` |

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL + Storage) · Lucide React · Vercel.

---

## Indice

1. [Installazione da zero](#1-installazione-da-zero)
2. [Aggiornamento dalla versione precedente](#2-aggiornamento-dalla-versione-precedente)
3. [Variabili d'ambiente](#3-variabili-dambiente)
4. [Avvio in locale](#4-avvio-in-locale)
5. [Pubblicazione su Vercel e dominio](#5-pubblicazione-su-vercel-e-dominio)
6. [Uso quotidiano](#6-uso-quotidiano)
7. [Come funziona](#7-come-funziona)
8. [Sicurezza](#8-sicurezza)
9. [Database](#9-database)
10. [API](#10-api)
11. [Test](#11-test)

---

## 1. Installazione da zero

1. Crea un progetto su <https://supabase.com> (regione consigliata: **Central EU (Frankfurt)**).
2. **SQL Editor → New query**: incolla tutto [`supabase/schema.sql`](supabase/schema.sql) e premi **Run**. Lo script crea tabelle, funzioni, permessi e il bucket di Storage **`prize-images`** (pubblico in lettura) per le foto dei premi.
3. Configura le variabili d'ambiente (sezione 3) e pubblica (sezione 5).
4. Entra in `/admin`: crea alcune domande **attive** e carica le tre foto in **Premi e foto**.

## 2. Aggiornamento dalla versione precedente

La versione precedente usava una sola domanda al giorno uguale per tutti. Per aggiornare **senza perdere le domande esistenti**:

1. **Prima** di pubblicare il nuovo codice, riesegui l'intero `supabase/schema.sql` nel SQL Editor (è idempotente: aggiunge le nuove tabelle e funzioni; le vecchie tabelle `daily_questions` e `responses` restano come storico).
2. Aggiungi su Vercel le nuove variabili **`CASSA_USERNAME`** e **`CASSA_PASSWORD`**.
3. Pubblica il codice (push su `main` → deploy automatico).
4. In `/admin → Premi e foto` carica le foto di braccialetto, cono e caffè.

> Dopo l'aggiornamento gli amministratori dovranno accedere di nuovo (il cookie di sessione è cambiato).

## 3. Variabili d'ambiente

| Variabile | Descrizione | Obbligatoria |
| --- | --- | --- |
| `SUPABASE_URL` | Project URL, es. `https://abcd.supabase.co` (anche con `/rest/v1` finale) | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Chiave `service_role` / secret key (segreta) | ✅ |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Credenziali di `/admin` | ✅ |
| `CASSA_USERNAME`, `CASSA_PASSWORD` | Credenziali di `/cassa` | ✅ |
| `ADMIN_SESSION_SECRET` | ≥ 32 caratteri casuali: firma tutte le sessioni | ✅ |
| `QR_VALIDITY_MINUTES` | Validità di un QR non usato (default 60) | – |
| `PUBLIC_SITE_URL` | Dominio da usare nei QR (default: quello della cassa) | – |
| `NEXT_PUBLIC_LOGO_URL` | Logo personalizzato in `/public` | – |

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Cambiando `ADMIN_SESSION_SECRET` tutte le sessioni (anche quelle dei partecipanti in corso) vengono invalidate.

## 4. Avvio in locale

Requisiti: Node.js ≥ 20.9.

```bash
npm install
```

```bash
npm run dev
```

Altri comandi: `npm run build`, `npm test`, `npm run lint`.

## 5. Pubblicazione su Vercel e dominio

1. Importa il repository su Vercel (framework Next.js rilevato automaticamente).
2. Aggiungi tutte le variabili della sezione 3 (*Production*) e fai **Deploy**. Ogni push su `main` ripubblica automaticamente; dopo aver cambiato le variabili serve un **Redeploy**.
3. Dominio personalizzato: Vercel → **Settings → Domains → Add**, poi crea presso il provider DNS il record indicato (CNAME `cname.vercel-dns.com` per un sottodominio, record A per il dominio principale). Il certificato HTTPS è automatico.
4. Se la cassa usa un dominio diverso da quello pubblico, imposta `PUBLIC_SITE_URL` così che i QR puntino sempre al dominio giusto.

## 6. Uso quotidiano

**Cassa (`/cassa`)** – utilizzabile da smartphone, tablet o PC:

- **Nuova partecipazione** → "Pagamento ricevuto" → il QR appare sullo schermo. La schermata si aggiorna da sola quando il cliente lo usa ("QR code utilizzato"). "Annulla QR" lo invalida se il cliente rinuncia.
- **Riscatta un premio** → digita il codice (vanno bene anche minuscole, spazi o solo le 6 lettere finali) → "Verifica codice" → "Conferma consegna".
- **Storico riscossioni** → ultimi premi consegnati con data e ora.

**Amministrazione (`/admin`)**:

- **Dashboard**: totale partecipanti, vincitori, premi riscattati e da ritirare (cumulativi), età media e distribuzione per fascia d'età, premi per tipo. Si aggiorna ogni 30 secondi.
- **Gestione delle domande**: crea, modifica, attiva/disattiva, elimina.
- **Premi e foto**: carica o sostituisci la foto di ogni premio (viene ridimensionata a 900 px in WebP nel browser prima dell'invio).

**Premi per età** (decisi solo dal database):

| Età | Premio |
| --- | --- |
| 0–10 | Braccialetto |
| 11–17 | Cono |
| 18+ | Caffè |

## 7. Come funziona

### QR monouso

- Il server genera un token casuale di 256 bit; nel database viene salvato **solo il suo SHA-256**.
- Aprire il link non consuma il QR (le anteprime dei link non lo "bruciano"): viene consumato quando il cliente invia la sua età.
- Il consumo è un singolo `UPDATE … WHERE status = 'pending' AND expires_at > now()`: con due scansioni simultanee PostgreSQL blocca la riga, la seconda richiesta non trova più il QR in stato `pending` e riceve *"Questo codice è già stato utilizzato o non è più valido."*.
- Nella stessa transazione vengono creati il partecipante e la sua domanda, e il browser riceve una **sessione firmata** in cookie `httpOnly` (24 ore): ricaricando o riaprendo il browser la partita continua.

### Domande casuali

- Ogni giorno (Europe/Rome) inizia un nuovo ciclo: tutte le domande attive sono disponibili.
- A ogni nuovo partecipante viene assegnata, a caso, una tra le domande attive **assegnate meno volte oggi**: prima si usano tutte, poi riparte un nuovo ciclo casuale, evitando se possibile di riproporre subito l'ultima assegnata.
- Le assegnazioni sono serializzate con un *advisory lock* per data: due richieste simultanee non ricevono la stessa domanda finché ce ne sono altre disponibili.
- Lo storico resta in `daily_question_assignments`.

### Risposta, premio e codice

- Il browser invia solo la lettera scelta; la domanda è quella legata alla sessione.
- Il database blocca la riga del partecipante, registra una sola risposta, decide il premio dall'età salvata e genera il codice `QUIZ-XXXXXX` (alfabeto senza 0/O/1/I, vincolo `UNIQUE`, rigenerato in caso di collisione).
- La risposta corretta non lascia mai il database; in caso di errore viene mostrato solo *"Risposta sbagliata"*.

### Riscatto

- "Conferma consegna" esegue `UPDATE … SET status = 'redeemed' WHERE code = … AND status = 'pending'`: anche con due operatori contemporanei un solo riscatto riesce; l'altro vede *"ATTENZIONE: questo premio è già stato riscattato."* con data e ora.

## 8. Sicurezza

- RLS attivo e forzato su tutte le tabelle, nessuna policy pubblica; funzioni eseguibili solo da `service_role` (usata solo dal server, protetta da `server-only`).
- Tre sessioni separate (admin, cassa, partecipante) con cookie e *audience* JWT diversi: una sessione non vale per un'altra area. Rotte `/admin/*` e `/cassa/*` protette dal proxy e verificate di nuovo in ogni pagina e API.
- Login con confronto a tempo costante, max 5 tentativi ogni 15 minuti per IP (separati per admin e cassa).
- Rate limiting persistente su Supabase per ingresso, risposte, verifiche dei codici e creazione QR.
- Controllo `Origin` (CSRF) su tutte le richieste che modificano dati.
- Validazione server-side con Zod e vincoli `CHECK` nel DB: età intera 0–120, risposte A–D, formato token e codici.
- Foto premi: formato verificato dai byte reali (JPEG/PNG/WebP), max 3 MB, caricamento solo da admin.
- Il link del QR usa `Referrer-Policy: no-referrer`.

## 9. Database

| Tabella | Contenuto |
| --- | --- |
| `questions` | Domande, risposte A–D, risposta corretta, stato |
| `participants` | Età, domanda, risposta, esito, premio, data di assegnazione |
| `entry_qr_codes` | Hash del token, stato (`pending`/`used`/`cancelled`), scadenza, partecipante |
| `prize_codes` | Codice univoco, partecipante, premio, stato (`pending`/`redeemed`), data di riscatto |
| `daily_question_assignments` | Storico domanda ↔ partecipante per data |
| `prize_settings` | Etichetta e foto dei tre premi |
| `rate_limits` | Contatori anti-abuso |
| `daily_questions`, `responses` | Storico della versione precedente (non più usate) |

## 10. API

| Metodo | Endpoint | Accesso |
| --- | --- | --- |
| POST | `/api/entry` `{ token, age }` | pubblico (QR valido) |
| GET | `/api/participant` | sessione partecipante |
| POST | `/api/answer` `{ answer }` | sessione partecipante |
| POST | `/api/cassa/login`, `/api/cassa/logout` | – |
| POST | `/api/cassa/entries` | cassa |
| GET, DELETE | `/api/cassa/entries/:id` | cassa |
| POST | `/api/cassa/prizes/lookup` `{ code }` | cassa |
| POST | `/api/cassa/prizes/redeem` `{ code }` | cassa |
| GET | `/api/cassa/redemptions` | cassa |
| POST | `/api/admin/login`, `/api/admin/logout` | – |
| GET, POST | `/api/admin/questions` | admin |
| GET, PUT, DELETE | `/api/admin/questions/:id` | admin |
| PATCH | `/api/admin/questions/:id/status` | admin |
| GET | `/api/admin/prizes` | admin |
| POST | `/api/admin/prizes/:type/image` (multipart) | admin |

## 11. Test

```bash
npm test
```

- `tests/sql/schema.test.ts` esegue il vero `supabase/schema.sql` su PostgreSQL embedded (PGlite): QR monouso (primo/secondo uso, scansioni simultanee, scadenza, annullamento), domande casuali e cicli giornalieri, premi per le tre fasce d'età, unicità dei codici, riscatto e doppio riscatto, operatori simultanei, statistiche cumulative, permessi RLS e **migrazione dalla versione precedente**.
- `tests/unit/*`: fuso orario, validazioni (età, token, codici), token QR, riconoscimento immagini, nessuna fuga della risposta corretta.

> PGlite usa una sola connessione, quindi le richieste "simultanee" dei test vengono eseguite in sequenza: i test verificano che il risultato sia corretto in qualsiasi ordine. In PostgreSQL l'esclusione reciproca è garantita dagli `UPDATE` condizionali (lock di riga) e dagli advisory lock.
