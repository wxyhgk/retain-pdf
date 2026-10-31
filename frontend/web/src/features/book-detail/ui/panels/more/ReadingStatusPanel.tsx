// 概览信息区「阅读状态」一行：未读 / 在读 / 读完。标签文字由概览的行标题提供。

import { SegmentedControl } from "@retainpdf/ui";
import type { DocumentReadingStatus } from "@/platform/api/index.js";

export const READING_STATUSES: ReadonlyArray<{ value: DocumentReadingStatus; label: string }> = [
  { value: "unread", label: "未读" },
  { value: "reading", label: "在读" },
  { value: "done", label: "读完" },
];

const READING_OPTIONS = READING_STATUSES.map((s) => ({ ...s, props: { "data-reading-status": s.value } }));

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
