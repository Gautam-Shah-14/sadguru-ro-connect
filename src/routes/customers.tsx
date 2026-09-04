import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, FileDown, FileSpreadsheet, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CustomerDialog } from "@/components/CustomerDialog";
import { ImportDialog } from "@/components/ImportDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { ExcelInspection } from "../../shared/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { emptyCustomer, formatIN, serviceDates, useCustomers, type Customer } from "@/lib/store";

export const Route = createFileRoute("/customers")({ component: CustomersPage });

/** True for shop-assigned IDs; false for the app's internal UUIDs. */
function isHumanId(id: string): boolean {
  return !!id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function CustomersPage() {
  const { customers, saveCustomer, removeCustomer, refresh } = useCustomers();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);
  const [inspection, setInspection] = useState<ExcelInspection | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.id, c.name, c.phone, c.city, c.product, c.serialNo].join(" ").toLowerCase().includes(q),
    );
  }, [customers, query]);

  async function importExcel() {
    setBusy(true);
    try {
      const res = await api.customers.inspectExcel();
      if (res.canceled) return;
      if (!res.sheets.length || !res.sheets[0]?.columns.length) {
        toast.error("That file has no readable rows.");
        return;
      }
      setInspection(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that file.");
    } finally {
      setBusy(false);
    }
  }

  async function exportExcel() {
    try {
      const res = await window.api!.customers.exportExcel();
      if (res.saved) toast.success("Exported to " + res.path);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.");
    }
  }

  async function save(customer: Customer) {
    try {
      await saveCustomer(customer);
      setEditing(null);
      toast.success("Customer saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save customer");
    }
  }

  return (
    <AppShell
      title="Customer Records"
      subtitle={`${customers.length} customers on file`}
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              const r = await api.customers.sampleExcel();
              if (r.saved) toast.success("Sample sheet saved to " + r.path);
            }}
          >
            <FileDown className="size-4" /> Sample sheet
          </Button>
          <Button variant="outline" onClick={importExcel} disabled={busy}>
            <FileSpreadsheet className="size-4" /> Import Excel
          </Button>
          <Button variant="outline" onClick={exportExcel} disabled={!customers.length}>
            <Download className="size-4" /> Export
          </Button>
          <Button onClick={() => setEditing(emptyCustomer())}>
            <Plus className="size-4" /> New entry
          </Button>
        </>
      }
    >
      <div className="panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ID, name, phone, city, model or serial no."
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Selling date</TableHead>
              <TableHead>Service 1</TableHead>
              <TableHead>Service 2</TableHead>
              <TableHead>Service 3</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => {
              const d = serviceDates(c);
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">
                    {isHumanId(c.id) ? c.id : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{c.name || "—"}</span>
                    <span className="block text-xs text-muted-foreground">{c.city || "—"}</span>
                  </TableCell>
                  <TableCell className="tabular-nums">{c.phone || "—"}</TableCell>
                  <TableCell>
                    {c.product || "—"}
                    <span className="block text-xs text-muted-foreground">{c.serialNo}</span>
                  </TableCell>
                  <TableCell>{formatIN(c.sellingDate)}</TableCell>
                  <TableCell className={c.done.service1 ? "text-success" : ""}>
                    {formatIN(d.service1)}
                  </TableCell>
                  <TableCell className={c.done.service2 ? "text-success" : ""}>
                    {formatIN(d.service2)}
                  </TableCell>
                  <TableCell className={c.done.service3 ? "text-success" : ""}>
                    {formatIN(d.service3)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(c)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        await removeCustomer(c.id);
                        toast.success("Customer removed");
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!filtered.length && (
              <TableRow>
                <TableCell colSpan={9} className="py-14 text-center text-sm text-muted-foreground">
                  No customers yet. Import your existing Excel sheet or add an entry manually.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CustomerDialog
        open={!!editing}
        value={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSave={save}
      />
      <ImportDialog
        inspection={inspection}
        onClose={() => setInspection(null)}
        onImported={refresh}
      />
    </AppShell>
  );
}
