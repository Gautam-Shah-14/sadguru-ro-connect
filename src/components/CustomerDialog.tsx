import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  formatIN,
  serviceDates,
  SERVICE_LABELS,
  type Customer,
  type ServiceKey,
} from "@/lib/store";

export function CustomerDialog({
  open,
  value,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  value: Customer | null;
  onOpenChange: (open: boolean) => void;
  onSave: (customer: Customer) => void;
}) {
  const [draft, setDraft] = useState<Customer | null>(value);

  useEffect(() => setDraft(value), [value]);

  if (!draft) return null;
  const dates = serviceDates(draft);
  const set = (patch: Partial<Customer>) => setDraft({ ...draft, ...patch });
  const isExisting = !!value?.createdAt;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isExisting ? "Edit customer" : "New customer entry"}</DialogTitle>
          <DialogDescription>
            Service dates are calculated automatically at 4, 8 and 12 months from the selling date.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Customer ID">
            <Input
              value={draft.id}
              disabled={isExisting}
              placeholder="e.g. SG-001 · leave blank to auto-generate"
              onChange={(e) => set({ id: e.target.value.trim() })}
            />
          </Field>
          <Field label="Customer name">
            <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="WhatsApp number">
            <Input
              value={draft.phone}
              placeholder="+91 98765 43210"
              onChange={(e) => set({ phone: e.target.value })}
            />
          </Field>
          <Field label="Address" className="col-span-2">
            <Input value={draft.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <Field label="City / Area">
            <Input value={draft.city} onChange={(e) => set({ city: e.target.value })} />
          </Field>
          <Field label="Product / Model">
            <Input value={draft.product} onChange={(e) => set({ product: e.target.value })} />
          </Field>
          <Field label="Serial number">
            <Input value={draft.serialNo} onChange={(e) => set({ serialNo: e.target.value })} />
          </Field>
          <Field label="Selling date">
            <Input
              type="date"
              value={draft.sellingDate}
              onChange={(e) => set({ sellingDate: e.target.value })}
            />
          </Field>
          <Field label="Amount (₹)">
            <Input
              type="number"
              value={draft.amount || ""}
              onChange={(e) => set({ amount: Number(e.target.value) })}
            />
          </Field>
          <Field label="Notes" className="col-span-2">
            <Textarea
              rows={2}
              value={draft.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </Field>
        </div>

        <div className="rounded-lg border border-border bg-muted/50 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Estimated servicing schedule
          </p>
          <div className="grid grid-cols-3 gap-3">
            {(Object.keys(dates) as ServiceKey[]).map((key) => (
              <label key={key} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 accent-[var(--primary)]"
                  checked={draft.done[key]}
                  onChange={(e) => set({ done: { ...draft.done, [key]: e.target.checked } })}
                />
                <span>
                  <span className="block text-xs text-muted-foreground">{SERVICE_LABELS[key]}</span>
                  <span className="font-medium">{formatIN(dates[key])}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(draft)} disabled={!draft.name.trim()}>
            Save customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
