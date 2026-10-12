"use client";

import { ExternalLink, Link2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/states";
import { CompanyLogo, TagBadge } from "@/components/common/ui-bits";
import type { ActionsBlock, FollowUp, FounderLead } from "@/lib/actions/types";
import { SourceLinks } from "./deal-bits";
import type { ComposeRequest } from "./compose-drawer";
import { hostOf } from "@/lib/format";
import type { DigestView } from "@/lib/view-types";

function Found({ label, value, href, source }: { label: string; value: string | null; href?: string | null; source: string | null }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
      <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
      {value ? (
        <>
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline-offset-2 hover:underline">
              {value}
            </a>
          ) : (
            <span className="break-all">{value}</span>
          )}
          {source ? (
            <a href={source} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground underline underline-offset-2">
              source: {hostOf(source)}
            </a>
          ) : null}
        </>
      ) : (
        <span className="text-muted-foreground">Not found</span>
      )}
    </div>
  );
}

/** A plain LinkedIn search address. It opens in the person's own browser and login; the app never calls LinkedIn. */
export function linkedinSearchUrl(lead: Pick<FounderLead, "founder" | "company">): string {
  const keywords = lead.founder ? `${lead.founder} ${lead.company}` : `${lead.company} founder`;
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
}

function OutreachCard({ lead, onCompose }: { lead: FounderLead; onCompose: (r: ComposeRequest) => void }) {
  return (
    <li className="fp-fade-in rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <CompanyLogo name={lead.company} domain={lead.domain} size={32} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 font-medium">
            {lead.company} {lead.tag ? <TagBadge tag={lead.tag} /> : null}
          </p>
          <p className="text-xs text-muted-foreground">{lead.why}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-1.5">
        <Found label="Founder" value={lead.founder} source={lead.founderSource} />
        <Found label="LinkedIn" value={lead.linkedinUrl} href={lead.linkedinUrl} source={lead.linkedinSource} />
        <Found label="Email" value={lead.email} href={lead.email ? `mailto:${lead.email}` : null} source={lead.emailSource} />
      </div>
      {lead.sources.length ? <SourceLinks sources={lead.sources} className="mt-3" /> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => onCompose({ kind: "founder_outreach", title: `Email to ${lead.founder ?? lead.company}`, to: lead.email ?? "", subject: lead.emailDraft.subject, intro: "", outro: "", sections: [], body: lead.emailDraft.body })}
        >
          <Mail data-icon="inline-start" /> Email draft
        </Button>
        <Button size="sm" variant="outline" onClick={() => onCompose({ kind: "linkedin", title: `LinkedIn note for ${lead.founder ?? lead.company}`, to: "", subject: "", intro: "", outro: "", sections: [], body: lead.linkedinDraft })}>
          <Link2 data-icon="inline-start" /> LinkedIn note
        </Button>
        <Button size="sm" variant="outline" nativeButton={false} render={<a href={linkedinSearchUrl(lead)} target="_blank" rel="noopener noreferrer" />}>
          <ExternalLink data-icon="inline-start" /> Check on LinkedIn
          <span className="sr-only">(opens a LinkedIn search in a new tab)</span>
        </Button>
      </div>
    </li>
  );
}

const REASON: Record<FollowUp["reason"], string> = { named: "Named in the news", cluster: "Cluster nearby", adjacent: "Adjacent deal" };

function FollowUpCard({ f, onCompose }: { f: FollowUp; onCompose: (r: ComposeRequest) => void }) {
  return (
    <li className="fp-fade-in rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <CompanyLogo name={f.company} domain={f.domain} size={32} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 font-medium">
            {f.company} <TagBadge tag="Portfolio" />
            <span className="rounded bg-accent px-1.5 py-0.5 text-[0.68rem] text-accent-foreground">{REASON[f.reason]}</span>
          </p>
          <p className="text-sm text-muted-foreground">{f.headline}</p>
        </div>
      </div>
      <p className="mt-2 text-sm">
        <span className="text-xs text-muted-foreground">Suggested contact: </span>
        {f.stakeholder ? (
          <>
            {f.stakeholder.name} <span className="text-muted-foreground">({f.stakeholder.role || f.stakeholder.type})</span>
            {f.stakeholder.demo ? <span className="ml-1 text-xs text-muted-foreground">demo contact, no real sending</span> : null}
          </>
        ) : (
          <span className="text-muted-foreground">None in the address book. Add one under My Coverage, More.</span>
        )}
      </p>
      {f.sources.length ? <SourceLinks sources={f.sources} className="mt-3" /> : null}
      <Button size="sm" className="mt-3" onClick={() => onCompose({ kind: "portfolio_followup", title: `Follow-up on ${f.company}`, to: f.stakeholder?.email ?? "", subject: f.draft.subject, intro: "", outro: "", sections: [], body: f.draft.body })}>
        <Mail data-icon="inline-start" /> Open draft
      </Button>
    </li>
  );
}

