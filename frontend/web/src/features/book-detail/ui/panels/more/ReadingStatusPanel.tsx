// 概览信息区「阅读状态」一行：未读 / 在读 / 读完。标签文字由概览的行标题提供。

import { cn } from "@/ui/lib/utils";

export const READING_STATUSES = [
  { value: "unread", label: "未读" },
  { value: "reading", label: "在读" },
  { value: "done", label: "读完" },
];

type ReadingStatusPanelProps = {
  value: string;
  busy?: string;
  onChange: (value: string) => void;
};

export function ReadingStatusPanel({ value, busy, onChange }: ReadingStatusPanelProps) {
  return (
    <div className="book-detail-reading-status-panel">
      <div className="inline-flex overflow-hidden rounded-md border border-border" role="group" aria-label="阅读状态">
        {READING_STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-pressed={value === s.value}
            disabled={busy === "reading"}
            onClick={() => onChange(s.value)}
            className={cn(
              "book-detail-reading-btn border-r border-border px-3 py-1 text-xs last:border-r-0 disabled:opacity-60",
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
