"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api, ApiError } from "@/lib/client/api";
import type { ConfigResponse } from "@/lib/client/types";
import { ConfirmDialog, Field, NativeSelect } from "@/components/common/ui-bits";

type Investor = ConfigResponse["investors"][number];
type Stakeholder = ConfigResponse["stakeholders"][number];

export function InvestorsList({ config, onChanged }: { config: ConfigResponse; onChanged: () => void }) {
  const [edit, setEdit] = useState<{ item: Investor | null; nonce: number } | null>(null);
  const [remove, setRemove] = useState<Investor | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{config.investors.length} investors we watch</p>
        <Button size="sm" onClick={() => setEdit({ item: null, nonce: Date.now() })}>
          <Plus data-icon="inline-start" /> Add
        </Button>
      </div>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
        {config.investors.map((i) => (
          <li key={i.id} className="flex items-start gap-3 rounded-xl border bg-card px-3 py-2 transition-colors hover:border-ring/40">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{i.name}</p>
              {i.note ? <p className="text-xs text-muted-foreground">{i.note}</p> : null}
            </div>
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${i.name}`} onClick={() => setEdit({ item: i, nonce: Date.now() })}>
              <Pencil />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${i.name}`} onClick={() => setRemove(i)}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      {edit ? <InvestorSheet key={edit.nonce} item={edit.item} onClose={() => setEdit(null)} onSaved={onChanged} /> : null}
      <ConfirmDialog
        open={!!remove}
        onOpenChange={(o) => !o && setRemove(null)}
        title={`Remove ${remove?.name ?? ""}?`}
        description="It will no longer be treated as an investor of interest."
        confirmLabel="Remove"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (!remove) return;
          setBusy(true);
          try {
            await api.del(`/api/investors/${remove.id}`);
            toast.success(`Removed ${remove.name}`);
            setRemove(null);
            onChanged();
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : "Could not remove");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

function InvestorSheet({ item, onClose, onSaved }: { item: Investor | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const body = { name, note: note || null };
      if (item) await api.put(`/api/investors/${item.id}`, body);
      else await api.post("/api/investors", body);
      toast.success("Investor saved");
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{item ? "Edit investor" : "Add an investor"}</SheetTitle>
          <SheetDescription>New entries by these investors are highlighted in the weekly view.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4">
          <Field label="Name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Note">{(id) => <Textarea id={id} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
        </div>
        <SheetFooter className="border-t">
          {err ? <p role="alert" className="text-sm font-medium text-destructive">{err}</p> : null}
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

const TYPE_LABEL: Record<string, string> = { LP: "Limited partner", IC: "Investment committee", portfolio_founder: "Portfolio founder" };

export function StakeholdersList({ config, onChanged }: { config: ConfigResponse; onChanged: () => void }) {
  const [edit, setEdit] = useState<{ item: Stakeholder | null; nonce: number } | null>(null);
  const [remove, setRemove] = useState<Stakeholder | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{config.stakeholders.length} contacts</p>
        <Button size="sm" onClick={() => setEdit({ item: null, nonce: Date.now() })}>
          <Plus data-icon="inline-start" /> Add
        </Button>
      </div>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
        {config.stakeholders.map((s) => (
          <li key={s.id} className="flex items-start gap-3 rounded-xl border bg-card px-3 py-2 transition-colors hover:border-ring/40">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {s.name}
                {s.demo ? <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[0.68rem] font-normal text-muted-foreground">demo, no real sending</span> : null}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {TYPE_LABEL[s.type] ?? s.type} · {s.email}
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${s.name}`} onClick={() => setEdit({ item: s, nonce: Date.now() })}>
              <Pencil />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${s.name}`} onClick={() => setRemove(s)}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      {edit ? <StakeholderSheet key={edit.nonce} item={edit.item} onClose={() => setEdit(null)} onSaved={onChanged} /> : null}
      <ConfirmDialog
        open={!!remove}
        onOpenChange={(o) => !o && setRemove(null)}
        title={`Remove ${remove?.name ?? ""}?`}
        description="They will be removed from the address book."
        confirmLabel="Remove"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (!remove) return;
          setBusy(true);
          try {
            await api.del(`/api/stakeholders/${remove.id}`);
            toast.success(`Removed ${remove.name}`);
            setRemove(null);
            onChanged();
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : "Could not remove");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

function StakeholderSheet({ item, onClose, onSaved }: { item: Stakeholder | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name ?? "");
  const [role, setRole] = useState(item?.role ?? "");
  const [type, setType] = useState<string>(item?.type ?? "LP");
  const [email, setEmail] = useState(item?.email ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const body = { name, role, type, email, demo: item?.demo ?? false };
      if (item) await api.put(`/api/stakeholders/${item.id}`, body);
      else await api.post("/api/stakeholders", body);
      toast.success("Contact saved");
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{item ? "Edit contact" : "Add a contact"}</SheetTitle>
          <SheetDescription>Addresses ending in example.com are treated as demo contacts and are never emailed.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4">
          <Field label="Name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Role">{(id) => <Input id={id} value={role} onChange={(e) => setRole(e.target.value)} />}</Field>
          <Field label="Type">
            {(id) => (
              <NativeSelect
                id={id}
                value={type}
                onChange={setType}
                options={[
                  { value: "LP", label: "Limited partner" },
                  { value: "IC", label: "Investment committee" },
                  { value: "portfolio_founder", label: "Portfolio founder" },
                ]}
              />
            )}
          </Field>
          <Field label="Email">{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        </div>
        <SheetFooter className="border-t">
          {err ? <p role="alert" className="text-sm font-medium text-destructive">{err}</p> : null}
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
