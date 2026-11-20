// 概览信息区「阅读状态」一行：未读 / 在读 / 读完。标签文字由概览的行标题提供。

import { SegmentedControl } from "@retainpdf/ui";
import { BookCheck, BookMarked, BookOpen } from "lucide-react";
import type { DocumentReadingStatus } from "@/platform/api/index.js";

export const READING_STATUSES: ReadonlyArray<{ value: DocumentReadingStatus; label: string }> = [
  { value: "unread", label: "未读" },
  { value: "reading", label: "在读" },
  { value: "done", label: "读完" },
];

// 每个选项前面一个小图标：未读合着的书签、在读翻开的书、读完打勾的书。
const READING_ICONS = { unread: BookMarked, reading: BookOpen, done: BookCheck } as const;

const READING_OPTIONS = READING_STATUSES.map((s) => {
  const Icon = READING_ICONS[s.value as keyof typeof READING_ICONS];
  return {
    value: s.value,
    label: <span className="book-detail-reading-option">{Icon ? <Icon aria-hidden="true" /> : null}{s.label}</span>,
    props: { "data-reading-status": s.value },
  };
});

type ReadingStatusPanelProps = {
  value: string;
  busy?: string;
  onChange: (value: DocumentReadingStatus) => void;
};

export function ReadingStatusPanel({ value, busy, onChange }: ReadingStatusPanelProps) {
  return (
    <div className="book-detail-reading-status-panel">
      <SegmentedControl
        size="sm"
        label="阅读状态"
        value={value as DocumentReadingStatus}
        options={READING_OPTIONS}
        disabled={busy === "reading"}
        onChange={onChange}
      />
    </div>
  );
}
