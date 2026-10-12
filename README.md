# Funding Pulse

A public web app that gives a venture scout at Cloudburst Ventures, a Bengaluru-based family office backing early-stage Indian startups, a weekly digest of Indian startup funding.

It collects funding news, extracts deals with Gemini Flash, matches them against the family office's **Portfolio** and **On Radar** companies, works out every statistic in code and SQL, explains the numbers with cited sources, and emails a short digest every Monday.

It answers three questions each week:

1. Which sectors are attracting capital?
2. Is deal activity speeding up or slowing in the portfolio's spaces?
3. Has a new investor started moving in our target sectors?

It also separates two kinds of alert: a Portfolio or On Radar company named **directly**, and a deal **adjacent to your portfolio** (same space, raised within the last 10 days).

The live site has a public **Method and checks** page (`/method`) that shows how it works, how edge cases are handled with real examples, the recorded test results, the latest run log and the components map.

## What it will never do

- It never invents data. A missing value is shown as "Undisclosed", "Not found" or "Not reported".
- It never lets the AI do arithmetic. Statistics come from code and SQL. The AI only explains numbers it was given.
- It never scrapes LinkedIn. LinkedIn content comes only from public web search results and from text pasted in.
- It never guesses an email address.
- It never puts a secret in the repository.

---

## Setting it up (plain-language steps)

You need four free accounts: **Neon** (database), **Vercel** (hosts the website), **Resend** (sends email) and **cron-job.org** (starts the weekly run). You also need a **Google AI Studio** key for Gemini, and a **GitHub** repository.

### 1. The database (Neon)

1. Go to neon.tech and sign in.
2. Open your project called **funding-pulse** (region: AWS Singapore).
3. Click **Connect**. Make sure **Connection pooling** is switched on.
4. Copy the long line that starts with `postgresql://`. This is your `DATABASE_URL`.
5. In the project folder, create a file named `.env.local` and put this one line in it: `DATABASE_URL=` followed by what you copied.

### 2. Gemini (the only AI)

1. Go to aistudio.google.com and sign in with a Google account.
2. Click **Get API key**, then **Create API key**. Copy it.
3. Add a line to `.env.local`: `GEMINI_API_KEY=` followed by the key.
4. The model name is already set to `gemini-3.8-flash` in `.env.example`. You do not need to change it.

### 3. Load the starting data (one time)

Open the Terminal app, go to the project folder, then run these commands one at a time. Each prints a short message when it works.

```bash
npm install
npm run db:migrate
npm run seed
```

You should see "In the database now: 156 Portfolio, 25 On Radar companies." Running `npm run seed` again changes nothing.

### 4. Load six to eight weeks of history (one time)

```bash
npm run backfill
```

This finds weekly funding roundups, reads them with Gemini, and gives the trend charts a baseline. It can take 10 to 30 minutes. If it stops because a free limit was reached, run it again later; it carries on where it left off.

### 5. Put it on the internet (Vercel)

1. Push the code to your GitHub repository.
2. Go to vercel.com, sign in with GitHub, click **Add New**, then **Project**, and choose the `funding-pulse` repository.
3. Before clicking Deploy, open **Environment Variables** and add each variable from the table below (the same values as in `.env.local`).
4. Click **Deploy**. When it finishes, Vercel shows your public address.
5. Add one more variable, `APP_URL`, set to that public address, and redeploy once. Links in emails use it.

### 6. Email (Resend)

1. Go to resend.com and create an account.
2. Click **API Keys**, create one, and copy it. This is `RESEND_API_KEY`.
3. For `RESEND_FROM`, use `Funding Pulse <onboarding@resend.dev>` to start with.
4. Until you verify your own domain in Resend, Resend only delivers to the email address that owns the Resend account. Send your first test to that address. The app shows Resend's refusal in plain words if another address is tried.
5. Add your own address under **My Coverage → Settings → Digest settings → Digest recipients** to receive the Monday digest.

