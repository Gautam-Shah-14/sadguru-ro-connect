import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { IMPORT_FIELD_LABELS, type ExcelInspection, type ImportField } from "../../shared/types";

const FIELDS = Object.keys(IMPORT_FIELD_LABELS) as ImportField[];

// Mirror of the backend's header aliases, for auto-mapping non-first sheets.
const ALIASES: Record<string, ImportField> = {
  id: "id",
  customerid: "id",
  custid: "id",
  cid: "id",
  code: "id",
  customercode: "id",
  custcode: "id",
  name: "name",
  customer: "name",
  customername: "name",
  clientname: "name",
  phone: "phone",
  mobile: "phone",
  mobileno: "phone",
  mobilenumber: "phone",
  contact: "phone",
  contactno: "phone",
  whatsapp: "phone",
  whatsappno: "phone",
  phno: "phone",
  address: "address",
  city: "city",
  area: "city",
  place: "city",
  product: "product",
  model: "product",
  item: "product",
  machine: "product",
  serial: "serialNo",
  serialno: "serialNo",
  serialnumber: "serialNo",
  slno: "serialNo",
  amount: "amount",
  price: "amount",
  total: "amount",
  cost: "amount",
  sellingdate: "sellingDate",
  saledate: "sellingDate",
  date: "sellingDate",
  purchasedate: "sellingDate",
  installationdate: "sellingDate",
  notes: "notes",
  remark: "notes",
  remarks: "notes",
  note: "notes",
};

function guess(col: string): ImportField | "" {
  return ALIASES[col.toLowerCase().replace(/[^a-z0-9]/g, "")] ?? "";
}

export function ImportDialog({
  inspection,
  onClose,
  onImported,
}: {
  inspection: ExcelInspection | null;
  onClose: () => void;
  onImported: () => void;
}) {
  const open = !!inspection && !inspection.canceled;
  const [sheetName, setSheetName] = useState("");
  const [mapping, setMapping] = useState<Record<string, ImportField | "">>({});
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importing, setImporting] = useState(false);

  const sheet = useMemo(
    () => inspection?.sheets.find((s) => s.name === sheetName) ?? inspection?.sheets[0],
    [inspection, sheetName],
  );

  useEffect(() => {
    if (!inspection || inspection.canceled) return;
    const first = inspection.sheets[0];
    setSheetName(first?.name ?? "");
    setMapping(
      first
        ? { ...Object.fromEntries(first.columns.map((c) => [c, guess(c)])), ...inspection.autoMap }
        : {},
    );
    setSkipDuplicates(true);
  }, [inspection]);

  useEffect(() => {
    if (!sheet) return;
    setMapping((prev) => {
      const next: Record<string, ImportField | ""> = {};
      for (const c of sheet.columns) next[c] = prev[c] ?? guess(c);
      return next;
    });
  }, [sheet]);

  if (!open || !inspection || !sheet) return null;

  const mappedFields = new Set(Object.values(mapping).filter(Boolean));
  const canImport = mappedFields.has("name") || mappedFields.has("phone");

  async function runImport() {
    setImporting(true);
    try {
      const res = await api.customers.importExcelMapped({
        filePath: inspection!.filePath!,
        sheet: sheet!.name,
        mapping,
        skipDuplicates,
      });
      toast.success(
        `Imported ${res.imported} of ${res.total} rows` +
          (res.skipped ? ` · skipped ${res.skipped} duplicate${res.skipped === 1 ? "" : "s"}` : ""),
      );
      onImported();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import “{inspection.fileName}”</DialogTitle>
          <DialogDescription>
            Match your spreadsheet columns to the app’s fields. Column order does not matter;
            anything set to “Ignore” is skipped.
          </DialogDescription>
        </DialogHeader>

        {inspection.sheets.length > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Sheet:</span>
            <select
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2"
            >
              {inspection.sheets.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="max-h-[45vh] overflow-y-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="p-2 font-medium">Your column</th>
                <th className="p-2 font-medium">Sample value</th>
                <th className="p-2 font-medium">Import as</th>
              </tr>
            </thead>
            <tbody>
              {sheet.columns.map((col) => (
                <tr key={col} className="border-t border-border">
                  <td className="p-2 font-medium">{col}</td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {sheet.sample.map((r) => r[col]).filter(Boolean)[0] ?? "—"}
                  </td>
                  <td className="p-2">
                    <select
                      value={mapping[col] ?? ""}
                      onChange={(e) =>
                        setMapping((m) => ({ ...m, [col]: e.target.value as ImportField | "" }))
                      }
                      className="h-8 w-48 rounded-md border border-input bg-background px-2"
                    >
                      <option value="">Ignore</option>
                      {FIELDS.map((f) => (
                        <option
                          key={f}
                          value={f}
                          disabled={mappedFields.has(f) && mapping[col] !== f}
                        >
                          {IMPORT_FIELD_LABELS[f]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={skipDuplicates} onCheckedChange={(v) => setSkipDuplicates(!!v)} />
          Skip rows whose Customer ID, phone number or serial number already exists
        </label>

        {!canImport && (
          <p className="text-xs text-destructive">
            Map at least a <b>Customer name</b> or <b>Phone</b> column to continue.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={runImport} disabled={!canImport || importing}>
            {importing ? <Loader2 className="size-4 animate-spin" /> : null}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
