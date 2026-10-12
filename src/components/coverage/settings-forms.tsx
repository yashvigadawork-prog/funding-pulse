"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/client/api";
import type { ConfigResponse } from "@/lib/client/types";
import type { ConfigBlock, DigestSettings, FundProfile, SenderProfile, Sources, Taxonomy } from "@/lib/config/schema";
import { ChipsInput, Field, NativeSelect, SaveBar } from "@/components/common/ui-bits";

function Section({ title, children, defaultOpen }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group rounded-2xl border bg-card" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="grid gap-4 border-t px-4 py-4">{children}</div>
    </details>
  );
}

/** Shared save logic: every settings block saves to the database and confirms clearly. */
function useBlockSave<T>(block: ConfigBlock, value: T, onChanged: () => void, label: string) {
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.put(`/api/config/${block}`, value);
      setSavedAt(new Date());
      toast.success(`${label} saved`);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }
  return { saving, savedAt, error, save };
}

type Props = { config: ConfigResponse; onChanged: () => void };

function FundProfileForm({ config, onChanged }: Props) {
  const [v, setV] = useState<FundProfile>(() => structuredClone(config.fund_profile));
  const s = useBlockSave("fund_profile", v, onChanged, "Profile");
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return (
    <Section title="Family office profile">
      <Field label="Name">{(id) => <Input id={id} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">{(id) => <Input id={id} value={v.type ?? ""} onChange={(e) => setV({ ...v, type: e.target.value })} placeholder="Family office" />}</Field>
        <Field label="Location">{(id) => <Input id={id} value={v.location ?? ""} onChange={(e) => setV({ ...v, location: e.target.value })} placeholder="Bengaluru, India" />}</Field>
      </div>
      <Field label="Tagline">{(id) => <Input id={id} value={v.tagline} onChange={(e) => setV({ ...v, tagline: e.target.value })} />}</Field>
      <Field label="Time zone" hint="Weeks run Monday to Sunday in this zone.">
        {(id) => <Input id={id} value={v.timezone} onChange={(e) => setV({ ...v, timezone: e.target.value })} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Digest day">
          {(id) => <NativeSelect id={id} value={v.digest_day} onChange={(x) => setV({ ...v, digest_day: x })} options={days.map((d) => ({ value: d, label: d }))} />}
        </Field>
        <Field label="Digest time">
          {(id) => <Input id={id} type="time" value={v.digest_time} onChange={(e) => setV({ ...v, digest_time: e.target.value })} />}
        </Field>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">The day and time are for display. The real schedule is set in cron-job.org.</p>
      <Field label="Currencies shown" hint="For example: INR crore, USD">
        {(id) => <ChipsInput id={id} value={v.display_currency} onChange={(x) => setV({ ...v, display_currency: x })} />}
      </Field>
      <Field label="USD to INR rate" hint="Used for every conversion. Change it here, nothing is hard-coded.">
        {(id) => <Input id={id} type="number" step="0.01" min="1" value={v.usd_inr_rate} onChange={(e) => setV({ ...v, usd_inr_rate: Number(e.target.value) })} />}
      </Field>
      <SaveBar {...s} onSave={s.save} />
    </Section>
  );
}

function SenderForm({ config, onChanged }: Props) {
  const [v, setV] = useState<SenderProfile>(() => structuredClone(config.sender_profile));
  const s = useBlockSave("sender_profile", v, onChanged, "Sender profile");
  return (
    <Section title="Sender profile (used in drafts)">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name">{(id) => <Input id={id} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}</Field>
        <Field label="Title">{(id) => <Input id={id} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />}</Field>
      </div>
      <Field label="Organisation">{(id) => <Input id={id} value={v.organisation} onChange={(e) => setV({ ...v, organisation: e.target.value })} />}</Field>
      <Field label="Intro line">{(id) => <Textarea id={id} rows={2} value={v.intro_line} onChange={(e) => setV({ ...v, intro_line: e.target.value })} />}</Field>
      <Field label="Tone for outreach">{(id) => <Textarea id={id} rows={2} value={v.outreach_tone} onChange={(e) => setV({ ...v, outreach_tone: e.target.value })} />}</Field>
      <SaveBar {...s} onSave={s.save} />
    </Section>
  );
}

const NUMBER_FIELDS: { key: keyof DigestSettings; label: string; hint?: string; step?: string }[] = [
  { key: "lookback_days", label: "Look back (days)", hint: "How far back each run collects news." },
  { key: "highlights_top", label: "Highlights shown first" },
  { key: "highlights_total", label: "Highlights when expanded" },
  { key: "backfill_weeks", label: "History to backfill (weeks)" },
  { key: "baseline_weeks", label: "Baseline length (weeks)", hint: "Weeks averaged to judge speeding up or slowing." },
  { key: "acceleration_ratio", label: "Speeding-up ratio", hint: "This week must be at least this many times the average.", step: "0.05" },
  { key: "slowing_ratio", label: "Slowing ratio", hint: "This week at most this many times the average.", step: "0.05" },
  { key: "min_baseline_deals", label: "Minimum baseline deals", hint: "Below this, we say 'not enough history'." },
  { key: "min_extra_deals", label: "Minimum extra deals", hint: "Extra deals needed on top of the ratio." },
  { key: "fuzzy_match_review_threshold", label: "Close-match review level (0 to 1)", step: "0.01" },
  { key: "daily_send_cap", label: "Emails allowed per day" },
  { key: "send_per_ip_per_hour", label: "Emails per visitor per hour (other addresses)" },
  { key: "refresh_cooldown_minutes", label: "Refresh cooldown (minutes)" },
  { key: "ask_per_ip_per_hour", label: "Ask and draft requests per visitor per hour" },
  { key: "ask_daily_cap", label: "Ask and draft requests per day (all visitors)" },
  { key: "search_cache_hours", label: "Keep search results (hours)" },
  { key: "max_search_queries_per_run", label: "Search queries per run" },
  { key: "extraction_batch_size", label: "Articles per AI call" },
  { key: "max_articles_per_run", label: "Articles per run" },
  { key: "max_article_chars", label: "Article text kept (characters)" },
  { key: "typical_weekly_volume_min", label: "Typical weekly deals, low end", hint: "Used only for the data quality note." },
  { key: "typical_weekly_volume_max", label: "Typical weekly deals, high end" },
  { key: "adjacency_window_days", label: "Adjacent-deal window (days)", hint: "How far back to look for deals near a Portfolio company." },
  { key: "adjacency_min_shared_terms", label: "Shared words needed to call a deal adjacent" },
  { key: "adjacency_cluster_min_companies", label: "Companies needed to flag a cluster" },
];

function DigestSettingsForm({ config, onChanged }: Props) {
  const [v, setV] = useState<DigestSettings>(() => structuredClone(config.digest_settings));
  const [recipients, setRecipients] = useState(() => config.digest_settings.recipients.join("\n"));
  const payload = { ...v, recipients: recipients.split(/[\s,;]+/).filter(Boolean) };
  const s = useBlockSave("digest_settings", payload, onChanged, "Digest settings");
  return (
    <Section title="Digest settings and limits">
      <Field label="Digest recipients" hint="One email address per line. The Monday digest goes to these addresses.">
        {(id) => <Textarea id={id} rows={3} value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="name@example.org" />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {NUMBER_FIELDS.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            {(id) => (
              <Input
                id={id}
                type="number"
                step={f.step ?? "1"}
                min="0"
                value={String(v[f.key] ?? "")}
                onChange={(e) => setV({ ...v, [f.key]: e.target.value === "" ? 0 : Number(e.target.value) })}
              />
            )}
          </Field>
        ))}
      </div>
      <SaveBar {...s} onSave={s.save} />
    </Section>
  );
}

function SourcesForm({ config, onChanged }: Props) {
  const [v, setV] = useState<Sources>(() => structuredClone(config.sources));
  const s = useBlockSave("sources", v, onChanged, "Sources");
  const patch = (i: number, p: Partial<Sources["rss_and_sites"][number]>) =>
    setV((cur) => ({ ...cur, rss_and_sites: cur.rss_and_sites.map((x, j) => (j === i ? { ...x, ...p } : x)) }));
  return (
    <Section title="News sources">
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
        {v.rss_and_sites.map((src, i) => (
          <li key={src.outlet} className="grid gap-1.5 rounded-lg border px-2.5 py-2">
            <label className="flex items-center justify-between gap-2 text-sm font-medium">
              <span>
                {src.outlet} <span className="font-normal text-muted-foreground">· {src.site}</span>
              </span>
              <Switch size="sm" checked={src.enabled} onCheckedChange={(on) => patch(i, { enabled: on })} aria-label={`Use ${src.outlet}`} />
            </label>
            <Input
              aria-label={`${src.outlet} feed address`}
              placeholder="Feed address (found automatically if empty)"
              value={src.feed_url ?? ""}
              onChange={(e) => patch(i, { feed_url: e.target.value.trim() || null })}
            />
          </li>
        ))}
      </ul>
      <label className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm">
        <span>
          <span className="block font-medium">Look for LinkedIn posts through search</span>
          <span className="block text-xs text-muted-foreground">Public posts only, found through normal web search. Nothing is scraped from LinkedIn.</span>
        </span>
        <Switch
          checked={v.linkedin_via_search.enabled}
          onCheckedChange={(on) => setV({ ...v, linkedin_via_search: { ...v.linkedin_via_search, enabled: on } })}
          aria-label="LinkedIn through search"
        />
      </label>
      <SaveBar {...s} onSave={s.save} />
    </Section>
  );
}

function TaxonomyForm({ config, onChanged }: Props) {
  const [v, setV] = useState<Taxonomy>(() => structuredClone(config.taxonomy));
  const s = useBlockSave("taxonomy", v, onChanged, "Sector keywords");
  return (
    <Section title="Sector keywords">
      <p className="text-xs text-muted-foreground">Used to place a deal in a sector when the AI does not say. Whole words only, so &ldquo;ev&rdquo; never matches inside &ldquo;even&rdquo;.</p>
      {Object.entries(v.sectors)
        .filter(([sector]) => sector !== "Other")
        .map(([sector, words]) => (
          <Field key={sector} label={sector}>
            {(id) => <ChipsInput id={id} value={words} onChange={(w) => setV({ ...v, sectors: { ...v.sectors, [sector]: w } })} />}
          </Field>
        ))}
      <SaveBar {...s} onSave={s.save} />
    </Section>
  );
}

export function SettingsForms(props: Props) {
  return (
    <div className="grid gap-2.5">
      <FundProfileForm {...props} />
      <SenderForm {...props} />
      <DigestSettingsForm {...props} />
      <SourcesForm {...props} />
      <TaxonomyForm {...props} />
    </div>
  );
}
