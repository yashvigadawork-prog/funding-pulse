/** The parts of the summary deck. Shared by the deck itself, the section picker and the tailored LP email. */
export const DECK_SECTIONS = [
  { id: "glance", label: "The week at a glance", hint: "Headline, key numbers and the eight-week trend", email: true },
  { id: "money", label: "Where the money went", hint: "Capital by sector against a usual week", email: true },
  { id: "momentum", label: "Who's heating up", hint: "Sectors speeding up or slowing against their usual pace", email: true },
  { id: "investors", label: "New faces at the table", hint: "Investors new to our records, by sector", email: true },
  { id: "fit", label: "Deals that fit the mandate", hint: "The top five, with what each company does", email: true },
  { id: "names", label: "Our companies in the news", hint: "Companies we back or follow that were named this week", email: true },
  { id: "nearby", label: "Closer to home", hint: "Raises close to a company we back", email: true },
  { id: "deals", label: "Every deal this week", hint: "The full list, grouped by sector", email: false },
  { id: "review", label: "Names to double-check", hint: "Close name matches that were not counted", email: false },
] as const;

export type DeckSectionId = (typeof DECK_SECTIONS)[number]["id"];

/** Ticked to begin with: everything except the long list and the double-check page. */
export const DEFAULT_DECK_SECTIONS: DeckSectionId[] = ["glance", "money", "momentum", "investors", "fit", "names", "nearby"];

const IDS = new Set<string>(DECK_SECTIONS.map((s) => s.id));

/** Reads a comma-separated list from a web address. Unknown names are ignored; the order is always the deck's own order. */
export function parseSections(raw: string | null | undefined): DeckSectionId[] {
  if (!raw) return DEFAULT_DECK_SECTIONS;
  const wanted = new Set(raw.split(",").map((x) => x.trim()).filter((x) => IDS.has(x)));
  return DECK_SECTIONS.filter((s) => wanted.has(s.id)).map((s) => s.id);
}

export const sectionsParam = (ids: readonly DeckSectionId[]) => ids.join(",");
