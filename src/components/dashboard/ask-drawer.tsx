"use client";

import { useState } from "react";
import { Globe, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Banner } from "@/components/common/states";
import { api, ApiError } from "@/lib/client/api";
import { SourceLinks } from "./deal-bits";

interface Stored {
  found: boolean;
  answer: string;
  sources: { url: string; outlet: string | null }[];
  mode: "ai" | "keyword";
  note?: string;
}
interface Web {
  answer: string;
  sources: { url: string; outlet: string | null }[];
  provider: string | null;
  message?: string;
}

/** Answers only from stored data. If the answer is not there, offers a clearly labelled web search. */
export function AskDrawer() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState("");
  const [busy, setBusy] = useState(false);
  const [stored, setStored] = useState<Stored | null>(null);
  const [web, setWeb] = useState<Web | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function ask() {
    if (q.trim().length < 3) return setErr("Please type a question.");
    setBusy(true);
    setErr(null);
    setStored(null);
    setWeb(null);
    setAsked(q.trim());
    try {
      setStored(await api.post<Stored>("/api/ask", { question: q.trim() }));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not get an answer. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function searchWeb() {
    setBusy(true);
    setErr(null);
    try {
      setWeb(await api.post<Web>("/api/ask/web", { question: asked }));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "The web search failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button className="fixed right-4 bottom-4 z-30 shadow-lg no-print" size="lg" />}>
        <MessageCircleQuestion data-icon="inline-start" /> Ask
      </SheetTrigger>
      <SheetContent className="data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Ask about the stored data</SheetTitle>
          <SheetDescription>Answers come only from the deals and digests saved in this app, each with its source links.</SheetDescription>
        </SheetHeader>
        <div className="grid flex-1 content-start gap-4 overflow-y-auto px-4 pb-6">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
          >
            <Input aria-label="Your question" value={q} maxLength={300} onChange={(e) => setQ(e.target.value)} placeholder="For example: what did Peak XV invest in?" />
            <Button type="submit" disabled={busy}>
              {busy ? "…" : "Ask"}
            </Button>
          </form>
          {err ? <Banner tone="error">{err}</Banner> : null}
          {stored?.found ? (
            <div className="rounded-xl border bg-card p-4" aria-live="polite">
              <p className="text-xs font-medium text-muted-foreground">From stored data</p>
              <p className="mt-1 text-sm">{stored.answer}</p>
              {stored.note ? <p className="mt-2 text-xs text-muted-foreground">{stored.note}</p> : null}
              <SourceLinks sources={stored.sources} className="mt-3" />
            </div>
          ) : null}
          {stored && !stored.found ? (
            <div className="rounded-xl border border-dashed p-4 text-sm" aria-live="polite">
              <p className="font-medium">That is not in the stored data.</p>
              <p className="mt-1 text-muted-foreground">I will not guess. You can run a live web search instead. Its result is not from the stored data.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={searchWeb} disabled={busy}>
                <Globe data-icon="inline-start" /> Search the web
              </Button>
            </div>
          ) : null}
          {web ? (
            <div className="rounded-xl border border-warning/40 bg-warning/5 p-4" aria-live="polite">
              <p className="text-xs font-medium text-warning">Web search result{web.provider ? ` (via ${web.provider})` : ""}. Not from the stored data.</p>
              <p className="mt-1 text-sm">{web.answer || web.message}</p>
              <SourceLinks sources={web.sources} className="mt-3" />
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
