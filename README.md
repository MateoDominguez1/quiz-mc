# Il Quiz ❓ – McHappy Days

Web app per il quiz a premi dei McHappy Days nei ristoranti **McDonald's Merlata, Rho, Bonola e Magenta**. In ogni ristorante si usa **un dispositivo del personale** (tablet o telefono) su cui giocano i clienti, uno alla volta. Ogni dispositivo sceglie il proprio ristorante: **scorte dei premi, partite e rotazione delle domande sono separate per ristorante**.

Due giochi distinti:

| Gioco | Come funziona | Premio |
| --- | --- | --- |
| 🏠 **Le casette della fortuna** | 1 domanda **facile**. Se la risposta è esatta il cliente sceglie una delle 5 Case Ronald (Brescia, Firenze, Bologna, Roma Palidoro, Milano Niguarda) | Premio estratto a caso tra quelli ancora disponibili |
| 🍔 **La sfida Big Mac** | 3 domande di fila: **facile, media, difficile**. Basta un errore per perdere | Big Mac |

Alla fine il personale preme **"Nuovo cliente"** e si torna alla scelta del gioco.

**Domande:** lo schema importa le 70 domande dell'app "McHappy Quiz" (38 facili, 18 medie, 14 difficili) trasformate in domande a 4 risposte. Vengono inserite una sola volta: si possono poi modificare, disattivare o eliminare in `/admin`.

**Domande sempre diverse:** su un unico dispositivo i clienti si susseguono, quindi una domanda appena uscita non viene riproposta subito. Prima escono tutte le domande mai usate; poi si sceglie a caso tra il terzo di domande usate meno di recente (una domanda non si ripete prima che siano uscite almeno i 2/3 delle altre della stessa difficoltà). La rotazione vale per entrambi i giochi.

Tutto è deciso dal server e dal database (domanda, verifica, estrazione del premio, scorte): dal browser non è possibile manipolare il risultato e la risposta corretta non lascia mai il database.

| Area | URL | Accesso |
| --- | --- | --- |
| Quiz (dispositivo dei clienti) | `/` | dispositivo abilitato in `/postazione` con `POSTAZIONE_USERNAME` / `POSTAZIONE_PASSWORD` |
| Amministrazione | `/admin` | `ADMIN_USERNAME` / `ADMIN_PASSWORD` |

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL + Storage) · Lucide React · Vercel.

---

## 1. Installazione da zero

1. Crea un progetto su <https://supabase.com> (regione consigliata: **Central EU (Frankfurt)**).
2. **SQL Editor → New query**: incolla tutto [`supabase/schema.sql`](supabase/schema.sql) e premi **Run**. Lo script crea tabelle, funzioni, permessi, i premi con le scorte iniziali e il bucket di Storage **`prize-images`**.
3. Configura le variabili d'ambiente (sezione 3) e pubblica (sezione 5).
4. Entra in `/admin`: crea domande **facili, medie e difficili** e, se vuoi, carica le foto dei premi.

## 2. Aggiornamento dalla versione con QR e cassa

1. **Prima** di pubblicare il nuovo codice, riesegui l'intero `supabase/schema.sql` nel SQL Editor. È idempotente: le domande esistenti restano (diventano tutte **facili**: in `/admin` assegna la difficoltà giusta), le foto di braccialetto e cono restano, le vecchie tabelle (QR, codici premio, partecipanti) restano come storico ma non sono più usate.
2. (Facoltativo) Aggiungi su Vercel `POSTAZIONE_USERNAME` e `POSTAZIONE_PASSWORD`. Se non lo fai, per abilitare il dispositivo valgono ancora `CASSA_USERNAME` / `CASSA_PASSWORD`. `QR_VALIDITY_MINUTES` e `PUBLIC_SITE_URL` non servono più.
3. Pubblica il codice (push su `main` → deploy automatico).

Rieseguire lo schema **non** azzera le scorte dei premi.

## 3. Variabili d'ambiente

