// Thanh công cụ chọn hàng loạt (chép từ LibraryBatchToolbar của PDF_MD_lib, thu hẹp
// theo khả năng backend của dự án: không có endpoint xóa hàng loạt, tái sử dụng
// deleteDocument cho từng cái; thêm vào bộ sưu tập vốn đã là endpoint hàng loạt, truyền
// thẳng mảng). Về thị giác không chuyển "thanh dính đáy" của dự án tham chiếu, đổi sang
// cùng ngôn ngữ "viên nang bo góc lơ lửng" với library-search-dock/library-bottom-actions
// đã có trong dự án — chế độ hàng loạt chiếm vị trí giữa đáy vốn là ô tìm kiếm
// (RecentJobsLibrary ẩn LibrarySearchDock khi chuyển, hai cái không đồng thời xuất hiện).

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

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
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [collectionsOpen]);

  const hasSelection = count > 0;

  return (
    <div className="library-search-dock" aria-label="Thanh công cụ thao tác hàng loạt">
      <div className="flex min-h-[52px] flex-wrap items-center gap-2 rounded-full border border-[color-mix(in_srgb,color-mix(in_srgb,var(--line)_85%,var(--muted))_82%,transparent)] bg-paper/82 p-2 pl-4 shadow-[0_18px_46px_color-mix(in_srgb,var(--shadow-color)_12%,transparent)] backdrop-blur-[18px]">
        <button
          type="button"
          className="shrink-0 rounded-[var(--btn-radius)] px-2 py-1 text-xs font-medium text-muted-foreground transition active:scale-95 hover:bg-muted/40 hover:text-foreground"
          onClick={onCancel}
        >Hủy</button>

        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          Đã chọn {count}{Number.isFinite(totalSelectable) ? ` / ${totalSelectable}` : ""}
        </span>

        <button
          type="button"
          className="shrink-0 rounded-[var(--btn-radius)] border border-border px-3 py-1.5 text-xs transition active:scale-95 hover:bg-muted/30 disabled:pointer-events-none disabled:opacity-50"
          disabled={busy || !totalSelectable}
          onClick={onSelectAll}
        >{allSelected ? "Bỏ chọn tất cả" : `Chọn tất cả đã tải${Number.isFinite(totalSelectable) ? `(${totalSelectable})` : ""}`}</button>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="relative" ref={ref}>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-[var(--btn-radius)] border border-border bg-paper px-3 text-xs font-medium transition active:scale-95 hover:bg-muted/30 disabled:pointer-events-none disabled:opacity-50"
              disabled={busy || !hasSelection || collections.length === 0}
              onClick={() => setCollectionsOpen((v) => !v)}
            >
              <IconFolderPlus className="opacity-70" />
Thêm vào bộ sưu tập
            </button>
            {collectionsOpen ? (
              <div className="absolute bottom-full right-0 z-30 mb-2 max-h-64 w-48 origin-bottom-right overflow-y-auto rounded-2xl border border-border bg-paper p-1.5 shadow-[0_16px_40px_color-mix(in_srgb,var(--shadow-color)_16%,transparent)] transition-[opacity,transform] duration-150 ease-[var(--ease-out)] starting:scale-95 starting:opacity-0">
                {collections.map((c) => (
                  <button
                    key={c.collection_id}
                    type="button"
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
Xóa
          </button>
        </div>
      </div>
    </div>
  );
}
