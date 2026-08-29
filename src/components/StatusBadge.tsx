import { cn } from "@/lib/utils";
import type { DueItem } from "@/lib/store";

const map: Record<DueItem["status"], { label: string; className: string }> = {
  overdue: { label: "Overdue", className: "bg-destructive/12 text-destructive" },
  "due-soon": { label: "Due soon", className: "bg-warning/20 text-warning-foreground" },
  upcoming: { label: "Upcoming", className: "bg-secondary text-secondary-foreground" },
  done: { label: "Completed", className: "bg-success/15 text-success" },
};

export function StatusBadge({ status }: { status: DueItem["status"] }) {
  const s = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        s.className,
      )}
    >
      {s.label}
    </span>
  );
}
