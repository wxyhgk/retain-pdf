// 书架筛选(照搬 PDF_MD_lib 的 LibraryFilterModal,做成轻量 popover 而非 Radix
// 弹窗——满载测试下少一个重型 modal 更稳):按状态筛选,客户端过滤已加载项。
// 状态是几个里选一个，用 SegmentedControl（radiogroup），六个选项排成三列两行。

import { useEffect, useRef, useState } from "react";
import { Button, SegmentedControl } from "@retainpdf/ui";
import { isOcrOnlyItem } from "../../domain/card/library-card-semantics.js";
import type { LibraryCardItem } from "../../domain/types.js";

/** 状态归类需要的两个判定，由调用方注入（避免 domain 反向依赖 ui）。 */
type LibraryStatusDependencies = {
  isLibraryOnly: (item: LibraryCardItem) => boolean;
  isActive: (item: LibraryCardItem) => boolean;
};

type LibraryFilterMenuProps = {
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  statusCounts?: Record<string, number>;
};

export const STATUS_FILTERS = [
  { value: "all", label: "全部" },
  { value: "untranslated", label: "仅收藏" },
  { value: "ocr", label: "仅 OCR" },
  { value: "done", label: "已翻译" },
  { value: "active", label: "处理中" },
  { value: "failed", label: "失败" },
];

const EMPTY_STATUS_COUNTS: Readonly<Record<string, number>> = Object.freeze({
  done: 0,
  untranslated: 0,
  ocr: 0,
  active: 0,
  failed: 0,
});

export function libraryStatusFilterOf(item: LibraryCardItem, { isLibraryOnly, isActive }: LibraryStatusDependencies) {
  if (isLibraryOnly(item)) return "untranslated";
  if (isActive(item)) return "active";

  const status = `${item?.status || ""}`.trim().toLowerCase();
  if (status === "failed") return "failed";
  if (status === "succeeded") return isOcrOnlyItem(item) ? "ocr" : "done";
  return "";
}

export function countLibraryStatusFilters(items: LibraryCardItem[] = [], dependencies: LibraryStatusDependencies) {
  const counts: Record<string, number> = { ...EMPTY_STATUS_COUNTS };
  for (const item of Array.isArray(items) ? items : []) {
    const kind = libraryStatusFilterOf(item, dependencies);
    if (kind && Object.hasOwn(counts, kind)) counts[kind] += 1;
  }
  return counts;
}

export function LibraryFilterMenu({
  statusFilter, setStatusFilter,
  statusCounts = {},
}: LibraryFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeCount = statusFilter !== "all" ? 1 : 0;

  useEffect(() => {
    if (!open) return undefined;
    function onDown(event: MouseEvent) {
      // mousedown 的 target 必是 Node（或 null），DOM 类型里是 EventTarget，这里收窄到 Node。
      if (ref.current && !ref.current.contains(event.target as Node | null)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        id="library-filter-trigger"
        variant="secondary"
        size="sm"
        aria-controls="library-filter-surface"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        筛选
        {activeCount > 0 ? <span className="tabular-nums text-muted-foreground/70">{activeCount}</span> : null}
      </Button>

      {open ? (
        // 非 Radix 的轻量 popover(满载测试下比重型 modal 稳),没有 Presence 卸载延迟,
        // 关闭只能瞬间收起——但至少进场要有生命感:从触发按钮所在的右上角
        // 展开(origin-top-right),不从 scale(0) 凭空出现(emil-design-eng skill)。
        <div
          id="library-filter-surface"
          className="app-floating-surface absolute right-0 z-30 mt-2 w-64 origin-top-right p-4"
          role="dialog"
          aria-label="筛选书库"
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">处理状态</p>
          <SegmentedControl
            size="sm"
            label="处理状态"
            columns={3}
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTERS.map((s) => ({
              value: s.value,
              label: `${s.label}${s.value !== "all" && statusCounts[s.value] ? ` ${statusCounts[s.value]}` : ""}`,
            }))}
          />

          {activeCount > 0 ? (
            <Button variant="ghost" size="sm" className="mt-3 -ml-2.5 text-muted-foreground" onClick={() => setStatusFilter("all")}>清空筛选</Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// 客户端筛选谓词(和 sort 一样只作用已加载项)。
export function matchesLibraryFilter(
  item: LibraryCardItem,
  statusFilter: string,
  { isLibraryOnly, isActive }: LibraryStatusDependencies,
) {
  if (statusFilter === "all") {
    return true;
  }
  return libraryStatusFilterOf(item, { isLibraryOnly, isActive }) === statusFilter;
}
