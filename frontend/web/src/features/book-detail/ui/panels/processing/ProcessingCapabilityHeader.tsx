import { cn } from "@/ui/lib/utils";
import type { ReactNode } from "react";

const TONE_CLASS: Record<string, string> = {
  active: "border-foreground bg-foreground text-background",
  done: "border-border/70 bg-muted text-foreground",
  failed: "border-foreground/30 bg-background text-foreground",
  muted: "border-transparent bg-muted text-muted-foreground",
};

export function ProcessingCapabilityHeader({
  icon,
  title,
  description,
  status,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  status: { label: string; tone: string };
}) {
  return (
    <div className="book-detail-processing-header flex min-w-0 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="book-detail-processing-icon grid shrink-0 place-items-center bg-paper text-foreground">
          {icon}
        </span>
        <div className="book-detail-processing-copy min-w-0">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      <span
        className={cn(
          "book-detail-status book-detail-processing-status shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium leading-4",
          TONE_CLASS[status.tone] || TONE_CLASS.muted,
        )}
      >
        {status.label}
      </span>
    </div>
  );
}
