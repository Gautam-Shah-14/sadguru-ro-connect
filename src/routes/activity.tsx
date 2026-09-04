import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import type { MessageKind, MessageStatus } from "../../shared/types";

export const Route = createFileRoute("/activity")({ component: ActivityPage });

const FILTERS = ["All", "Service", "Festival"] as const;
const kindOf: Record<(typeof FILTERS)[number], MessageKind | undefined> = {
  All: undefined,
  Service: "service",
  Festival: "festival",
};

const statusClass: Record<MessageStatus, string> = {
  sent: "bg-success/15 text-success",
  "dry-run": "bg-secondary text-secondary-foreground",
  queued: "bg-warning/20 text-warning-foreground",
  failed: "bg-destructive/12 text-destructive",
};

function ActivityPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const kind = kindOf[filter];
  const query = useQuery({
    queryKey: ["message-log", kind ?? "all"],
    queryFn: () => api.messages.log({ limit: 500, ...(kind ? { kind } : {}) }),
  });
  const rows = query.data ?? [];

  return (
    <AppShell
      title="Activity"
      subtitle="Every WhatsApp message this app has sent or queued"
      actions={
        <Button variant="outline" onClick={() => query.refetch()}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      }
    >
      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f}
          </Button>
        ))}
      </div>

      <div className="panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {new Date(r.createdAt.replace(" ", "T") + "Z").toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </TableCell>
                <TableCell className="text-sm capitalize">{r.kind}</TableCell>
                <TableCell className="text-sm">{r.customerName ?? "—"}</TableCell>
                <TableCell className="max-w-md">
                  <span className="line-clamp-2 text-xs text-muted-foreground">{r.body}</span>
                  {r.error ? (
                    <span className="mt-0.5 block text-[11px] text-destructive">{r.error}</span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass[r.status]}`}
                  >
                    {r.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={5} className="py-14 text-center text-sm text-muted-foreground">
                  Nothing sent yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Showing the {rows.length} most recent entries. “dry-run” means WhatsApp sending is switched
        off in Settings, so the message was only recorded here.
      </p>
    </AppShell>
  );
}
