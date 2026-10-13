"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Eye, Loader2, Paperclip, Send, Sparkles } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Banner } from "@/components/common/states";
import { ConfirmDialog, Field } from "@/components/common/ui-bits";
import { api, ApiError, fetcher, useConfig } from "@/lib/client/api";
import { streamText } from "@/lib/client/stream";
import { SectionPicker, loadSavedSections, saveSections } from "@/components/deck/section-picker";
import { deckUrl } from "@/lib/deck/url";
import { formatWeekRange } from "@/lib/time";
import type { DeckSectionId } from "@/lib/deck/sections";
import { timeAgo } from "@/lib/format";

export interface ComposeSection {
  id: string;
  label: string;
  text: string;
  on: boolean;
}

export interface ComposeRequest {
  kind: "founder_outreach" | "portfolio_followup" | "lp_brief" | "linkedin" | "other";
  title: string;
  to: string;
  subject: string;
  /** Opening and closing text. Sections are inserted between them. */
  intro: string;
  outro: string;
  sections: ComposeSection[];
  /** Used when there are no sections: the whole draft. */
  body?: string;
  /**
   * The LP note only. The summary deck the email can carry, and how to rebuild the text from the ticked sections.
   * When present, the section ticks (and the attach option) replace the simple "Include" list.
   */
  deck?: { week: string };
  build?: (o: { sections: DeckSectionId[]; attach: boolean }) => string;
  /** Text the user has already edited elsewhere (for example after Rewrite warmer). Used as the starting draft. */
  initialText?: string;
}

interface LogRow {
  id: number;
  recipient: string;
  type: string;
  subject: string | null;
  status: string;
  error: string | null;
  sentAt: string;
}

const build = (r: ComposeRequest, on: Record<string, boolean>) => {
  if (!r.sections.length) return r.body ?? "";
  const mid = r.sections.filter((s) => on[s.id]).map((s) => s.text).join("\n\n");
  return [r.intro, mid, r.outro].filter((x) => x.trim()).join("\n\n");
};

