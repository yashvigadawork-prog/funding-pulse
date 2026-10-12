"use client";

import { useState } from "react";
import { Copy, Send, Sparkles } from "lucide-react";
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
  const [text, setText] = useState(() => build(request, Object.fromEntries(request.sections.map((s) => [s.id, s.on]))));
  const [edited, setEdited] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [improving, setImproving] = useState(false);
  const log = useSWR<LogRow[]>("/api/compose/log", fetcher, { revalidateOnFocus: false });

  const rebuild = (next: Record<string, boolean>) => {
    setOn(next);
    if (!edited) setText(build(request, next));
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied. Paste it into LinkedIn.");
    } catch {
      toast.error("Could not copy. Select the text and copy it by hand.");
    }
  }

  async function improve() {
    setImproving(true);
    try {
      const r = await api.post<{ ok: boolean; message?: string; subject?: string; body?: string }>("/api/compose/draft", { subject, body: text, kind: isLinkedIn ? "linkedin" : "email" });
      if (r.ok && r.body) {
        setText(r.body);
        if (r.subject) setSubject(r.subject);
        setEdited(true);
        toast.success("Draft polished. Please read it before sending.");
      } else toast.info(r.message ?? "No change made.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not reach the drafting service.");
    } finally {
      setImproving(false);
    }
  }

  async function send() {
    setSending(true);
    setProblem(null);
    try {
      const type = request.kind === "linkedin" ? "other" : request.kind;
      await api.post("/api/compose/send", { to, subject, text, type, confirm: true });
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
                  <Input id={id} type="email" list="address-book" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@company.com" />
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
          <Button variant="outline" onClick={improve} disabled={improving}>
            <Sparkles data-icon="inline-start" /> {improving ? "Polishing…" : "Improve with AI"}
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
                    <span className={r.status === "sent" ? "font-medium text-positive" : "font-medium text-warning"}>{r.status}</span> · {r.recipient} · {r.subject}
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
