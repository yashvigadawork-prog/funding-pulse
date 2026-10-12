# Redesign inventory: nothing gets lost

This list was written **before** any layout change. Every piece of information or control that exists today has one row: where it lives now, and where it goes in the new design. The last column is filled in at the end of the redesign ("kept, moved to X"), after checking it in the running app.

Layout words used below:
- **Brief / Market / Actions** are the three tabs. **Method** opens the Method page.
- **Drawer** = a slide-in panel. **Tip** = an info-icon tooltip (hover, keyboard focus or tap).
- "Hidden by default" means collapsed behind "See all", "Read the analysis", a tab or a drawer, never removed.

## A. Top bar, shell and page-level states

| # | Information or control | Where now | Where it goes | Status |
|---|---|---|---|---|
| A1 | Name + subtitle (family office, location) | Top bar | Top bar brand: "Funding Pulse" (serif) + "Cloudburst Ventures · Bengaluru family office" | |
| A2 | Week picker with "(latest digest)" / "(in progress)" labels | Top bar | Top bar | |
| A3 | Refresh now button + "Cooling down: try again in N minutes" text | Top bar | Top bar (primary button), cooldown text kept beside it | |
| A4 | Share (copy link, with fallback) | Top bar | Top bar icon button | |
| A5 | Download PDF | Top bar | Top bar icon button | |
| A6 | Method link | Top bar + page footer | Top-bar tab "Method" + page footer | |
| A7 | Theme toggle (crossfade) | Top bar | Top bar icon button | |
| A8 | My Coverage (permanent left column; mobile button) | Left column / mobile drawer | Top-bar "My Coverage" button, opens a slide-over drawer | |
| A9 | Skip to content link | Layout | Layout | |
| A10 | Ask button | Floating button | Floating button (desktop), bottom tab "Ask" (phone) | |
| A11 | Tab in the URL, back button | n/a (new) | `?tab=brief|market|actions` | |
| A12 | State: no digest yet ("No digest has been built yet" + Refresh) | Dashboard | Dashboard (same text) | |
| A13 | State: no digest for this week + "Go to the latest digest" | Dashboard | Dashboard (same text) | |
| A14 | State: week with no deals ("No deals were recorded for this week") | Dashboard | Brief and Market tabs | |
| A15 | Banner: data older than 8 days | Under title | Banner area under the data strip | |
| A16 | Banner: live search unavailable (+ "Showing stored data from …") | Under title | Banner area | |
| A17 | Banner: partial run ("Some articles are still waiting… Press Refresh again") | Under title | Banner area | |
| A18 | Banner: written from a template (AI unavailable) / plain summary for older weeks | Section 2 | Above the three questions (Market) and on the hero (Brief) | |
| A19 | Banner: could not refresh the page + Retry | Top of page | Top of page | |
| A20 | Failed load with Retry button, loading skeleton, error page, not-found page | Dashboard / app | Same, with skeletons shaped like the new cards | |
| A21 | Refresh stepper (Collecting, Extracting, Matching, Analysing, Done, with messages, hide button) | Under title | Under the top bar while running and after a run | |
| A22 | Page title "Funding Pulse" + "Week of … Emailed to the digest list." | Top of dashboard | Hero eyebrow / data strip | |
| A23 | Footer line "Every claim links to its source…" + Method link | Dashboard footer | Page footer | |

## B. My Coverage (becomes a slide-over drawer; every feature stays)

| # | Information or control | Where now | Where it goes | Status |
|---|---|---|---|---|
| B1 | Mandate tab: focus sectors, stages (in focus / follow-on only), ticket size min, max, note, other-sectors switch, Save + confirmation | Sidebar | My Coverage drawer, same tab | |
| B2 | Portfolio tab: count, search, sector filter, Add, row (logo, name, tag, sector), Edit drawer, Remove + confirmation, Show more | Sidebar | My Coverage drawer, same tab | |
| B3 | On Radar tab: same as Portfolio plus priority and the On Radar fields in the edit drawer | Sidebar | My Coverage drawer, same tab | |
| B4 | More > Investors (list, add, edit, remove) | Sidebar | My Coverage drawer | |
| B5 | More > Contacts (address book, type, "demo, no real sending" label, add, edit, remove) | Sidebar | My Coverage drawer | |
| B6 | More > Settings: family office profile, sender profile, digest settings and limits (recipients + every number), news sources (toggle + feed address + LinkedIn switch), sector keywords; save confirmations | Sidebar | My Coverage drawer | |
| B7 | Footer: Export config, Import config (with error text), Reset to defaults (with confirmation) | Sidebar footer | My Coverage drawer footer | |
| B8 | Collapse / expand the sidebar | Sidebar | Not needed (it is a drawer); the drawer closes | |