/** One component for every email type: sections, recipient, editable draft, a confirm step and the send log. */
export function ComposeDrawer({ request, onClose }: { request: ComposeRequest | null; onClose: () => void }) {
  return (
    <Sheet open={!!request} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="data-[side=right]:sm:max-w-xl">
        {request ? <ComposeBody key={request.title + request.to} request={request} onClose={onClose} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function ComposeBody({ request, onClose }: { request: ComposeRequest; onClose: () => void }) {
  const { data: cfg } = useConfig();
  const isLinkedIn = request.kind === "linkedin";
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(request.sections.map((s) => [s.id, s.on])));
  const [to, setTo] = useState(request.to);
  const [subject, setSubject] = useState(request.subject);
  const [deckSections, setDeckSections] = useState<DeckSectionId[]>(() => (request.deck ? loadSavedSections() : []));
  const [attach, setAttach] = useState(!!request.deck);
  const [text, setText] = useState(() => request.initialText ?? (request.build ? request.build({ sections: request.deck ? loadSavedSections() : [], attach: !!request.deck }) : build(request, Object.fromEntries(request.sections.map((s) => [s.id, s.on])))));
  const [edited, setEdited] = useState(!!request.initialText);
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<"improve" | "warmer" | "shorter" | null>(null);
  const stop = useRef<() => void>(() => {});
  useEffect(() => () => stop.current(), []);
  const log = useSWR<LogRow[]>("/api/compose/log", fetcher, { revalidateOnFocus: false });

  const rebuild = (next: Record<string, boolean>) => {
    setOn(next);
    if (!edited) setText(build(request, next));
  };
  /** LP note: ticking a section or the attach option rewrites the draft, unless the text has been edited by hand. */
  const rebuildDeck = (nextSections: DeckSectionId[], nextAttach: boolean) => {
    setDeckSections(nextSections);
    setAttach(nextAttach);
    saveSections(nextSections);
    if (!edited && request.build) setText(request.build({ sections: nextSections, attach: nextAttach }));
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied. Paste it into LinkedIn.");
    } catch {
      toast.error("Could not copy. Select the text and copy it by hand.");
    }
  }

  /** One AI call: polish, warmer or shorter. The new text types itself in; the facts are checked on the server. */
  async function rewrite(mode: "improve" | "warmer" | "shorter") {
    setBusy(mode);
    stop.current();
    try {
      const r = await api.post<{ ok: boolean; message?: string; subject?: string; body?: string }>("/api/compose/draft", { subject, body: text, kind: isLinkedIn ? "linkedin" : "email", mode });
      if (r.ok && r.body) {
        if (r.subject) setSubject(r.subject);
        setEdited(true);
        stop.current = streamText(r.body, setText, () => toast.success(mode === "warmer" ? "Rewritten warmer. Please read it before sending." : mode === "shorter" ? "Shortened. Please read it before sending." : "Draft polished. Please read it before sending."));
      } else toast.info(r.message ?? "No change made.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not reach the drafting service.");
    } finally {
      setBusy(null);
    }
  }

  /** Picking a named person from the address book swaps a generic "Hi," for their first name. */
  function pickRecipient(v: string) {
    setTo(v);
    const person = cfg?.stakeholders.find((s) => s.email.toLowerCase() === v.trim().toLowerCase());
    if (person && !person.demo && !edited && /^Hi( there)?,/.test(text)) setText((t) => t.replace(/^Hi( there)?,/, `Hi ${person.name.split(/\s+/)[0]},`));
  }

  async function send() {
    setSending(true);
    setProblem(null);
    try {
      const type = request.kind === "linkedin" ? "other" : request.kind;
      await api.post("/api/compose/send", { to, subject, text, type, confirm: true, ...(request.deck && attach ? { attachDeck: { week: request.deck.week, sections: deckSections } } : {}) });
      toast.success(`Email sent to ${to}`);
      setConfirm(false);
      await log.mutate();
    } catch (e) {
      setConfirm(false);
      setProblem(e instanceof ApiError ? e.message : "The email could not be sent. Please try again.");
      await log.mutate();
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{request.title}</SheetTitle>
        <SheetDescription>{isLinkedIn ? "A short note to paste into LinkedIn. Nothing is sent from here." : "Edit the draft, then confirm to send. Nothing is sent until you confirm."}</SheetDescription>
      </SheetHeader>
      <div className="grid flex-1 content-start gap-4 overflow-y-auto px-4 pb-4">
        {request.deck ? (
          <div className="grid gap-3">
            <SectionPicker value={deckSections} onChange={(v) => rebuildDeck(v, attach && v.length > 0)} showEmailHint compact />
            <p className="text-xs text-muted-foreground">Each section you tick adds a point to the email. The deck carries everything you tick.</p>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm has-[[aria-checked=true]]:border-primary/40 has-[[aria-checked=true]]:bg-accent/40">
              <Checkbox className="mt-0.5" checked={attach} disabled={!deckSections.length} onCheckedChange={(v) => rebuildDeck(deckSections, v === true)} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <Paperclip className="size-3.5" aria-hidden /> Attach the summary deck (PDF)
                </span>
                <span className="block text-xs text-muted-foreground">Week of {formatWeekRange(request.deck.week)}. Built from the sections above when you press Send.</span>
              </span>
              <Button type="button" variant="outline" size="xs" disabled={!deckSections.length} nativeButton={false} render={<a href={deckUrl(request.deck.week, deckSections, { preview: true })} target="_blank" rel="noopener noreferrer" />}>
                <Eye data-icon="inline-start" /> Preview
              </Button>
            </label>
            {edited && request.build ? (
              <Button variant="outline" size="xs" className="w-fit" type="button" onClick={() => { setText(request.build!({ sections: deckSections, attach })); setEdited(false); }}>
                Rebuild draft from these choices
              </Button>
            ) : null}
          </div>
        ) : null}
        {request.sections.length ? (
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-sm font-medium">Include</legend>
            {request.sections.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!on[s.id]} onCheckedChange={(v) => rebuild({ ...on, [s.id]: v === true })} />
                {s.label}
              </label>
            ))}
            {edited ? (
              <Button variant="outline" size="xs" className="w-fit" onClick={() => { setText(build(request, on)); setEdited(false); }}>
                Rebuild draft from these choices
              </Button>
            ) : null}
          </fieldset>
        ) : null}
        {!isLinkedIn ? (
          <>
            <Field label="To" hint="Pick someone from the address book or type an address.">
              {(id) => (
                <>
                  <Input id={id} type="email" list="address-book" value={to} onChange={(e) => pickRecipient(e.target.value)} placeholder="name@company.com" />
                  <datalist id="address-book">
                    {cfg?.stakeholders.map((s) => (
                      <option key={s.id} value={s.email}>
                        {s.name}
                      </option>
                    ))}
                  </datalist>
                </>
              )}
            </Field>
            <Field label="Subject">{(id) => <Input id={id} value={subject} onChange={(e) => setSubject(e.target.value)} />}</Field>
          </>
        ) : null}
        <Field label="Draft" hint={isLinkedIn ? `${text.length} characters` : undefined}>
          {(id) => <Textarea id={id} rows={isLinkedIn ? 6 : 14} value={text} onChange={(e) => { setText(e.target.value); setEdited(true); }} />}
        </Field>
        {problem ? (
          <Banner tone="error" title="This email was not sent">
            {problem}
          </Banner>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {isLinkedIn ? (
            <Button onClick={copy}>
              <Copy data-icon="inline-start" /> Copy note
            </Button>
          ) : (
            <Button onClick={() => (to.trim() && subject.trim() && text.trim() ? setConfirm(true) : setProblem("Please fill in the recipient, subject and draft first."))} disabled={sending}>
              <Send data-icon="inline-start" /> Send…
            </Button>
          )}
          <Button variant="outline" onClick={() => rewrite("warmer")} disabled={!!busy}>
            {busy === "warmer" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />} Rewrite warmer
          </Button>
          <Button variant="outline" onClick={() => rewrite("shorter")} disabled={!!busy}>
            {busy === "shorter" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null} Shorter
          </Button>
          <Button variant="outline" onClick={() => rewrite("improve")} disabled={!!busy}>
            {busy === "improve" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null} Improve with AI
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        {!isLinkedIn ? (
          <section aria-label="Send log" className="mt-2 border-t pt-3">
            <h3 className="mb-2 text-sm font-semibold">Send log</h3>
            {log.data?.length ? (
              <ul className="grid gap-1.5 text-xs">
                {log.data.map((r) => (
                  <li key={r.id} className="rounded-lg bg-muted/50 px-2.5 py-1.5">
                    <span className={r.status === "sent" ? "font-medium text-positive-ink" : "font-medium text-warning-ink"}>{r.status}</span> · {r.recipient} · {r.subject}
                    <span className="block text-muted-foreground">
                      {timeAgo(r.sentAt)}
                      {r.error ? ` · ${r.error}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Nothing sent yet.</p>
            )}
          </section>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Send this email?"
        description={`It will be sent to ${to} with the subject “${subject}”. Emails to addresses outside your address book count toward an hourly limit.`}
        confirmLabel="Send email"
        busy={sending}
        onConfirm={send}
      />
    </>
  );
}
