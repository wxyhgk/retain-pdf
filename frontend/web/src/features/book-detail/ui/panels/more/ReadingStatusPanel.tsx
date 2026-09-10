// 右栏：阅读状态（未读 / 在读 / 读完）。

import { cn } from "@/ui/lib/utils";
import { BookOpen } from "lucide-react";

export const READING_STATUSES = [
  { value: "unread", label: "未读" },
  { value: "reading", label: "在读" },
  { value: "done", label: "读完" },
];

/**
 * @param {object} props
 * @param {string} props.value
 * @param {string} props.busy
 * @param {(value: string) => void} props.onChange
 */
export function ReadingStatusPanel({ value, busy, onChange }) {
  return (
    <div className="book-detail-reading-status-panel space-y-1.5">
      <p className="book-detail-reading-status-label flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />阅读状态
      </p>
      <div className="inline-flex overflow-hidden rounded-md border border-border" role="group" aria-label="阅读状态">
        {READING_STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-pressed={value === s.value}
            disabled={busy === "reading"}
            onClick={() => onChange(s.value)}
            className={cn(
              "book-detail-reading-btn border-r border-border px-4 py-1.5 text-xs last:border-r-0 disabled:opacity-60",
              value === s.value
                ? "is-active bg-primary text-primary-foreground"
                : "bg-paper text-muted-foreground hover:bg-accent",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