### 7. The Monday schedule (cron-job.org)

1. Go to cron-job.org and create a free account.
2. Click **Create cronjob**.
3. **URL:** your public address followed by `/api/cron/digest`.
4. **Schedule:** every Monday at 06:00, and set the time zone to **Asia/Kolkata**.
5. Open **Advanced** and add a header named `Authorization` with the value `Bearer ` followed by your `CRON_SECRET` (the secret you added in Vercel; make up a long random one).
6. Save. Use **Test run**: a correct secret returns a short "started" message; a missing or wrong secret returns "Unauthorized".

The run happens in the background and takes a few minutes. It is safe to call twice: the email is sent only once per week.

---

## Environment variables

All of them are listed, without values, in `.env.example`. Real values live only in `.env.local` and in Vercel.

| Variable | What it is for |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini key and model name (default `gemini-3.8-flash`) |
| `TAVILY_API_KEY`, `EXA_API_KEY`, `SERPER_API_KEY` | Search providers, tried in this order. Any with a missing key is skipped; Gemini with Google Search is the last resort |
| `RESEND_API_KEY`, `RESEND_FROM` | Email sending |
| `CRON_SECRET` | Protects the scheduled digest endpoint and the backfill endpoint |
| `APP_URL` | Public address, used for links in emails and drafts |

## How it is built

- Next.js (App Router), TypeScript, Tailwind, shadcn/ui, `motion`. Charts are hand-built (SVG and HTML) so they can animate and print cleanly; Recharts is no longer used.
- Layout: three tabs (Brief, Market, Actions) kept in the address (`?tab=`), a My Coverage slide-over (side navigation: Mandate, Portfolio, On Radar, Investors, Contacts, Settings, with a Backup row), a data-quality strip, and a bottom bar on phones. Fonts are Instrument Serif, Geist and Geist Mono; every colour is a variable in `src/app/globals.css` for light and dark. Every animation is switched off for people who ask for reduced motion.
- One shared display filter (`src/lib/forbidden.ts`) removes a name the fund does not want shown from everything a reader or Gemini sees; stored source text is never changed. `npm run check:names` checks the repository files.
- A deal's stage is shown only when a source states it; otherwise it reads "Stage not reported" and the deal drawer shows which outlet said what (`src/lib/stage-words.ts`).
- Email drafts (LP note, founder, portfolio check-in) are written in `src/lib/actions/drafts.ts` in first person with no internal labels and one link at most; Gemini may polish them from the Compose drawer (Improve, Rewrite warmer, Shorter) but is rejected if it changes a number or link.
- Neon Postgres with Drizzle ORM. Nothing is written to disk at runtime; all state is in the database. Vercel functions run in Singapore (`sin1`) next to the database.
- zod validates all input. Resend and React Email send mail.
- The pipeline steps are short, repeatable and resumable: collect, extract, process (normalise, deduplicate, match), compute, analyse, store, send. Progress is written to the `runs` table, which the Refresh stepper reads.
- All thresholds and limits live in the **digest settings** and can be edited in the sidebar without a redeploy.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Run the site on your computer |
| `npm run db:migrate` | Create or update the database tables |
| `npm run seed` | Load the starting Portfolio, On Radar, investors, contacts and settings (safe to repeat) |
| `npm run backfill` | One-off load of recent weekly roundups |
| `npm test` | Run the automated tests |
| `npm run lint` and `npm run typecheck` | Code checks |
| `npm run check:names` | Fails if a forbidden name appears anywhere in the repository |
| `npm run check:secrets` | Fails if a key or password appears in the repository |
| `npm run record:tests` | Runs the tests and records the result shown on the Method page. Run before every push |
| `npm run gen:components-map` | Rewrites `COMPONENTS_MAP.md` from `src/lib/components-map.ts` |

## More documents

- `COMPONENTS_MAP.md`: every component, its inputs, outputs, service and free-tier limit.
- `ASSUMPTIONS.md`: choices made where the brief was silent.
