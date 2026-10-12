# Components Map

_Generated from `src/lib/components-map.ts` by `npm run gen:components-map`. Do not edit by hand._

## Flow

Sources → Collect → Extract (Gemini) → Normalise → Deduplicate → Match → Compute (SQL and code) → Analyse (Gemini) → Stored digest → Dashboard → Email → Scheduler

Sources feed Collect. Collect passes articles to Extract, which uses Gemini to pull deals out of the text. Normalise, Deduplicate and Match then clean the deals in code. Compute works out every statistic with SQL and code. Analyse uses Gemini to explain those numbers with source links. The result is saved as a stored digest, which feeds the dashboard and the Monday email. The scheduler, cron-job.org, starts the weekly run.

## Components

| Component | Purpose | Inputs | Outputs | External service | Free-tier limit |
| --- | --- | --- | --- | --- | --- |
| Source collector | Finds feeds, reads new funding articles, fetches article text | Outlet list (editable), look-back days | Articles table | Public news sites (RSS and web pages) | None. Requests are polite, with timeouts and size caps |
| Search chain | One search function that tries providers in order and caches results for 24 hours | Query, options | Title, link, snippet, date | Tavily, Exa, Google Programmable Search, Serper, Gemini grounding | Tavily about 1,000 credits a month; Google 100 queries a day; others vary, check each provider |
| Extractor | Turns article text into structured deals (company, stage, amount as written, investors) | Article text, sector and stage lists | Raw deals stored on each article | Gemini Flash (gemini-3.8-flash) | Free tier is small and shared per project; batch size is configurable |
| Normaliser | Maps sectors by whole-word keywords, stages to the list, amounts to USD and INR with the configured rate | Raw deals, taxonomy, USD to INR rate | Clean deals | None (code) | None |
| Deduplicator | Merges the same company, round and near dates across outlets; keeps every link and any amount range | Clean deals, stored deals | Unique deals with sources | None (code) | None |
| Matcher | Matches deals to Portfolio and On Radar names, with context words for ambiguous names and a review flag for near misses | Company name, nearby text, company lists | Tag, reason, score, review flag | None (code) | None |
| Statistics engine | Capital per sector, speeding up or slowing, new investors in our records, focus deals | Stored deals, thresholds from settings | Numbers for the digest | None (SQL and code) | None |
| Adjacency finder | Spots deals in the same space as a Portfolio company and flags clusters | Deals in a 10-day window, Portfolio descriptions | Adjacent groups with shared terms | None (code) | None |
| Analyst | Writes short explanations of the computed numbers, labelled Reported or Possible, each with sources | Computed numbers, deal rows | Highlights ranking and three explanations | Gemini Flash | Shares the Gemini free-tier quota. Falls back to a template |
| Digest store | Keeps every week's digest so past weeks show as they were | Computed and written results | Digest rows | Neon Postgres (Singapore) | Free tier has a small storage cap; check Neon's current limits |
| My Coverage | Edit mandate, Portfolio, On Radar, investors, contacts and every setting without a redeploy | Forms | Saved configuration with an edit log | Neon Postgres | None |
| Dashboard | KPI strip, data quality strip, sections 1 to 3, drawers and charts | Stored digest | Web page | Vercel (Next.js) | Hobby plan limits; functions up to 300 seconds |
| Refresh now | Runs the pipeline on demand, one run at a time, with a cooldown, and shows progress | Button press | Run log rows | Vercel function plus Neon | Cooldown set in settings |
| Scheduler | Starts the weekly run every Monday with a secret key | Time | A call to the digest endpoint | cron-job.org | Free plan is enough for one weekly job |
| Email sender | Sends the digest and Compose emails with safeguards (demo blocks, daily cap, send log) | Digest or draft, recipient | Email and a send log | Resend | Free plan about 100 emails a day; without a verified domain only the account owner's address works |
| Compose drawer | One place to edit and confirm every email type | Draft, recipient | Sent email or a copied LinkedIn note | Resend (through the sender) | Per-visitor hourly limit for new addresses |
| Founder contact finder | Finds a founder, public LinkedIn link and a published email, each with its source. Never guesses | Company, domain | Founder, link, email or Not found | Search chain and the company's own website | Uses search queries from the run budget |
| Ask drawer | Answers questions only from stored data, with links; offers a labelled web search if not found | Question | Answer and sources | Gemini Flash | Per-visitor hourly limit and a daily cap |
| Paste box | Reads a public post (for example from LinkedIn) that a person pastes in, with its link, as if it were an article | Post text and link | Deals added to the stored data | Gemini Flash | Shares the per-visitor hourly limit and daily cap. Nothing is fetched from LinkedIn |
| PDF report | Print-styled page, one section per page, charts included | Stored digest | Browser print dialog or PDF | None (browser) | None |
| Rate limiter and run lock | Protects public endpoints and allows one run at a time | Caller id (hashed) | Allow or refuse | Neon Postgres | None |
| Method page | Shows how it works, edge cases with live examples, recorded test results and the latest run log | Database, test results file | Public page | Vercel | None |

## Known limits

- Free tiers are small. Gemini, search providers and email each have daily or monthly caps, so a very busy week can leave some articles waiting for the next refresh.
- On Radar entries come from a single source each and should be verified before relying on a figure.
- LinkedIn coverage is partial: only public posts that normal web search returns, plus anything pasted in. Nothing is scraped from LinkedIn.
- The USD to INR rate is a configured approximation, not a live market rate.
- Weekly deal counts depend on which outlets could be reached; a quiet number can mean missing coverage, not a quiet market.
- Founder emails are only shown when published on the company's own site, so many will say Not found.
- Sector and stage labels come from the article text and keyword rules; some deals will land in Other or Unknown.
