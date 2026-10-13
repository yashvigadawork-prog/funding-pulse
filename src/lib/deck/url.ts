import { sectionsParam, type DeckSectionId } from "./sections";

/** The address of the summary deck: the PDF by default, the on-screen preview with `preview`, a forced download with `download`. */
export function deckUrl(week: string, sections: readonly DeckSectionId[], opts: { preview?: boolean; download?: boolean } = {}): string {
  const q = new URLSearchParams({ sections: sectionsParam(sections) });
  if (opts.preview) q.set("format", "html");
  if (opts.download) q.set("dl", "1");
  return `/api/deck/${week}?${q.toString()}`;
}
