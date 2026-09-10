// 批量选择工具栏(照搬 PDF_MD_lib 的 LibraryBatchToolbar,按我们后端能力收窄:
// 没有批量删除端点,逐个复用 deleteDocument;加入合集本身就是批量端点,直接
// 传数组)。视觉上不搬参考项目的"贴底通栏",改成和本项目已有的
// library-search-dock/library-bottom-actions 同一套"悬浮圆角胶囊"语言——
// 批量模式下占用搜索框原来的底部居中位置(RecentJobsLibrary 切换时隐藏
// LibrarySearchDock,两者不会同时出现)。

import { useEffect, useRef, useState } from "react";
import { cn } from "@/ui/lib/utils";

function IconTrash(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14" {...props}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconFolderPlus(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14" {...props}>
      <path d="M3 7a1 1 0 0 1 1-1h4l2 2h10a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z" strokeLinejoin="round" />
      <path d="M12 11v5m-2.5-2.5h5" strokeLinecap="round" />
    </svg>
  );
}

export function LibraryBatchToolbar({
  count,
  totalSelectable,
  allSelected,
  onSelectAll,
  onCancel,
  onDelete,
  collections = [],
  onAddToCollection,
  busy = false,
}) {
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!collectionsOpen) return undefined;
    function onDown(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setCollectionsOpen(false);
      }
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setCollectionsOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [collectionsOpen]);

  const hasSelection = count > 0;

  return (
    <div className="library-search-dock" aria-label="批量操作工具栏">
      <div className="flex min-h-[52px] flex-wrap items-center gap-2 rounded-full border border-[color-mix(in_srgb,color-mix(in_srgb,var(--line)_85%,var(--muted))_82%,transparent)] bg-paper/82 p-2 pl-4 shadow-[0_18px_46px_color-mix(in_srgb,var(--shadow-color)_12%,transparent)] backdrop-blur-[18px]">
        <button
          type="button"
          className="shrink-0 rounded-[var(--btn-radius)] px-2 py-1 text-xs font-medium text-muted-foreground transition active:scale-95 hover:bg-muted/40 hover:text-foreground"
          onClick={onCancel}
        >取消</button>

        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          已选 {count}{Number.isFinite(totalSelectable) ? ` / ${totalSelectable}` : ""}
        </span>

        <button
          type="button"
          className="shrink-0 rounded-[var(--btn-radius)] border border-border px-3 py-1.5 text-xs transition active:scale-95 hover:bg-muted/30 disabled:pointer-events-none disabled:opacity-50"
          disabled={busy || !totalSelectable}
          onClick={onSelectAll}
        >{allSelected ? "取消全选" : `全选已加载${Number.isFinite(totalSelectable) ? `(${totalSelectable})` : ""}`}</button>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="relative" ref={ref}>
            <button
              type="button"
              aria-controls="library-batch-collections-menu"
              aria-expanded={collectionsOpen}
              aria-haspopup="menu"
              className="inline-flex h-8 items-center gap-1.5 rounded-[var(--btn-radius)] border border-border bg-paper px-3 text-xs font-medium transition active:scale-95 hover:bg-muted/30 disabled:pointer-events-none disabled:opacity-50"
              disabled={busy || !hasSelection || collections.length === 0}
              onClick={() => setCollectionsOpen((v) => !v)}
            >
              <IconFolderPlus className="opacity-70" />
              加入合集
            </button>
            {collectionsOpen ? (
              <div
                id="library-batch-collections-menu"
                className="app-floating-surface absolute bottom-full right-0 z-30 mb-2 max-h-64 w-48 origin-bottom-right overflow-y-auto p-1.5"
                role="menu"
                aria-label="选择合集"
              >
                {collections.map((c) => (
                  <button
                    key={c.collection_id}
                    type="button"
                    role="menuitem"
                    className="block w-full truncate rounded-xl px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted/45"
                    onClick={() => { setCollectionsOpen(false); onAddToCollection?.(c.collection_id); }}
                  >{c.name}</button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--btn-radius)] border border-destructive/30 bg-paper px-3 text-xs font-medium text-destructive transition active:scale-95 hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
            disabled={busy || !hasSelection}
            onClick={onDelete}
          >
            <IconTrash />
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
