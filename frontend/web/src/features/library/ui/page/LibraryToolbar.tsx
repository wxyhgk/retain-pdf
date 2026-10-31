// 书架工具栏(照搬 PDF_MD_lib 的 LibraryCollectionContextBar):左侧上下文标签 +
// 数量;右侧批量开关、筛选、排序下拉、网格/列表切换。按钮、下拉、切换都是 @retainpdf/ui 的 sm 尺寸，一样高。

import type { ReactNode, SVGProps } from "react";
import { Button, SegmentedControl, Select } from "@retainpdf/ui";

type LibraryToolbarProps = {
  count: number;
  viewMode: string;
  setViewMode: (mode: string) => void;
  sortMode: string;
  setSortMode: (mode: string) => void;
  filterSlot?: ReactNode;
  batchMode?: boolean;
  onToggleBatchMode?: ((next: boolean) => void) | null;
};

const SORT_OPTIONS = [
  { value: "updated", label: "最近更新" },
  { value: "created", label: "最近上传" },
  { value: "opened", label: "最近阅读" },
  { value: "title", label: "标题" },
];

function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" width="14" height="14">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IconList() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" width="14" height="14" strokeLinecap="round">
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  );
}
function IconCheckSquare(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" width="14" height="14" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  );
}

const VIEW_OPTIONS = [
  { value: "grid", label: <IconGrid />, props: { "aria-label": "网格视图", title: "网格" } },
  { value: "list", label: <IconList />, props: { "aria-label": "列表视图", title: "列表" } },
] as const;

export function LibraryToolbar({
  count, viewMode, setViewMode, sortMode, setSortMode, filterSlot = null,
  batchMode = false, onToggleBatchMode = null,
}: LibraryToolbarProps) {
  return (
    <div className="mb-4 border-b border-border/10 pb-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[15px] font-semibold tracking-tight text-foreground/90 sm:text-[16px]">全部书库</span>
          {Number.isFinite(count) ? (
            <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-muted/45 px-2 text-[11px] tabular-nums text-muted-foreground/70">{count}</span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {onToggleBatchMode ? (
            <Button
              variant="secondary" size="sm"
              title="批量操作" aria-label="批量操作" aria-pressed={batchMode}
              onClick={() => onToggleBatchMode(!batchMode)}
            ><IconCheckSquare className="opacity-70" />批量</Button>
          ) : null}

          {filterSlot}

          <Select size="sm" value={sortMode} onChange={(e) => setSortMode(e.target.value)} aria-label="排序方式">
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>

          <div className="hidden h-5 w-px bg-border/15 sm:block" aria-hidden />

          <SegmentedControl
            size="sm"
            label="视图"
            value={viewMode === "list" ? "list" : "grid"}
            onChange={setViewMode}
            options={VIEW_OPTIONS}
          />
        </div>
      </div>
    </div>
  );
}
