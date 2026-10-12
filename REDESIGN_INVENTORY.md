# Redesign inventory: nothing gets lost

This list was written **before** any layout change. Every piece of information or control that exists today has one row: where it lives now, and where it goes in the new design. The last column is filled in at the end of the redesign ("kept, moved to X"), after checking it in the running app.

Layout words used below:
- **Brief / Market / Actions** are the three tabs. **Method** opens the Method page.
- **Drawer** = a slide-in panel. **Tip** = an info-icon tooltip (hover, keyboard focus or tap).
- "Hidden by default" means collapsed behind "See all", "Read the analysis", a tab or a drawer, never removed.

## A. Top bar, shell and page-level states

| # | Information or control | Where now | Where it goes | Status |
|---|---|---|---|---|
| A1 | Name + subtitle (family office, location) | Top bar | Top bar brand: "Funding Pulse" (serif) + "Cloudburst Ventures · Bengaluru family office" | Kept, in: Top bar brand: "Funding Pulse" (serif) + "Cloudburst Ventures · Bengaluru family office". Checked in the running app. |
| A2 | Week picker with "(latest digest)" / "(in progress)" labels | Top bar | Top bar | Kept, in: Top bar. Checked in the running app. |
| A3 | Refresh now button + "Cooling down: try again in N minutes" text | Top bar | Top bar (primary button), cooldown text kept beside it | Kept, in: Top bar (primary button), cooldown text kept beside it. Checked in the running app. |
| A4 | Share (copy link, with fallback) | Top bar | Top bar icon button | Kept, in: Top bar icon button. Checked in the running app. |
| A5 | Download PDF | Top bar | Top bar icon button | Kept, in: Top bar icon button. Checked in the running app. |
| A6 | Method link | Top bar + page footer | Top-bar tab "Method" + page footer | Kept, in: Top-bar tab "Method" + page footer. Checked in the running app. |
| A7 | Theme toggle (crossfade) | Top bar | Top bar icon button | Kept, in: Top bar icon button. Checked in the running app. |
| A8 | My Coverage (permanent left column; mobile button) | Left column / mobile drawer | Top-bar "My Coverage" button, opens a slide-over drawer | Kept, in: Top-bar "My Coverage" button, opens a slide-over drawer. Checked in the running app. |
| A9 | Skip to content link | Layout | Layout | Kept, in: Layout. Checked in the running app. |
| A10 | Ask button | Floating button | Floating button (desktop), bottom tab "Ask" (phone) | Kept, in: Floating button (desktop), bottom tab "Ask" (phone). Checked in the running app. |
| A11 | Tab in the URL, back button | n/a (new) | `?tab=brief|market|actions` | Kept, in: `?tab=brief. Checked in the running app. |
| A12 | State: no digest yet ("No digest has been built yet" + Refresh) | Dashboard | Dashboard (same text) | Kept, same text. Checked in the code. |
| A13 | State: no digest for this week + "Go to the latest digest" | Dashboard | Dashboard (same text) | Kept, same text. Checked in the code. |
| A14 | State: week with no deals ("No deals were recorded for this week") | Dashboard | Brief and Market tabs | Kept, same text. Checked in the code. |
| A15 | Banner: data older than 8 days | Under title | Banner area under the data strip | Kept, in the banner area. Checked in the code and the unit tests for the banner texts. |
| A16 | Banner: live search unavailable (+ "Showing stored data from …") | Under title | Banner area | Kept, in the banner area. Checked in the code and the unit tests for the banner texts. |
| A17 | Banner: partial run ("Some articles are still waiting… Press Refresh again") | Under title | Banner area | Kept, in the banner area. Checked in the code and the unit tests for the banner texts. |
| A18 | Banner: written from a template (AI unavailable) / plain summary for older weeks | Section 2 | Above the three questions (Market) and on the hero (Brief) | Kept, on the Brief hero and above the three questions on Market. |
| A19 | Banner: could not refresh the page + Retry | Top of page | Top of page | Kept. Checked in the code. |
| A20 | Failed load with Retry button, loading skeleton, error page, not-found page | Dashboard / app | Same, with skeletons shaped like the new cards | Kept; skeleton now matches the new cards. Checked. |
| A21 | Refresh stepper (Collecting, Extracting, Matching, Analysing, Done, with messages, hide button) | Under title | Under the top bar while running and after a run | Kept, redesigned: the line fills step by step, the active step pulses, a check draws itself, new rows glow amber for 2 seconds, and a toast says "Refreshed: N new deals". Checked in a real run. |
| A22 | Page title "Funding Pulse" + "Week of … Emailed to the digest list." | Top of dashboard | Hero eyebrow / data strip | Kept, in: Hero eyebrow / data strip. Checked in the running app. |
| A23 | Footer line "Every claim links to its source…" + Method link | Dashboard footer | Page footer | Kept, in: Page footer. Checked in the running app. |

## B. My Coverage (becomes a slide-over drawer; every feature stays)

| # | Information or control | Where now | Where it goes | Status |
|---|---|---|---|---|
| B1 | Mandate tab: focus sectors, stages (in focus / follow-on only), ticket size min, max, note, other-sectors switch, Save + confirmation | Sidebar | My Coverage drawer, same tab | Kept, redesigned: Mandate section in My Coverage with sector chips, a three-way choice per stage (Not used / In focus / Follow-on only), $ ticket fields and a save bar that shows unsaved changes. Checked. |
| B2 | Portfolio tab: count, search, sector filter, Add, row (logo, name, tag, sector), Edit drawer, Remove + confirmation, Show more | Sidebar | My Coverage drawer, same tab | Kept, as the Portfolio section: search, sector filter and Add in one toolbar, card rows with edit and remove. Checked. |
| B3 | On Radar tab: same as Portfolio plus priority and the On Radar fields in the edit drawer | Sidebar | My Coverage drawer, same tab | Kept, as the On Radar section, same layout as Portfolio. Checked. |
| B4 | More > Investors (list, add, edit, remove) | Sidebar | My Coverage drawer | Kept, now its own Investors section (no hidden More menu). Checked. |
| B5 | More > Contacts (address book, type, "demo, no real sending" label, add, edit, remove) | Sidebar | My Coverage drawer | Kept, now its own Contacts section. Checked. |
| B6 | More > Settings: family office profile, sender profile, digest settings and limits (recipients + every number), news sources (toggle + feed address + LinkedIn switch), sector keywords; save confirmations | Sidebar | My Coverage drawer | Kept, now the Settings section with the same five groups as cards. Checked. |
| B7 | Footer: Export config, Import config (with error text), Reset to defaults (with confirmation) | Sidebar footer | My Coverage drawer footer | Kept, as a quiet Backup row at the bottom of the panel (Export, Import, Reset with confirmation). Checked. |
| B8 | Collapse / expand the sidebar | Sidebar | Not needed (it is a drawer); the drawer closes | Changed on purpose: it is a slide-over now, so there is nothing to collapse; it closes instead. Checked. |

## C. Data quality strip and KPI tiles

| # | Information or control | Where now | Where it goes | Status |
|---|---|---|---|---|
| C1 | Sources reachable "N of M" with the unreachable list and "searched instead" tooltip | Strip | Slim strip with icon; Tip keeps the full text | Kept, in: Slim strip with icon; Tip keeps the full text. Checked in the running app. |
| C2 | Articles read this week | Strip | Strip | Kept, in: Strip. Checked in the running app. |
| C3 | Deals found (duplicates merged) vs typical 40 to 60 | Strip | Strip | Kept, in: Strip. Checked in the running app. |
| C4 | Amount undisclosed count | Strip | Strip | Kept, in: Strip. Checked in the running app. |
| C5 | Needs review count (link to the list) | Strip | Strip (links to Needs review on Market) | Kept, in: Strip (links to Needs review on Market). Checked in the running app. |
| C6 | Last updated "N minutes ago" | Strip | Strip with the "live" dot | Kept, in: Strip with the "live" dot. Checked in the running app. |
| C7 | Note "Below the typical weekly volume. Possible reasons: …" | Under strip | Under the strip, shown only when below | Kept, shown only when below typical volume. Checked in the code. |
| C8 | KPI Deals + "+N vs the week before" | KPI tile | Hero 2x3 grid | Kept, in: Hero 2x3 grid. Checked in the running app. |
| C9 | KPI Disclosed capital (₹ Cr, $, "N deals undisclosed, not counted") | KPI tile | Hero grid (₹ Cr with $ underneath; undisclosed note in its Tip) | Kept, in: Hero grid (₹ Cr with $ underneath; undisclosed note in its Tip). Checked in the running app. |
| C10 | KPI Top sector (name, $ disclosed, deal count) | KPI tile | Hero grid | Kept, in: Hero grid. Checked in the running app. |
| C11 | KPI Watchlist hits "N +M adjacent" and its explanation line | KPI tile | Hero grid ("8 +3 near") | Kept, in: Hero grid ("8 +3 near"). Checked in the running app. |
| C12 | KPI New investors "new in our records for their sector" | KPI tile | Hero grid ("5 of interest") | Kept, in: Hero grid ("5 of interest"). Checked in the running app. |
| C13 | "What is this?" explanations (what, this week, how it is worked out, where to look, Go to button) for all five tiles | Side drawer | Info-icon Tip on each tile, word for word, with the "Go to" link inside | Kept, moved to the info icon on each tile (hover, keyboard or tap). Checked for all five tiles, plus Focus deals. |
| C14 | Focus deals count (new tile) | n/a | Hero grid; click opens the focus-deal list | Kept, in: Hero grid; click opens the focus-deal list. Checked in the running app. |

## D. Brief content (today: Section 1 and parts of Section 2)

| # | Information or control | Where now | Where it goes | Status |
|---|---|---|---|---|
| D1 | Focus deals list (6) with logo, tag, sector · stage, amount | Section 1 | Focus-deal list drawer, opened from the Focus deals tile | Kept, in: Focus-deal list drawer, opened from the Focus deals tile. Checked in the running app. |
| D2 | Focus deals definition line ("Focus sector and a stage the mandate invests in. Series B+ only when the company is on your lists.") | Section 1 | Top of that drawer | Kept, in: Top of that drawer. Checked in the running app. |
| D3 | Top 3 patterns: question title, one-line answer, mini chart, "Details and sources" link | Section 1 | Three bento cards (Where the money went, Who's heating up, New faces) with "Read the analysis" | Kept, in: Three bento cards (Where the money went, Who's heating up, New faces) with "Read the analysis". Checked in the running app. |
| D4 | Direct hits: logo, name, tag, match reason, stage, amount, needs-review badge, sources | Section 1 | "Your names in the news": top 4 rows; "See all" shows every hit with reason, stage, amount and sources | Kept, in: "Your names in the news": top 4 rows; "See all" shows every hit with reason, stage, amount and sources. Checked in the running app. |
| D5 | Adjacent groups: portfolio company, cluster sentence, shared terms, every adjacent deal with date and sources | Section 1 | Amber cluster alert on top; "See all" shows every group in full | Kept, in: Amber cluster alert on top; "See all" shows every group in full. Checked in the running app. |
| D6 | Empty texts ("No Portfolio or On Radar company was named…", "Nothing was found next to a Portfolio company…") | Section 1 | Same texts | Kept, in: Same texts. Checked in the running app. |
| D7 | Top highlights: rank, company, tag, sector/stage/amount, the one-line sentence, sources, "Show 10 more" | Section 2 | "Deals that fit the mandate": top 5 compact rows, "Show 10 more" opens inline | Kept, in: "Deals that fit the mandate": top 5 compact rows, "Show 10 more" opens inline. Checked in the running app. |
| D8 | Highlight "why" text and the reasons that produced the rank | Section 2 | Row detail (the one-line sentence stays visible) | Kept, in: Row detail (the one-line sentence stays visible). Checked in the running app. |

## E. Market content (today: Section 2)

| # | Information or control | Where now | Where it goes | Status |
|---|---|---|---|---|
| E1 | Question 1 panel: Gemini explanation, chart, note "Light bars are each sector's usual weekly amount", expandable list of undisclosed deals, every Reported/Possible point with sources | Section 2 | Market tab, panel collapsed to headline + chart; "Read the analysis" expands everything | Kept, in: Market tab, panel collapsed to headline + chart; "Read the analysis" expands everything. Checked in the running app. |
| E2 | Question 2 panel: explanation, chart, per-sector status list (Speeding up / Slowing / Steady / Not enough history with counts), "Other sectors to note", points with sources | Section 2 | Same | Kept, in: Same. Checked in the running app. |
| E3 | Question 3 panel: explanation, chart, full new-investor list (10 shown + "+N more", investors of interest first), caveat "'New' means new in our records for that sector, not new to the market", sectors without enough history, points with sources | Section 2 | Same | Kept, in: Same. Checked in the running app. |
| E4 | "Written from a template" banner above the questions | Section 2 | Above the three panels | Kept, above the three panels on Market. Shown only when the AI was unavailable, so checked in the code. |
| E5 | Deal table: search, sector filter, stage filter, list filter (All / Watchlist / Portfolio / On Radar), "Show all sectors" | Section 2 | Market tab: sector chips (dot + count), "Watchlist only" chip, search, stage select, list select, "Show all sectors" | Kept, in: Market tab: sector chips (dot + count), "Watchlist only" chip, search, stage select, list select, "Show all sectors". Checked in the running app. |
| E6 | Grouping by sector with count and disclosed total; focus sectors open, others collapsed | Section 2 | Same (grouped view stays the default) | Kept, in: Same (grouped view stays the default). Checked in the running app. |
| E7 | Row columns: logo, name, tags (On Radar / Portfolio / adjacent / review), stage, ₹ and $, investors, date | Section 2 | Same columns; becomes cards on phones | Kept, in: Same columns; becomes cards on phones. Checked in the running app. |
| E8 | "No deals match these filters" empty state | Section 2 | Same | Kept, in: Same. Checked in the running app. |
| E9 | Needs review list (name as written, closest company, similarity, reason, sources) and "None this week" | Section 2 | Market tab, under the table | Kept, in: Market tab, under the table. Checked in the running app. |
| E10 | Deal drawer: stage + provenance, amount + "As reported", date, lead and other investors (+ new in our records), founders, about, confidence, watchlist match, adjacent to, all sources | Drawer | Same drawer (all sources shown here in full) | Kept, in: Same drawer (all sources shown here in full). Checked in the running app. |

## F. Actions content (today: Section 3)

| # | Information or control | Where now | Where it goes | Status |
|---|---|---|---|---|
| F1 | Founder outreach: why each company was picked | Section 3 | Actions tab, "Founders to meet": line under each name | Kept, in: Actions tab, "Founders to meet": line under each name. Checked in the running app. |
| F2 | Founder name + its source link | Section 3 | Same row / draft drawer | Kept, in: Same row / draft drawer. Checked in the running app. |
| F3 | LinkedIn URL + its source; "Not found" | Section 3 | Row chip "LinkedIn" + full link in the drawer | Kept, in: Row chip "LinkedIn" + full link in the drawer. Checked in the running app. |
| F4 | Email or "Not found" + its source | Section 3 | Row chip "No email" / email in the drawer | Kept, in: Row chip "No email" / email in the drawer. Checked in the running app. |
| F5 | All sources of the company's deal | Section 3 | Row shows 2 chips + "+N" | Kept, in: Row shows 2 chips + "+N". Checked in the running app. |
| F6 | Email draft and LinkedIn note buttons | Section 3 | Click the row to open the draft; Email draft / LinkedIn note tabs in the drawer | Kept, in: Click the row to open the draft; Email draft / LinkedIn note tabs in the drawer. Checked in the running app. |
| F7 | "Check on LinkedIn" search link | Section 3 | Row and drawer | Kept, in: Row and drawer. Checked in the running app. |
| F8 | Portfolio follow-up: tag, Cluster/Adjacent/Named label, explanation, suggested contact + "demo contact" label, sources, Open draft | Section 3 | "Portfolio check-ins" | Kept, in: "Portfolio check-ins". Checked in the running app. |
| F9 | LP brief: key points with source links, Open in Compose | Section 3 | "Note to LPs": draft preview, Review and send, Rewrite warmer, Shorter, plus the key-points list | Kept, in: "Note to LPs": draft preview, Review and send, Rewrite warmer, Shorter, plus the key-points list. Checked in the running app. |
| F10 | "Action items are not built for this week yet" state | Section 3 | Actions tab | Kept. Checked in the code. |
| F11 | Count badge on the Actions tab | n/a | Tab badge | Kept, in: Tab badge. Checked in the running app. |

## G. Drawers and tools

| # | Information or control | Where now | Where it goes | Status |
|---|---|---|---|---|
| G1 | Compose: Include checkboxes, To + address book, Subject, Draft, Send + confirm step, Improve with AI, Send log (status, reason), problem message, Copy note for LinkedIn | Drawer | Same drawer; adds Rewrite warmer and Shorter, streamed text | Kept, in: Same drawer; adds Rewrite warmer and Shorter, streamed text. Checked in the running app. |
| G2 | Ask: question box, stored-data answer with sources, keyword fallback note, "not in the stored data" + labelled web search, web result label | Drawer | Same drawer | Kept, in: Same drawer. Checked in the running app. |
| G3 | LinkedIn paste box (link + text + Read this post) | Inside the Ask drawer | Inside the Ask drawer | Kept, in: Inside the Ask drawer. Checked in the running app. |
| G4 | Share copy fallback, toast messages | Top bar | Same | Kept, in: Same. Checked in the running app. |

## H. Other pages and email

| # | Information or control | Where now | Where it goes | Status |
|---|---|---|---|---|
| H1 | Report page: cover, KPIs, data-quality sentence, focus deals, direct hits, adjacent groups, three questions with charts and points, highlights, all-deals table, needs review, action items, footer; Print button; auto-print | `/report/[week]` | Same content, new fonts, colours and icons | Kept, with the new fonts and colours. Checked in the browser. |
| H2 | Method page: 7 sections (purpose, flow, edge cases with live examples, test results, run log, components map, known limits) | `/method` | Same content, new visual system | Kept, with the new visual system. Checked in the browser. |
| H3 | Digest email: org line, week, KPI line, template note, top highlights with source link, dashboard button, footer; plain-text version | Email | Same content, new look (web-safe serif fallback) | Kept, with a serif week line, new colours and a Georgia fallback. Checked by rendering the email. |
| H4 | Founder, portfolio and LP draft builders | Template + Gemini polish | Rewritten voice (Block 4) | Done in Block 4: new voice, covered by unit tests. |
