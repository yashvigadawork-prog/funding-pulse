import type { FounderLead } from "@/lib/actions/types";

/** A plain LinkedIn search address. It opens in the person's own browser and login; the app never calls LinkedIn. */
export function linkedinSearchUrl(lead: Pick<FounderLead, "founder" | "company">): string {
  const keywords = lead.founder ? `${lead.founder} ${lead.company}` : `${lead.company} founder`;
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
}
