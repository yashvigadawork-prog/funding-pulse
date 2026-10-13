"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowRight, ExternalLink, Handshake, Link2, Loader2, Mail, Send, Sparkles, UsersRound, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/common/states";
import { BentoCard, Chip, InitialsAvatar } from "@/components/brief/bento";
import { linkedinSearchUrl } from "@/components/actions/linkedin-link";
import { api, ApiError, useConfig } from "@/lib/client/api";
import { buildLpEmail } from "@/lib/deck/email";
import { DEFAULT_DECK_SECTIONS } from "@/lib/deck/sections";
import { streamText } from "@/lib/client/stream";
import { hostOf } from "@/lib/format";
import { SourceChips, SourceLinks } from "@/components/dashboard/deal-bits";
import type { ComposeRequest } from "@/components/dashboard/compose-drawer";
import type { ActionsBlock, FollowUp, FounderLead } from "@/lib/actions/types";
import type { DigestView } from "@/lib/view-types";

const REASON: Record<FollowUp["reason"], string> = { named: "Named in the news", cluster: "Cluster nearby", adjacent: "Adjacent deal" };

function FoundLine({ label, value, href, source }: { label: string; value: string | null; href?: string | null; source: string | null }) {
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

function FounderDrawer({ lead, onClose, onCompose }: { lead: FounderLead | null; onClose: () => void; onCompose: (r: ComposeRequest) => void }) {
  return (
    <Sheet open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="data-[side=right]:sm:max-w-lg">
        {lead ? (
          <>
            <SheetHeader>
              <SheetTitle className="flex flex-wrap items-center gap-2">
                {lead.company}
                {lead.tag ? <Chip tone={lead.tag === "On Radar" ? "amber" : "primary"}>{lead.tag}</Chip> : null}
              </SheetTitle>
              <SheetDescription>{lead.why}</SheetDescription>
            </SheetHeader>
            <div className="grid gap-5 overflow-y-auto px-4 pb-6">
              <div className="grid gap-1.5 rounded-xl border bg-card p-3">
                <FoundLine label="Founder" value={lead.founder} source={lead.founderSource} />
                <FoundLine label="LinkedIn" value={lead.linkedinUrl} href={lead.linkedinUrl} source={lead.linkedinSource} />
                <FoundLine label="Email" value={lead.email} href={lead.email ? `mailto:${lead.email}` : null} source={lead.emailSource} />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Sources</p>
                <SourceLinks sources={lead.sources} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => { onClose(); onCompose({ kind: "founder_outreach", title: `Email to ${lead.founder ?? lead.company}`, to: lead.email ?? "", subject: lead.emailDraft.subject, intro: "", outro: "", sections: [], body: lead.emailDraft.body }); }}>
                  <Mail data-icon="inline-start" /> Email draft
                </Button>
                <Button variant="outline" onClick={() => { onClose(); onCompose({ kind: "linkedin", title: `LinkedIn note for ${lead.founder ?? lead.company}`, to: "", subject: "", intro: "", outro: "", sections: [], body: lead.linkedinDraft }); }}>
                  <Link2 data-icon="inline-start" /> LinkedIn note
                </Button>
                <Button variant="outline" nativeButton={false} render={<a href={linkedinSearchUrl(lead)} target="_blank" rel="noopener noreferrer" />}>
                  <ExternalLink data-icon="inline-start" /> Check on LinkedIn
                  <span className="sr-only">(opens a LinkedIn search in a new tab)</span>
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function FounderRow({ lead, onOpen }: { lead: FounderLead; onOpen: (l: FounderLead) => void }) {
  return (
    <li>
      <div onClick={() => onOpen(lead)} className="group flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/70">
        <InitialsAvatar name={lead.company} sectorVar="var(--primary)" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(lead); }} className="rounded text-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
              {lead.company}
            </button>
            {lead.tag ? <Chip tone={lead.tag === "On Radar" ? "amber" : "primary"}>{lead.tag}</Chip> : null}
            <span className="text-xs text-muted-foreground">{lead.founder ?? "Founder not found"}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{lead.why}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Chip tone={lead.found.linkedin ? "teal" : "neutral"}>{lead.found.linkedin ? "LinkedIn" : "No LinkedIn"}</Chip>
            <Chip tone={lead.found.email ? "teal" : "neutral"}>{lead.found.email ? "Email found" : "No email"}</Chip>
            <SourceChips sources={lead.sources} />
          </div>
        </div>
        <ArrowRight aria-hidden className="mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-[3px]" />
      </div>
    </li>
  );
}

function CheckInRow({ f, onCompose }: { f: FollowUp; onCompose: (r: ComposeRequest) => void }) {
  return (
    <li className="rounded-xl border bg-background/50 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-medium">{f.company}</span>
        <Chip tone="primary">Portfolio</Chip>
        <Chip tone={f.reason === "named" ? "teal" : "amber"}>{REASON[f.reason]}</Chip>
      </div>
      <p className="mt-1 text-sm text-ink-2">{f.headline}</p>
      <p className="mt-1.5 text-xs">
        <span className="text-muted-foreground">Suggested contact: </span>
        {f.stakeholder ? (
          <>
            {f.stakeholder.name} <span className="text-muted-foreground">({f.stakeholder.role || f.stakeholder.type})</span>
            {f.stakeholder.demo ? <span className="ml-1 text-muted-foreground">demo contact, no real sending</span> : null}
          </>
        ) : (
          <span className="text-muted-foreground">None in the address book. Add one under My Coverage, More.</span>
        )}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <SourceChips sources={f.sources} />
        <Button size="sm" className="ml-auto" onClick={() => onCompose({ kind: "portfolio_followup", title: `Follow-up on ${f.company}`, to: f.stakeholder?.email ?? "", subject: f.draft.subject, intro: "", outro: "", sections: [], body: f.draft.body })}>
          <Mail data-icon="inline-start" /> Open draft
        </Button>
      </div>
    </li>
  );
}

/** The draft without its old dashboard link, for the moment before the sender profile has loaded. */
const withoutLink = (body: string) => body.split("\n\n").filter((p) => !/full (brief|report)/i.test(p)).join("\n\n");

function LpCard({ lp, view, onCompose }: { lp: NonNullable<ActionsBlock["lpBrief"]>; view: DigestView; onCompose: (r: ComposeRequest) => void }) {
  const { data: cfg } = useConfig();
  const recipientName = cfg?.stakeholders.find((x) => x.type === "LP" && !x.demo)?.name ?? null;
  const built = useMemo(() => (cfg ? buildLpEmail({ view, sections: DEFAULT_DECK_SECTIONS, attach: true, sender: cfg.sender_profile, recipientName }) : null), [cfg, view, recipientName]);
  const [subjectEdit, setSubject] = useState<string | null>(null);
  const [bodyEdit, setBody] = useState<string | null>(null);
  const subject = subjectEdit ?? built?.subject ?? lp.draft.subject;
  const body = bodyEdit ?? built?.body ?? withoutLink(lp.draft.body);
  const [busy, setBusy] = useState<"warmer" | "shorter" | null>(null);
  const stop = useRef<() => void>(() => {});
  /** Opens the drawer where sections are ticked and the deck is attached. Text already rewritten here is kept. */
  const review = () => {
    if (!cfg || !view.week) return;
    const sender = cfg.sender_profile;
    onCompose({
      kind: "lp_brief",
      title: "LP brief",
      to: "",
      subject,
      intro: "",
      outro: "",
      sections: [],
      deck: { week: view.week },
      build: ({ sections, attach }) => buildLpEmail({ view, sections, attach, sender, recipientName }).body,
      initialText: bodyEdit ?? undefined,
    });
  };
  async function rewrite(kind: "warmer" | "shorter") {
    setBusy(kind);
    stop.current();
    try {
      const r = await api.post<{ ok: boolean; message?: string; subject?: string; body?: string }>("/api/compose/draft", {
        subject,
        body,
        kind: "email",
        mode: kind,
      });
      if (r.ok && r.body) {
        if (r.subject) setSubject(r.subject);
        stop.current = streamText(r.body, setBody, () => toast.success(kind === "warmer" ? "Rewritten warmer. Please read it before sending." : "Shortened. Please read it before sending."));
      } else toast.info(r.message ?? "No change made.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not rewrite the note.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <BentoCard id="lp-note" icon={Send} tone="teal" title="Note to LPs" index={2}>
      <p className="text-sm text-muted-foreground">A short note with up to three points. When you review it you can tick which sections to include and attach the summary deck as a PDF.</p>
      <div className="mt-3 rounded-xl border bg-background/60 p-4">
        <p className="text-xs font-medium text-muted-foreground">Subject</p>
        <p className="text-sm font-semibold">{subject}</p>
        <pre className="mt-3 max-h-80 overflow-y-auto font-sans text-[13.5px] leading-relaxed whitespace-pre-wrap text-ink-2" aria-live="polite">{body}</pre>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={review} disabled={!cfg}>
          <Send data-icon="inline-start" /> Review and send
        </Button>
        <Button variant="outline" disabled={!!busy} onClick={() => rewrite("warmer")}>
          {busy === "warmer" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />} Rewrite warmer
        </Button>
        <Button variant="outline" disabled={!!busy} onClick={() => rewrite("shorter")}>
          {busy === "shorter" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Wand2 data-icon="inline-start" />} Shorter
        </Button>
      </div>
      {lp.keyPoints.length ? (
        <div className="mt-4 border-t pt-3">
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Key points</p>
          <ul className="grid gap-1.5 text-sm">
            {lp.keyPoints.map((p, i) => (
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
        </div>
      ) : null}
    </BentoCard>
  );
}

export function ActionsTab({ view, onCompose }: { view: DigestView; onCompose: (r: ComposeRequest) => void }) {
  const a = view.digest?.actions as Partial<ActionsBlock> | undefined;
  const [lead, setLead] = useState<FounderLead | null>(null);
  if (!a?.founderOutreach) {
    return <EmptyState title="Action items are not built for this week yet">They are created when a refresh finishes for the current week. Past weeks that were loaded as history do not have them.</EmptyState>;
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <div className="grid gap-4">
        <BentoCard id="founders" icon={UsersRound} tone="primary" title="Founders to meet" index={0}>
          <p className="mb-2 text-xs text-muted-foreground">Five companies from this week&rsquo;s focus deals and your On Radar list. Contacts come only from public search results or pages we fetched, each with its source. Nothing is guessed.</p>
          {a.founderOutreach.length ? <ul className="grid grid-cols-[minmax(0,1fr)]">{a.founderOutreach.map((l) => <FounderRow key={l.company} lead={l} onOpen={setLead} />)}</ul> : <p className="text-sm text-muted-foreground">No outreach candidates this week.</p>}
        </BentoCard>
        <BentoCard id="checkins" icon={Handshake} tone="amber" title="Portfolio check-ins" index={1}>
          <p className="mb-2 text-xs text-muted-foreground">Portfolio companies named in the news, or with something raising nearby.</p>
          {a.portfolioFollowUp?.length ? <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5">{a.portfolioFollowUp.map((f) => <CheckInRow key={f.companyId} f={f} onCompose={onCompose} />)}</ul> : <p className="rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">Nothing to follow up this week. No Portfolio company was named, and nothing raised next to one.</p>}
        </BentoCard>
      </div>
      <div className="grid gap-4">{a.lpBrief ? <LpCard lp={a.lpBrief} view={view} onCompose={onCompose} /> : null}</div>
      <FounderDrawer lead={lead} onClose={() => setLead(null)} onCompose={onCompose} />
    </div>
  );
}
