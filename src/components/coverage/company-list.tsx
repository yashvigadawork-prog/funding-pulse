"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/client/api";
import type { ConfigResponse } from "@/lib/client/types";
import type { CompanyJson } from "@/lib/config/schema";
import { CompanyLogo, ConfirmDialog, NativeSelect, SectorDot, TagBadge } from "@/components/common/ui-bits";
import { CompanyDrawer } from "./company-drawer";

const PAGE = 50;

export function CompanyList({
  tag,
  config,
  onChanged,
}: {
  tag: "Portfolio" | "On Radar";
  config: ConfigResponse;
  onChanged: () => void;
}) {
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("all");
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<{ company: CompanyJson | null; nonce: number } | null>(null);
  const [removing, setRemoving] = useState<CompanyJson | null>(null);
  const [busy, setBusy] = useState(false);

  const all = useMemo(() => config.companies.filter((c) => c.tag === tag), [config.companies, tag]);
  const sectors = Object.keys(config.taxonomy.sectors);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (c) =>
        (sector === "all" || c.sector === sector) &&
        (!needle || c.name.toLowerCase().includes(needle) || c.aliases.some((a) => a.toLowerCase().includes(needle)) || (c.domain ?? "").includes(needle)),
    );
  }, [all, q, sector]);
  const shown = filtered.slice(0, limit);

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await api.del(`/api/companies/${removing.id}`);
      toast.success(`Removed ${removing.name}`);
      setRemoving(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not remove it");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {filtered.length === all.length ? `${all.length} companies` : `${filtered.length} of ${all.length} companies`}
        </p>
        <Button size="sm" onClick={() => setEditing({ company: null, nonce: Date.now() })}>
          <Plus data-icon="inline-start" /> Add
        </Button>
      </div>
      <div className="grid gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input
            aria-label={`Search ${tag} companies`}
            placeholder="Search by name"
            className="pl-8"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
          />
        </div>
        <NativeSelect
          ariaLabel="Filter by sector"
          value={sector}
          onChange={(v) => {
            setSector(v);
            setLimit(PAGE);
          }}
          options={[{ value: "all", label: "All sectors" }, ...sectors.map((s) => ({ value: s, label: s }))]}
        />
      </div>
      <ul className="grid gap-1">
        {shown.map((c, i) => (
          <li
            key={c.id}
            className="fp-fade-in group flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-muted/70"
            style={{ animationDelay: `${Math.min(i, 12) * 18}ms` }}
          >
            <CompanyLogo name={c.name} domain={c.domain} />
            <button
              type="button"
              className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              onClick={() => setEditing({ company: c, nonce: Date.now() })}
            >
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium">{c.name}</span>
                <TagBadge tag={c.tag} />
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <SectorDot sector={c.sector} />
                <span className="truncate">{c.sector}</span>
                {c.tag === "On Radar" && c.priority ? <span>· {c.priority} priority</span> : null}
              </span>
            </button>
            <div className="flex shrink-0 gap-0.5">
              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.name}`} onClick={() => setEditing({ company: c, nonce: Date.now() })}>
                <Pencil />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${c.name}`} onClick={() => setRemoving(c)}>
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {!filtered.length ? <p className="py-6 text-center text-sm text-muted-foreground">No companies match.</p> : null}
      {filtered.length > limit ? (
        <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
          Show {Math.min(PAGE, filtered.length - limit)} more
        </Button>
      ) : null}

      {editing ? (
        <CompanyDrawer
          key={editing.nonce}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          company={editing.company}
          defaultTag={tag}
          config={config}
          onSaved={onChanged}
        />
      ) : null}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.name ?? ""}?`}
        description="It will no longer be matched against news. You can add it again later, or use Reset to defaults to bring back the original list."
        confirmLabel="Remove"
        destructive
        busy={busy}
        onConfirm={remove}
      />
    </div>
  );
}
