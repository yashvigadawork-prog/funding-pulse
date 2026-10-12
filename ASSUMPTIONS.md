# Assumptions

One line each. These are choices made where the brief was silent or inconsistent.

- Digest time: the brief says both 06:00 and 07:00 IST; the seed says 07:00, so 07:00 is used for display and in the cron-job.org steps.
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
