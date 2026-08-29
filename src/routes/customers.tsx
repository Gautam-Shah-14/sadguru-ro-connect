import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Plus, Search, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CustomerDialog } from "@/components/CustomerDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { emptyCustomer, formatIN, serviceDates, useCustomers, type Customer } from "@/lib/store";
import { exportCustomers, parseWorkbook } from "@/lib/excel";

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [
      { title: "Customer Records | Sadguru Enterprise RO Manager" },
      {
        name: "description",
        content:
          "Import Excel customer sheets, add new RO purifier sales and track every customer's servicing schedule.",
      },
      { property: "og:title", content: "Customer Records | Sadguru Enterprise" },
      {
        property: "og:description",
        content: "Import Excel sheets and manage RO customers with automatic service dates.",
      },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { customers, persist } = useCustomers();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.phone, c.city, c.product, c.serialNo].join(" ").toLowerCase().includes(q),
    );
  }, [customers, query]);

  async function handleFile(file: File) {
    try {
      const rows = await parseWorkbook(file);
      if (!rows.length) {
        toast.error("No usable rows found in that sheet.");
        return;
      }
      persist([...customers, ...rows]);
      toast.success(`Imported ${rows.length} customers from ${file.name}`);
    } catch {
      toast.error("Could not read that file. Use .xlsx or .csv.");
    }
  }

  function save(customer: Customer) {
    const exists = customers.some((c) => c.id === customer.id);
    persist(exists ? customers.map((c) => (c.id === customer.id ? customer : c)) : [customer, ...customers]);
    setEditing(null);
    toast.success("Customer saved");
  }

  return (
    <AppShell
      title="Customer Records"
      subtitle={`${customers.length} customers on file`}
      actions={
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <FileSpreadsheet className="size-4" /> Import Excel
          </Button>
          <Button
            variant="outline"
            onClick={() => exportCustomers(customers)}
            disabled={!customers.length}
          >
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
            placeholder="Search by name, phone, city, model or serial no."
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
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
                      onClick={() => {
                        persist(customers.filter((x) => x.id !== c.id));
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
                <TableCell colSpan={8} className="py-14 text-center text-sm text-muted-foreground">
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
    </AppShell>
  );
}