## C. Data quality strip and KPI tiles

| # | Information or control | Where now | Where it goes | Status |
|---|---|---|---|---|
| C1 | Sources reachable "N of M" with the unreachable list and "searched instead" tooltip | Strip | Slim strip with icon; Tip keeps the full text | |
| C2 | Articles read this week | Strip | Strip | |
| C3 | Deals found (duplicates merged) vs typical 40 to 60 | Strip | Strip | |
| C4 | Amount undisclosed count | Strip | Strip | |
| C5 | Needs review count (link to the list) | Strip | Strip (links to Needs review on Market) | |
| C6 | Last updated "N minutes ago" | Strip | Strip with the "live" dot | |
| C7 | Note "Below the typical weekly volume. Possible reasons: …" | Under strip | Under the strip, shown only when below | |
| C8 | KPI Deals + "+N vs the week before" | KPI tile | Hero 2x3 grid | |
| C9 | KPI Disclosed capital (₹ Cr, $, "N deals undisclosed, not counted") | KPI tile | Hero grid (₹ Cr with $ underneath; undisclosed note in its Tip) | |
| C10 | KPI Top sector (name, $ disclosed, deal count) | KPI tile | Hero grid | |
| C11 | KPI Watchlist hits "N +M adjacent" and its explanation line | KPI tile | Hero grid ("8 +3 near") | |
| C12 | KPI New investors "new in our records for their sector" | KPI tile | Hero grid ("5 of interest") | |
| C13 | "What is this?" explanations (what, this week, how it is worked out, where to look, Go to button) for all five tiles | Side drawer | Info-icon Tip on each tile, word for word, with the "Go to" link inside | |
| C14 | Focus deals count (new tile) | n/a | Hero grid; click opens the focus-deal list | |

## D. Brief content (today: Section 1 and parts of Section 2)

