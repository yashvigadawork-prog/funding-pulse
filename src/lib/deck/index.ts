import "server-only";
import { HttpError } from "@/lib/api";
import { loadDigestView } from "@/lib/digest-view";
import { formatWeekRange, isValidDay } from "@/lib/time";
import { renderDeckHtml } from "./deck";
import { htmlToPdf } from "./pdf";
import type { DeckSectionId } from "./sections";

async function viewFor(week: string) {
  if (!isValidDay(week)) throw new HttpError(404, "That week was not found.");
  const view = await loadDigestView(week);
  if (!view.digest || view.week !== week) throw new HttpError(404, "There is no digest for that week yet.");
  return view;
}

export const deckFilename = (week: string) => `Funding-Pulse-${formatWeekRange(week).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`;

export async function buildDeckHtml(week: string, sections: DeckSectionId[], preview = false): Promise<string> {
  return renderDeckHtml(await viewFor(week), sections, { preview });
}

export async function buildDeckPdf(week: string, sections: DeckSectionId[]): Promise<{ pdf: Buffer; filename: string }> {
  if (!sections.length) throw new HttpError(400, "Please tick at least one section for the deck.");
  const pdf = await htmlToPdf(renderDeckHtml(await viewFor(week), sections));
  return { pdf, filename: deckFilename(week) };
}