| Variabile | Descrizione | Obbligatoria |
| --- | --- | --- |
| `SUPABASE_URL` | Project URL, es. `https://abcd.supabase.co` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Chiave `service_role` / secret key (segreta) | ✅ |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Credenziali di `/admin` | ✅ |
| `POSTAZIONE_USERNAME`, `POSTAZIONE_PASSWORD` | Credenziali per abilitare il dispositivo del quiz (in alternativa `CASSA_USERNAME`/`CASSA_PASSWORD`) | ✅ |
| `ADMIN_SESSION_SECRET` | ≥ 32 caratteri casuali: firma tutte le sessioni | ✅ |
| `NEXT_PUBLIC_LOGO_URL` | Logo personalizzato in `/public` | – |

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 4. Avvio in locale

Requisiti: Node.js ≥ 20.9.

```bash
npm install
npm run dev
```

Altri comandi: `npm run build`, `npm test`, `npm run lint`, `npm run typecheck`.

## 5. Pubblicazione su Vercel

1. Importa il repository su Vercel (framework Next.js rilevato automaticamente).
2. Aggiungi le variabili della sezione 3 (*Production*) e fai **Deploy**. Dopo aver cambiato le variabili serve un **Redeploy**.

## 6. Uso quotidiano

**Dispositivo del quiz (`/`)**

- La prima volta apri il sito sul dispositivo: si apre `/postazione`. Inserisci le credenziali della postazione: il dispositivo resta abilitato per 45 giorni.
- Poi scegli **il ristorante** in cui si trova il dispositivo (si può cambiare con "Cambia ristorante" nella schermata iniziale).
- Il cliente sceglie il gioco e risponde. Durante la partita in alto c'è **"Nuovo cliente"** (con conferma) per annullarla.
- A fine partita (vinta o persa) la schermata resta visibile, anche ricaricando la pagina, finché il personale non preme **"Nuovo cliente"**.
- I premi si consegnano a mano: la schermata di vittoria mostra cosa consegnare.
- In fondo alla schermata iniziale: premi delle casette rimasti e **"Disabilita dispositivo"**.

**Amministrazione (`/admin`)**

- **Dashboard**: riepilogo per ristorante e filtro per ristorante (Tutti / Merlata / Rho / Bonola / Magenta); partite giocate, vincite per gioco, premi vinti e rimasti, domande attive per difficoltà, avvisi (es. mancano domande difficili, premi esauriti). Si aggiorna ogni 60 secondi.
- **Gestione delle domande**: crea, modifica, attiva/disattiva, elimina; ogni domanda ha una **difficoltà** (facile = casette e 1ª domanda Big Mac, media = 2ª, difficile = 3ª). Filtri per stato e difficoltà.
- **Premi e scorte**: **pezzi disponibili per ristorante** e, comuni a tutti, nome, messaggio di vittoria e foto di ogni premio.
- **Azzera statistiche**: elimina le partite (doppia conferma con la parola `AZZERA`). Domande, premi, foto e scorte restano.

**Premi delle casette (scorte iniziali di ogni ristorante)**

| Premio | Pezzi |
| --- | --- |
| Braccialetto | 55 |
| Hamburger | 10 |
| Nuggets | 10 |
| Patatine piccole | 10 |
| Cono | 10 |
| Profumatore auto | 10 |
| Gadget vario | 50 |

L'estrazione è proporzionale ai pezzi rimasti (con 55 braccialetti e 10 coni, il braccialetto esce più spesso). Un premio a 0 non esce più; con tutte le scorte a 0 il gioco delle casette viene bloccato. Il Big Mac non ha scorte.

## 7. Come funziona