| # | Information or control | Where now | Where it goes | Status |
|---|---|---|---|---|
| D1 | Focus deals list (6) with logo, tag, sector · stage, amount | Section 1 | Focus-deal list drawer, opened from the Focus deals tile | |
| D2 | Focus deals definition line ("Focus sector and a stage the mandate invests in. Series B+ only when the company is on your lists.") | Section 1 | Top of that drawer | |
| D3 | Top 3 patterns: question title, one-line answer, mini chart, "Details and sources" link | Section 1 | Three bento cards (Where the money went, Who's heating up, New faces) with "Read the analysis" | |
| D4 | Direct hits: logo, name, tag, match reason, stage, amount, needs-review badge, sources | Section 1 | "Your names in the news": top 4 rows; "See all" shows every hit with reason, stage, amount and sources | |
| D5 | Adjacent groups: portfolio company, cluster sentence, shared terms, every adjacent deal with date and sources | Section 1 | Amber cluster alert on top; "See all" shows every group in full | |
| D6 | Empty texts ("No Portfolio or On Radar company was named…", "Nothing was found next to a Portfolio company…") | Section 1 | Same texts | |
| D7 | Top highlights: rank, company, tag, sector/stage/amount, the one-line sentence, sources, "Show 10 more" | Section 2 | "Deals that fit the mandate": top 5 compact rows, "Show 10 more" opens inline | |
| D8 | Highlight "why" text and the reasons that produced the rank | Section 2 | Row detail (the one-line sentence stays visible) | |

## E. Market content (today: Section 2)

| # | Information or control | Where now | Where it goes | Status |
|---|---|---|---|---|
| E1 | Question 1 panel: Gemini explanation, chart, note "Light bars are each sector's usual weekly amount", expandable list of undisclosed deals, every Reported/Possible point with sources | Section 2 | Market tab, panel collapsed to headline + chart; "Read the analysis" expands everything | |
| E2 | Question 2 panel: explanation, chart, per-sector status list (Speeding up / Slowing / Steady / Not enough history with counts), "Other sectors to note", points with sources | Section 2 | Same | |
| E3 | Question 3 panel: explanation, chart, full new-investor list (10 shown + "+N more", investors of interest first), caveat "'New' means new in our records for that sector, not new to the market", sectors without enough history, points with sources | Section 2 | Same | |
| E4 | "Written from a template" banner above the questions | Section 2 | Above the three panels | |
| E5 | Deal table: search, sector filter, stage filter, list filter (All / Watchlist / Portfolio / On Radar), "Show all sectors" | Section 2 | Market tab: sector chips (dot + count), "Watchlist only" chip, search, stage select, list select, "Show all sectors" | |
| E6 | Grouping by sector with count and disclosed total; focus sectors open, others collapsed | Section 2 | Same (grouped view stays the default) | |
| E7 | Row columns: logo, name, tags (On Radar / Portfolio / adjacent / review), stage, ₹ and $, investors, date | Section 2 | Same columns; becomes cards on phones | |
| E8 | "No deals match these filters" empty state | Section 2 | Same | |
| E9 | Needs review list (name as written, closest company, similarity, reason, sources) and "None this week" | Section 2 | Market tab, under the table | |
| E10 | Deal drawer: stage + provenance, amount + "As reported", date, lead and other investors (+ new in our records), founders, about, confidence, watchlist match, adjacent to, all sources | Drawer | Same drawer (all sources shown here in full) | |

## F. Actions content (today: Section 3)

| # | Information or control | Where now | Where it goes | Status |
|---|---|---|---|---|
| F1 | Founder outreach: why each company was picked | Section 3 | Actions tab, "Founders to meet": line under each name | |
| F2 | Founder name + its source link | Section 3 | Same row / draft drawer | |
| F3 | LinkedIn URL + its source; "Not found" | Section 3 | Row chip "LinkedIn" + full link in the drawer | |
| F4 | Email or "Not found" + its source | Section 3 | Row chip "No email" / email in the drawer | |
| F5 | All sources of the company's deal | Section 3 | Row shows 2 chips + "+N" | |
| F6 | Email draft and LinkedIn note buttons | Section 3 | Click the row to open the draft; Email draft / LinkedIn note tabs in the drawer | |
| F7 | "Check on LinkedIn" search link | Section 3 | Row and drawer | |
| F8 | Portfolio follow-up: tag, Cluster/Adjacent/Named label, explanation, suggested contact + "demo contact" label, sources, Open draft | Section 3 | "Portfolio check-ins" | |
| F9 | LP brief: key points with source links, Open in Compose | Section 3 | "Note to LPs": draft preview, Review and send, Rewrite warmer, Shorter, plus the key-points list | |
| F10 | "Action items are not built for this week yet" state | Section 3 | Actions tab | |
| F11 | Count badge on the Actions tab | n/a | Tab badge | |

## G. Drawers and tools

| # | Information or control | Where now | Where it goes | Status |
|---|---|---|---|---|
| G1 | Compose: Include checkboxes, To + address book, Subject, Draft, Send + confirm step, Improve with AI, Send log (status, reason), problem message, Copy note for LinkedIn | Drawer | Same drawer; adds Rewrite warmer and Shorter, streamed text | |
| G2 | Ask: question box, stored-data answer with sources, keyword fallback note, "not in the stored data" + labelled web search, web result label | Drawer | Same drawer | |
| G3 | LinkedIn paste box (link + text + Read this post) | Inside the Ask drawer | Inside the Ask drawer | |
| G4 | Share copy fallback, toast messages | Top bar | Same | |

## H. Other pages and email

| # | Information or control | Where now | Where it goes | Status |
|---|---|---|---|---|
| H1 | Report page: cover, KPIs, data-quality sentence, focus deals, direct hits, adjacent groups, three questions with charts and points, highlights, all-deals table, needs review, action items, footer; Print button; auto-print | `/report/[week]` | Same content, new fonts, colours and icons | |
| H2 | Method page: 7 sections (purpose, flow, edge cases with live examples, test results, run log, components map, known limits) | `/method` | Same content, new visual system | |
| H3 | Digest email: org line, week, KPI line, template note, top highlights with source link, dashboard button, footer; plain-text version | Email | Same content, new look (web-safe serif fallback) | |
| H4 | Founder, portfolio and LP draft builders | Template + Gemini polish | Rewritten voice (Block 4) | |
