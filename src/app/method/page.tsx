import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDown, ArrowRight, ExternalLink } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import testResults from "@/generated/test-results.json";
import { COMPONENTS, FLOW, FLOW_TEXT, KNOWN_LIMITS, type FlowNode } from "@/lib/components-map";
import { loadEdgeCases, loadLatestRunLog } from "@/lib/method-data";
import { formatDateTimeIST } from "@/lib/time";
import { hostOf } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Method and checks · Funding Pulse", description: "How Funding Pulse works, how edge cases are handled, and the recorded test results." };

const KIND_STYLE: Record<FlowNode["kind"], string> = {
  source: "border-sector-media/60 bg-sector-media/10",
  code: "border-border bg-card",
  ai: "border-primary/50 bg-primary/10",
  store: "border-sector-climate/60 bg-sector-climate/10",
  output: "border-sector-health/60 bg-sector-health/10",
};
const KIND_LABEL: Record<FlowNode["kind"], string> = { source: "Source", code: "Code", ai: "Gemini", store: "Database", output: "Output" };

function Section({ id, n, title, children }: { id: string; n: number; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 border-t pt-8">
      <h2 id={`${id}-h`} className="mb-4 text-xl font-semibold tracking-tight">
        {n}. {title}
      </h2>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function FlowDiagram() {
  return (
    <div>
      <p className="sr-only">{FLOW_TEXT}</p>
      <ol aria-hidden className="flex flex-col items-stretch gap-1 md:flex-row md:flex-wrap md:items-center">
        {FLOW.map((n, i) => (
          <li key={n.id} className="flex flex-col items-center gap-1 md:flex-row">
            <div className={`w-full rounded-lg border px-3 py-2 text-sm md:w-auto ${KIND_STYLE[n.kind]}`}>
              <p className="font-medium">{n.label}</p>
              <p className="text-xs text-muted-foreground">{n.note}</p>
              <p className="mt-0.5 text-[0.65rem] tracking-wide text-muted-foreground uppercase">{KIND_LABEL[n.kind]}</p>
            </div>
            {i < FLOW.length - 1 ? (
              <>
                <ArrowDown className="size-4 text-muted-foreground md:hidden" />
                <ArrowRight className="hidden size-4 text-muted-foreground md:block" />
              </>
            ) : null}
          </li>
        ))}
      </ol>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted-foreground">Text version of this flow</summary>
        <p className="mt-2">{FLOW_TEXT}</p>
      </details>
    </div>
  );
}

export default async function MethodPage() {
  const [cases, runLog] = await Promise.all([loadEdgeCases(), loadLatestRunLog()]);
  const t = testResults;
  const recorded = new Date(t.recordedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-2 py-4">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/" />}>
          ← Back to the dashboard
        </Button>
        <ThemeToggle />
      </header>
      <h1 className="display text-4xl">Method and checks</h1>
      <p className="mt-2 text-muted-foreground">How Funding Pulse works, what it does when things go wrong, and the evidence that it was tested. Everything on this page is read from the live app.</p>
      <nav aria-label="On this page" className="mt-4 flex flex-wrap gap-2 text-sm">
        {["purpose", "how", "edge", "tests", "run", "map", "limits"].map((id, i) => (
          <a key={id} href={`#${id}`} className="rounded-md bg-secondary px-2.5 py-1 text-secondary-foreground hover:underline">
            {i + 1}. {["What it is for", "How it works", "Edge cases", "Test results", "Latest run", "Components", "Known limits"][i]}
          </a>
        ))}
      </nav>

      <div className="mt-8 grid gap-10">
        <Section id="purpose" n={1} title="What this is for">
          <p>
            Aarav is a venture scout at Cloudburst Ventures, a Bengaluru-based family office that backs early-stage Indian startups. Funding news arrives from dozens of places every week, roughly 40 to 60 announcements, and it is easy to hear about something important only in a board meeting.
          </p>
          <p>Funding Pulse reads the week&rsquo;s funding news and answers three questions, each with sources:</p>
          <ol className="list-decimal pl-6">
            <li>Which sectors are attracting capital?</li>
            <li>Is deal activity speeding up or slowing in the portfolio&rsquo;s spaces?</li>
            <li>Has a new investor started moving in our target sectors?</li>
          </ol>
          <p>It also separates two kinds of alert: a Portfolio or On Radar company named directly, and something that happened next to a Portfolio company.</p>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold">What it deliberately does not do</h3>
            <ul className="mt-2 list-disc pl-5 text-sm">
              <li>It does not give investment advice. It reports and organises public news.</li>
              <li>It does not scrape LinkedIn. LinkedIn content comes only from public web search results and from text a person pastes in.</li>
              <li>It does not guess. A missing amount, founder or email stays “Undisclosed”, “Not found” or “Not reported”.</li>
              <li>It does not let the AI do arithmetic. Every number is computed by code and SQL; the AI only explains numbers it was given, and any number it writes must appear in that data.</li>
            </ul>
          </div>
        </Section>

        <Section id="how" n={2} title="How it works">
          <FlowDiagram />
        </Section>

        <Section id="edge" n={3} title="Edge cases handled, with live examples">
          <p className="text-sm text-muted-foreground">Each example below is a real record from the current database, with its source link. Where none exists right now it says so.</p>
          <ul className="grid gap-3 md:hidden">
            {cases.map((c) => (
              <li key={c.id} className="rounded-xl border bg-card p-4 text-sm">
                <p className="font-semibold">{c.problem}</p>
                <p className="mt-1">{c.behaviour}</p>
                <ExampleView c={c} />
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Edge cases, what the app does, and a live example</caption>
              <thead>
                <tr className="border-b text-left">
                  <th className="w-1/4 py-2 pr-3">What can go wrong</th>
                  <th className="w-1/3 pr-3">What the app does</th>
                  <th>Live example</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id} className="border-b align-top">
                    <th scope="row" className="py-3 pr-3 text-left font-medium">
                      {c.problem}
                    </th>
                    <td className="pr-3">{c.behaviour}</td>
                    <td>
                      <ExampleView c={c} bare />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="tests" n={4} title="Test results">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-2xl font-semibold">
              {t.passed} of {t.total} tests passing{t.failed ? `, ${t.failed} failing` : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              Recorded on {recorded} at commit {t.commit}.
            </p>
          </div>
          <ul className="grid gap-1 text-sm">
            {t.files.map((f) => (
              <li key={f.file} className="flex justify-between gap-3 border-b py-1">
                <code className="text-xs break-all">{f.file}</code>
                <span className={f.failed ? "font-medium text-destructive" : "text-muted-foreground"}>
                  {f.passed}/{f.total}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="run" n={5} title="Latest run log">
          {runLog ? (
            <>
              <p className="text-sm text-muted-foreground">
                Run {runLog.runId} ({runLog.kind}) started {formatDateTimeIST(runLog.startedAt)}.
              </p>
              <ol className="grid gap-2">
                {runLog.steps.map((s, i) => (
                  <li key={i} className="rounded-lg border bg-card p-3 text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {s.step}
                      <span className={`rounded px-1.5 py-0.5 text-xs ${s.status === "ok" ? "bg-positive/15 text-positive-ink" : s.status === "error" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning-ink"}`}>{s.status}</span>
                      <span className="text-xs font-normal text-muted-foreground">{s.seconds !== null ? `${s.seconds} s` : "running"}</span>
                    </p>
                    {s.message ? <p className="mt-1 text-muted-foreground">{s.message}</p> : null}
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No run has been recorded yet.</p>
          )}
        </Section>

        <Section id="map" n={6} title="Components map">
          <FlowDiagram />
          <ul className="grid gap-3 md:hidden">
            {COMPONENTS.map((c) => (
              <li key={c.name} className="rounded-xl border bg-card p-4 text-sm">
                <p className="font-semibold">{c.name}</p>
                <p>{c.purpose}</p>
                <dl className="mt-2 grid gap-1 text-xs text-muted-foreground">
                  <div><dt className="inline font-medium">Inputs: </dt><dd className="inline">{c.inputs}</dd></div>
                  <div><dt className="inline font-medium">Outputs: </dt><dd className="inline">{c.outputs}</dd></div>
                  <div><dt className="inline font-medium">Service: </dt><dd className="inline">{c.service}</dd></div>
                  <div><dt className="inline font-medium">Free-tier limit: </dt><dd className="inline">{c.limit}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-xs">
              <caption className="sr-only">Components, purpose, inputs, outputs, external service and free-tier limit</caption>
              <thead>
                <tr className="border-b text-left">
                  {["Component", "Purpose", "Inputs", "Outputs", "External service", "Free-tier limit"].map((h) => (
                    <th key={h} className="py-2 pr-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPONENTS.map((c) => (
                  <tr key={c.name} className="border-b align-top">
                    <th scope="row" className="py-2 pr-3 text-left font-medium">{c.name}</th>
                    <td className="pr-3">{c.purpose}</td>
                    <td className="pr-3">{c.inputs}</td>
                    <td className="pr-3">{c.outputs}</td>
                    <td className="pr-3">{c.service}</td>
                    <td>{c.limit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="limits" n={7} title="Known limits">
          <ul className="list-disc pl-5 text-sm">
            {KNOWN_LIMITS.map((l) => (
              <li key={l} className="mb-1">{l}</li>
            ))}
          </ul>
        </Section>
      </div>
      <footer className="mt-12 border-t pt-4 text-sm text-muted-foreground">
        <Link href="/" className="underline underline-offset-2">Back to the dashboard</Link>
      </footer>
    </div>
  );
}

function ExampleView({ c, bare }: { c: Awaited<ReturnType<typeof loadEdgeCases>>[number]; bare?: boolean }) {
  if (!c.example) return <p className={`text-muted-foreground ${bare ? "" : "mt-2"}`}>No example in the current data.</p>;
  return (
    <p className={bare ? "" : "mt-2"}>
      <span className="text-muted-foreground">Example: </span>
      {c.example.text}
      {c.example.url ? (
        <>
          {" "}
          <a href={c.example.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2">
            {c.example.outlet || hostOf(c.example.url)} <ExternalLink className="size-3" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </>
      ) : null}
    </p>
  );
}
