/**
 * One source of truth for the Components Map. The /method page renders from this file and
 * `npm run gen:components-map` writes COMPONENTS_MAP.md from it, so the two never disagree.
 */
export interface FlowNode {
  id: string;
  label: string;
  kind: "source" | "code" | "ai" | "store" | "output";
  note: string;
}

export const FLOW: FlowNode[] = [
  { id: "sources", label: "Sources", kind: "source", note: "News feeds, outlet pages and web search" },
  { id: "collect", label: "Collect", kind: "code", note: "Reads new articles from the last 7 days" },
  { id: "extract", label: "Extract (Gemini)", kind: "ai", note: "Pulls deals out of article text" },
  { id: "normalise", label: "Normalise", kind: "code", note: "Sectors, stages, amounts in code" },
  { id: "dedupe", label: "Deduplicate", kind: "code", note: "Merges the same deal from several outlets" },
  { id: "match", label: "Match", kind: "code", note: "Against Portfolio and On Radar lists" },
  { id: "compute", label: "Compute (SQL and code)", kind: "code", note: "All statistics, never the AI" },
  { id: "analyse", label: "Analyse (Gemini)", kind: "ai", note: "Explains the computed numbers, with sources" },
  { id: "store", label: "Stored digest", kind: "store", note: "Saved in the database" },
  { id: "dashboard", label: "Dashboard", kind: "output", note: "The public web page" },
  { id: "email", label: "Email", kind: "output", note: "Monday digest through Resend" },
  { id: "scheduler", label: "Scheduler", kind: "output", note: "cron-job.org triggers the run" },
];

export const FLOW_TEXT =
  "Sources feed Collect. Collect passes articles to Extract, which uses Gemini to pull deals out of the text. " +
  "Normalise, Deduplicate and Match then clean the deals in code. Compute works out every statistic with SQL and code. " +
  "Analyse uses Gemini to explain those numbers with source links. The result is saved as a stored digest, which feeds the dashboard and the Monday email. " +
  "The scheduler, cron-job.org, starts the weekly run.";

export interface ComponentRow {
  name: string;
  purpose: string;
  inputs: string;
  outputs: string;
  service: string;
  limit: string;
}

