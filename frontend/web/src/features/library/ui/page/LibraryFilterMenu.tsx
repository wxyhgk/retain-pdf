// 书架筛选(照搬 PDF_MD_lib 的 LibraryFilterModal,做成轻量 popover 而非 Radix
// 弹窗——满载测试下少一个重型 modal 更稳):按状态 + 标签筛选,客户端过滤已加载项。

import { useEffect, useRef, useState } from "react";
import { cn } from "@retainpdf/ui/lib/utils";
import { isOcrOnlyItem } from "../../domain/card/library-card-semantics.js";

export const STATUS_FILTERS = [
  { value: "all", label: "全部" },
  { value: "untranslated", label: "仅收藏" },
  { value: "ocr", label: "仅 OCR" },
  { value: "done", label: "已翻译" },
  { value: "active", label: "处理中" },
  { value: "failed", label: "失败" },
];

const EMPTY_STATUS_COUNTS = Object.freeze({
  done: 0,
  untranslated: 0,
  ocr: 0,
  active: 0,
  failed: 0,
});

export function libraryStatusFilterOf(item, { isLibraryOnly, isActive }) {
  if (isLibraryOnly(item)) return "untranslated";
  if (isActive(item)) return "active";

  const status = `${item?.status || ""}`.trim().toLowerCase();
  if (status === "failed") return "failed";
  if (status === "succeeded") return isOcrOnlyItem(item) ? "ocr" : "done";
  return "";
}

export function countLibraryStatusFilters(items = [], dependencies) {
  const counts = { ...EMPTY_STATUS_COUNTS };
  for (const item of Array.isArray(items) ? items : []) {
    const kind = libraryStatusFilterOf(item, dependencies);
    if (kind && Object.hasOwn(counts, kind)) counts[kind] += 1;
  }
  return counts;
}

export function LibraryFilterMenu({
  statusFilter, setStatusFilter,
  tagFilter, setTagFilter,
  tags = [],
  statusCounts = {},
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const activeCount = (statusFilter !== "all" ? 1 : 0) + (tagFilter ? 1 : 0);

  useEffect(() => {
    if (!open) return undefined;
    function onDown(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function Pill({ active, onClick, children }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center rounded-full border px-3 py-1 text-xs transition active:scale-95",
          active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-paper text-muted-foreground hover:bg-accent",
        )}
      >{children}</button>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        id="library-filter-trigger"
        type="button"
        aria-controls="library-filter-surface"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs transition active:scale-95",
          activeCount > 0 ? "bg-secondary text-secondary-foreground" : "border border-border text-foreground hover:bg-muted/30",
        )}
      >
        筛选
        {activeCount > 0 ? <span className="tabular-nums text-[11px] text-muted-foreground/70">{activeCount}</span> : null}
      </button>

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
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((s) => (
              <Pill key={s.value} active={statusFilter === s.value} onClick={() => setStatusFilter(s.value)}>
                {s.label}{s.value !== "all" && statusCounts[s.value] ? ` ${statusCounts[s.value]}` : ""}
              </Pill>
            ))}
          </div>

          {tags.length ? (
            <>
              <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">标签</p>
              <div className="flex flex-wrap gap-2">
                <Pill active={!tagFilter} onClick={() => setTagFilter("")}>全部</Pill>
                {tags.map((t) => (
                  <Pill key={t} active={tagFilter === t} onClick={() => setTagFilter(tagFilter === t ? "" : t)}>{t}</Pill>
                ))}
              </div>
            </>
          ) : null}

          {activeCount > 0 ? (
            <button
              type="button"
              onClick={() => { setStatusFilter("all"); setTagFilter(""); }}
              className="mt-4 text-xs text-muted-foreground hover:text-foreground hover:underline"
            >清空筛选</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// 客户端筛选谓词(和 sort 一样只作用已加载项)。
export function matchesLibraryFilter(item, statusFilter, tagFilter, { isLibraryOnly, isActive }) {
  if (tagFilter && !(Array.isArray(item.tags) ? item.tags : []).includes(tagFilter)) {
    return false;
  }
  if (statusFilter === "all") {
    return true;
  }
  return libraryStatusFilterOf(item, { isLibraryOnly, isActive }) === statusFilter;
}