export function Section3({ view, onCompose }: { view: DigestView; onCompose: (r: ComposeRequest) => void }) {
  const a = view.digest?.actions as Partial<ActionsBlock> | undefined;
  const built = !!a?.founderOutreach;
  return (
    <section aria-labelledby="s3" className="grid gap-8">
      <h2 id="s3" className="text-xl font-semibold tracking-tight">
        Action items
      </h2>
      {!built ? (
        <EmptyState title="Action items are not built for this week yet">They are created when a refresh finishes for the current week. Past weeks that were loaded as history do not have them.</EmptyState>
      ) : (
        <>
          <div>
            <h3 className="text-base font-semibold">Founder outreach</h3>
            <p className="mb-3 text-sm text-muted-foreground">Five companies from this week&rsquo;s focus deals and your On Radar list. Contacts come only from public search results or pages we fetched, each with its source. Nothing is guessed.</p>
            {a!.founderOutreach!.length ? (
              <ul className="grid gap-3 md:grid-cols-2">{a!.founderOutreach!.map((l) => <OutreachCard key={l.company} lead={l} onCompose={onCompose} />)}</ul>
            ) : (
              <EmptyState title="No outreach candidates this week" />
            )}
          </div>
          <div>
            <h3 className="text-base font-semibold">Portfolio follow-up</h3>
            <p className="mb-3 text-sm text-muted-foreground">Portfolio companies named in the news, or with something raising nearby.</p>
            {a!.portfolioFollowUp!.length ? (
              <ul className="grid gap-3 md:grid-cols-2">{a!.portfolioFollowUp!.map((f) => <FollowUpCard key={f.companyId} f={f} onCompose={onCompose} />)}</ul>
            ) : (
              <EmptyState title="Nothing to follow up this week">No Portfolio company was named, and nothing raised next to one.</EmptyState>
            )}
          </div>
          {a!.lpBrief ? (
            <div>
              <h3 className="text-base font-semibold">LP brief</h3>
              <div className="mt-2 rounded-xl border bg-card p-4">
                <p className="text-sm text-muted-foreground">A draft email with key points and a link to the report page.</p>
                <ul className="mt-2 grid gap-1 text-sm">
                  {a!.lpBrief.keyPoints.map((p, i) => (
                    <li key={i}>
                      {p.text}
                      {p.url ? (
                        <>
                          {" "}
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline underline-offset-2">
                            source
                          </a>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    const lp = a!.lpBrief!;
                    const body = lp.draft.body;
                    const parts = body.split("\n\n");
                    // First paragraphs become the intro; sections the user can switch on or off sit in between.
                    const keyIdx = parts.findIndex((p) => p.startsWith("Key points:"));
                    const nearIdx = parts.findIndex((p) => p.startsWith("Near our portfolio:"));
                    const linkIdx = parts.findIndex((p) => p.startsWith("Full report with sources"));
                    const intro = parts.slice(0, keyIdx >= 0 ? keyIdx : 2).join("\n\n");
                    const sections = [
                      { id: "points", label: "Key points with sources", text: keyIdx >= 0 ? parts[keyIdx] : "", on: true },
                      { id: "adjacent", label: "Near our portfolio", text: nearIdx >= 0 ? parts[nearIdx] : "", on: nearIdx >= 0 },
                      { id: "link", label: "Link to the full report", text: linkIdx >= 0 ? parts[linkIdx] : "", on: true },
                    ];
                    onCompose({ kind: "lp_brief", title: "LP brief", to: "", subject: lp.draft.subject, intro: intro, outro: parts[parts.length - 1], sections: sections.filter((s) => s.text) });
                  }}
                >
                  <Mail data-icon="inline-start" /> Open in Compose
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