export const COMPONENTS: ComponentRow[] = [
  { name: "Source collector", purpose: "Finds feeds, reads new funding articles, fetches article text", inputs: "Outlet list (editable), look-back days", outputs: "Articles table", service: "Public news sites (RSS and web pages)", limit: "None. Requests are polite, with timeouts and size caps" },
  { name: "Search chain", purpose: "One search function that tries providers in order and caches results for 24 hours", inputs: "Query, options", outputs: "Title, link, snippet, date", service: "Tavily, Exa, Serper, Gemini grounding", limit: "Tavily about 1,000 credits a month; the others vary, check each provider" },
  { name: "Extractor", purpose: "Turns article text into structured deals (company, stage, amount as written, investors)", inputs: "Article text, sector and stage lists", outputs: "Raw deals stored on each article", service: "Gemini Flash (gemini-3.8-flash)", limit: "Free tier is small and shared per project; batch size is configurable" },
  { name: "Normaliser", purpose: "Maps sectors by whole-word keywords, stages to the list, amounts to USD and INR with the configured rate", inputs: "Raw deals, taxonomy, USD to INR rate", outputs: "Clean deals", service: "None (code)", limit: "None" },
  { name: "Deduplicator", purpose: "Merges the same company, round and near dates across outlets; keeps every link and any amount range", inputs: "Clean deals, stored deals", outputs: "Unique deals with sources", service: "None (code)", limit: "None" },
  { name: "Matcher", purpose: "Matches deals to Portfolio and On Radar names, with context words for ambiguous names and a review flag for near misses", inputs: "Company name, nearby text, company lists", outputs: "Tag, reason, score, review flag", service: "None (code)", limit: "None" },
  { name: "Statistics engine", purpose: "Capital per sector, speeding up or slowing, new investors in our records, focus deals", inputs: "Stored deals, thresholds from settings", outputs: "Numbers for the digest", service: "None (SQL and code)", limit: "None" },
  { name: "Adjacency finder", purpose: "Spots deals in the same space as a Portfolio company and flags clusters", inputs: "Deals in a 10-day window, Portfolio descriptions", outputs: "Adjacent groups with shared terms", service: "None (code)", limit: "None" },
  { name: "Analyst", purpose: "Writes short explanations of the computed numbers, labelled Reported or Possible, each with sources", inputs: "Computed numbers, deal rows", outputs: "Highlights ranking and three explanations", service: "Gemini Flash", limit: "Shares the Gemini free-tier quota. Falls back to a template" },
  { name: "Digest store", purpose: "Keeps every week's digest so past weeks show as they were", inputs: "Computed and written results", outputs: "Digest rows", service: "Neon Postgres (Singapore)", limit: "Free tier has a small storage cap; check Neon's current limits" },
  { name: "My Coverage", purpose: "Edit mandate, Portfolio, On Radar, investors, contacts and every setting without a redeploy", inputs: "Forms", outputs: "Saved configuration with an edit log", service: "Neon Postgres", limit: "None" },
  { name: "Dashboard", purpose: "KPI strip, data quality strip, sections 1 to 3, drawers and charts", inputs: "Stored digest", outputs: "Web page", service: "Vercel (Next.js)", limit: "Hobby plan limits; functions up to 300 seconds" },
  { name: "Refresh now", purpose: "Runs the pipeline on demand, one run at a time, with a cooldown, and shows progress", inputs: "Button press", outputs: "Run log rows", service: "Vercel function plus Neon", limit: "Cooldown set in settings" },
  { name: "Scheduler", purpose: "Starts the weekly run every Monday with a secret key", inputs: "Time", outputs: "A call to the digest endpoint", service: "cron-job.org", limit: "Free plan is enough for one weekly job" },
  { name: "Email sender", purpose: "Sends the digest and Compose emails with safeguards (demo blocks, daily cap, send log)", inputs: "Digest or draft, recipient", outputs: "Email and a send log", service: "Resend", limit: "Free plan about 100 emails a day; without a verified domain only the account owner's address works" },
  { name: "Compose drawer", purpose: "One place to edit and confirm every email type", inputs: "Draft, recipient", outputs: "Sent email or a copied LinkedIn note", service: "Resend (through the sender)", limit: "Per-visitor hourly limit for new addresses" },
  { name: "Founder contact finder", purpose: "Finds a founder, public LinkedIn link and a published email, each with its source. Never guesses", inputs: "Company, domain", outputs: "Founder, link, email or Not found", service: "Search chain and the company's own website", limit: "Uses search queries from the run budget" },
  { name: "Ask drawer", purpose: "Answers questions only from stored data, with links; offers a labelled web search if not found", inputs: "Question", outputs: "Answer and sources", service: "Gemini Flash", limit: "Per-visitor hourly limit and a daily cap" },
  { name: "Paste box", purpose: "Reads a public post (for example from LinkedIn) that a person pastes in, with its link, as if it were an article", inputs: "Post text and link", outputs: "Deals added to the stored data", service: "Gemini Flash", limit: "Shares the per-visitor hourly limit and daily cap. Nothing is fetched from LinkedIn" },
  { name: "PDF report", purpose: "Print-styled page, one section per page, charts included", inputs: "Stored digest", outputs: "Browser print dialog or PDF", service: "None (browser)", limit: "None" },
  { name: "Rate limiter and run lock", purpose: "Protects public endpoints and allows one run at a time", inputs: "Caller id (hashed)", outputs: "Allow or refuse", service: "Neon Postgres", limit: "None" },
  { name: "Method page", purpose: "Shows how it works, edge cases with live examples, recorded test results and the latest run log", inputs: "Database, test results file", outputs: "Public page", service: "Vercel", limit: "None" },
];

export const KNOWN_LIMITS: string[] = [
  "Free tiers are small. Gemini, search providers and email each have daily or monthly caps, so a very busy week can leave some articles waiting for the next refresh.",
  "On Radar entries come from a single source each and should be verified before relying on a figure.",
  "LinkedIn coverage is partial: only public posts that normal web search returns, plus anything pasted in. Nothing is scraped from LinkedIn.",
  "The USD to INR rate is a configured approximation, not a live market rate.",
  "Weekly deal counts depend on which outlets could be reached; a quiet number can mean missing coverage, not a quiet market.",
  "Founder emails are only shown when published on the company's own site, so many will say Not found.",
  "Sector and stage labels come from the article text and keyword rules; some deals will land in Other or Unknown.",
];
