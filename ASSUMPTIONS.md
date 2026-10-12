# Assumptions

One line each. These are choices made where the brief was silent or inconsistent.

- Digest time: the brief said both 06:00 and 07:00 IST; the owner chose 06:00, so the seed, the displayed time and the cron-job.org schedule all use 06:00 IST every Monday.
- The experimental "Cache Components" setting that the starter project enabled was switched off, because the dashboard reads live data on every request.
- The scaffold imported a third-party `cn` package for class names; it was replaced with the standard `clsx` plus `tailwind-merge` helper.
- Gemini model: `gemini-3.8-flash`, the current stable Flash model on Google's models page on 12 Oct 2026. It is read from `GEMINI_MODEL`.
- Gemini is called through the REST `generateContent` endpoint with a JSON schema. If the API rejects `responseJsonSchema` the client switches once to `responseSchema`.
- The seed's three On Radar entries with `stage_last_seen: "Early-stage"` keep that value, although it is not in the stage list; it is displayed as written and treated as unknown for statistics.
- Sources have no `enabled` flag in the seed, so every source defaults to enabled. Feed addresses are discovered on the first run and saved back to the editable sources setting.
- `npm run seed` adds missing rows only and never overwrites edits, so running it twice changes nothing. "Reset to defaults" is the way to restore the original list.
- Settings missing from the seed (cooldown, per-visitor limits, search cache hours, batch size, adjacency, typical weekly volume) default in code when absent, and are also written into the seed. An older stored database falls back to these defaults rather than failing.
- The digest week is the week that contains yesterday (IST): on Monday morning this is the week that just ended; during the week it is the week so far.
- A deal's date is the date stated in the text if it is believable; otherwise the article's publish date. A weekly roundup published on Monday or Tuesday without a date range in its title is filed under the previous Sunday.
- When outlets disagree on an amount, the middle value is used for totals, the range is kept, and confidence is "low".
- Deals with an Unknown or Debt stage are not "focus deals" because those stages are not in the mandate's stage list.
- "New investor" means no earlier appearance in that sector in stored history, and is suppressed for sectors with fewer prior deals than the minimum baseline setting.
- Highlight candidates (top 15) are chosen by a transparent score in code. Gemini only orders them and writes one line each. Its text is rejected if it contains a number that was not in the data it was given, then retried once, then replaced by a template.
- Gemini cites sources by number; the app maps numbers to real links, so the AI can never invent a link.
- The public Refresh runs in the background (`after`) with a 300-second limit and records progress in the database, so the page can poll it. Cron-job.org gets an immediate "started" answer for the same reason.
- Backfill finds roundups from Entrackr's list pages and through the search chain (Gemini with Google Search is the last resort). Weeks without a found roundup are listed in the run log.
- Founder emails are shown only when they are written on the company's own pages and belong to the company's domain; they are often generic addresses.
- Compose "Improve with AI" rewrites a draft but is rejected if it adds or drops a number or a link.
- Rate-limit counters store a short hash of the visitor's address, never the address itself.
- Test results shown on the Method page are recorded by `npm run record:tests`, run before each push, and not computed during the build.
- A near-miss company name (needs review) keeps its Portfolio or On Radar tag in the database, but it is not counted as a watchlist hit or a focus-deal exception until it is confirmed; it appears only in the Needs review list.
- Social media posts (Instagram, Facebook, X, YouTube and similar) are never accepted as news sources. LinkedIn only appears through the LinkedIn search path.
- "New investors" are counted only in the focus (target) sectors, and placeholder names such as "existing investors" or "angel investors" are ignored. With few weeks of history the count is high; it reflects "new in our records", not "new to the market".
- Two names for one company (a brand and its parent) are merged only when the amount matches within 3%, they share a named investor, and the names share a distinctive word.
- History weeks loaded from roundups get a plain template summary by design (no AI cost); the "AI service unavailable" banner appears only when the AI genuinely failed.
- Gemini "thinking" is set to low by default (`GEMINI_THINKING_LEVEL`), because thinking tokens count against the output limit. An optional backup key (`GEMINI_API_KEY_BACKUP`) is used automatically if the main key is refused or its daily quota is used up.
- Outlets that block automated readers or have no public feed (Moneycontrol, BW Disrupt, DealStreetAsia, VCCircle, PTI, Business Wire) stay "unreachable" and are reported honestly in the data quality strip.
- The LinkedIn official APIs cannot look up other people's profiles, posts or emails (they only return the signed-in person's own data), so founder cards offer a plain "Check on LinkedIn" search link that opens in the user's own browser. The app never calls LinkedIn.
- The fund the portfolio list was modelled on may appear in stored news as an ordinary investor (for example as a named backer in a funding round). That is left as it is. The rule is that nothing in the repository, seed, README or interface presents this dashboard as that fund's own, and `npm run check:names` enforces that for the code and documents.
- Gemini batch size: 5 ordinary articles per call (roundups go one per call, with a larger output limit) was accepted by the free tier with no rejections across about 40 calls; up to three calls run at once, starting at least 2.5 seconds apart. It is editable as "Articles per AI call" in Settings.
- Search providers: Tavily and Exa were tested live (Tavily answers first; Exa and Gemini with Google Search are the fallbacks). Serper and Google Programmable Search have not been tested because no keys were supplied; the chain skips any provider whose key is missing. An empty answer from one provider falls through to the next.
- Outlets whose feed cannot be read are covered by a search limited to their own website (up to a quarter of the per-run search limit, which is 30 by default). The data quality tooltip lists which outlets were searched instead.