- **Partita**: `start_game` crea la partita e assegna la prima domanda; il suo ID è salvato in un cookie firmato `httpOnly` del dispositivo, così ricaricando la pagina la partita continua.
- **Risposta**: il browser invia solo la lettera scelta; il database blocca la riga della partita (`FOR UPDATE`), verifica la risposta e decide il passo successivo (domanda successiva, scelta della casetta, vittoria o sconfitta). Un doppio tocco non può rispondere due volte alla stessa domanda.
- **Casetta**: `pick_house` blocca le righe dei premi, estrae un premio in proporzione alle scorte e scala la scorta nella stessa transazione. Una sola casetta per partita.
- **Rotazione delle domande**: `assign_game_question`, serializzata da un *advisory lock*; lo storico delle domande uscite resta anche dopo l'azzeramento delle statistiche.
- In caso di risposta sbagliata viene mostrato solo *"Risposta sbagliata"*, mai quella giusta.

## 8. Sicurezza

- RLS attivo e forzato su tutte le tabelle, nessuna policy pubblica; funzioni eseguibili solo da `service_role` (usata solo dal server).
- Il quiz e le sue API funzionano solo sul dispositivo abilitato (sessione `postazione`); l'admin ha una sessione separata (cookie e *audience* JWT diversi).
- Login con confronto a tempo costante, max 5 tentativi ogni 15 minuti per IP.
- Controllo `Origin` (CSRF) su tutte le richieste che modificano dati, cookie `SameSite=Strict`.
- Validazione server-side con Zod e vincoli `CHECK` nel DB.

## 9. Database

| Tabella | Contenuto |
| --- | --- |
| `questions` | Domande, risposte A–D, risposta corretta, difficoltà, stato |
| `restaurants` | I ristoranti (Merlata, Rho, Bonola, Magenta) |
| `prizes` | Premi: nome, messaggio, foto |
| `restaurant_stock` | Pezzi disponibili di ogni premio in ogni ristorante |
| `games` | Partite: gioco, stato, passo, casetta scelta, premio vinto |
| `game_questions` | Domande assegnate a ogni passo e risposte (storico per la rotazione) |
| `rate_limits` | Contatori anti-abuso del login |

Le tabelle delle versioni precedenti (`participants`, `entry_qr_codes`, `prize_codes`, `daily_question_assignments`, `prize_settings`, `daily_questions`, `responses`) restano come storico, protette da RLS.

## 10. API

| Metodo | Endpoint | Accesso |
| --- | --- | --- |
| POST | `/api/postazione/login`, `/api/postazione/logout` | – |
| POST, DELETE | `/api/postazione/restaurant` `{ restaurant }` | postazione |
| GET | `/api/game` | postazione |
| POST | `/api/game` `{ mode: "casette" \| "bigmac" }` | postazione |
| DELETE | `/api/game` (nuovo cliente) | postazione |
| POST | `/api/game/answer` `{ answer }` | postazione |
| POST | `/api/game/house` `{ house }` | postazione |
| POST | `/api/admin/login`, `/api/admin/logout` | – |
| GET, POST | `/api/admin/questions` | admin |
| GET, PUT, DELETE | `/api/admin/questions/:id` | admin |
| PATCH | `/api/admin/questions/:id/status` | admin |
| POST | `/api/admin/stats/reset` `{ confirm: "AZZERA" }` | admin |
| GET | `/api/admin/prizes` | admin |
| PATCH | `/api/admin/prizes/:key` `{ label, winMessage }` | admin |
| PUT | `/api/admin/stock` `{ restaurant, prize, stock }` | admin |
| POST | `/api/admin/prizes/:key/image` (multipart) | admin |

## 11. Test

```bash
npm test
```

- `tests/sql/schema.test.ts` esegue il vero `supabase/schema.sql` su PostgreSQL embedded (PGlite): i due giochi, estrazione proporzionale e scorte, premi esauriti, doppio tocco, rotazione delle domande senza ripetizioni, "Nuovo cliente", statistiche e azzeramento, permessi RLS e **migrazione dalle versioni precedenti**.
- `tests/unit/*`: fuso orario, validazioni, riconoscimento immagini, nessuna fuga della risposta corretta.
