// Bộ lọc thư viện (dựa trên LibraryFilterModal của PDF_MD_lib, dùng popover nhẹ
// thay vì popup Radix — ổn định hơn khi kiểm thử tải đầy): lọc theo trạng thái +
// thẻ, chỉ lọc phía máy khách trên các mục đã tải.

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const STATUS_FILTERS = [
  { value: "all", label: "Tất cả" },
  { value: "done", label: "Đã dịch" },
  { value: "untranslated", label: "Chưa dịch" },
  { value: "active", label: "Đang dịch" },
  { value: "failed", label: "Thất bại" },
];

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
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
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
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs transition active:scale-95",
          activeCount > 0 ? "bg-secondary text-secondary-foreground" : "border border-border text-foreground hover:bg-muted/30",
        )}
      >
Lọc
        {activeCount > 0 ? <span className="tabular-nums text-[11px] text-muted-foreground/70">{activeCount}</span> : null}
      </button>

      {open ? (
        // Popover nhẹ không dùng Radix (ổn định hơn modal nặng khi tải đầy), không
        // có độ trễ tháo gắn Presence; đóng là thu lại ngay — nhưng lúc vào vẫn
        // có chuyển động: mở từ góc phải trên của nút kích hoạt (origin-top-right),
        // không xuất hiện đột ngột từ scale(0) (emil-design-eng skill).
        <div className="absolute right-0 z-30 mt-2 w-64 origin-top-right rounded-2xl border border-border bg-paper p-4 shadow-[0_16px_40px_color-mix(in_srgb,var(--shadow-color)_16%,transparent)] transition-[opacity,transform] duration-150 ease-[var(--ease-out)] starting:scale-95 starting:opacity-0">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Trạng thái dịch</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((s) => (
              <Pill key={s.value} active={statusFilter === s.value} onClick={() => setStatusFilter(s.value)}>
                {s.label}{s.value !== "all" && statusCounts[s.value] ? ` ${statusCounts[s.value]}` : ""}
              </Pill>
            ))}
          </div>

          {tags.length ? (
            <>
              <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Thẻ</p>
              <div className="flex flex-wrap gap-2">
                <Pill active={!tagFilter} onClick={() => setTagFilter("")}>Tất cả</Pill>
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
            >Xóa bộ lọc</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// Vị từ lọc phía máy khách (giống sort, chỉ áp dụng cho mục đã tải).
export function matchesLibraryFilter(item, statusFilter, tagFilter, { isLibraryOnly, isActive }) {
  if (tagFilter && !(Array.isArray(item.tags) ? item.tags : []).includes(tagFilter)) {
    return false;
  }
  if (statusFilter === "all") {
    return true;
  }
  const lib = isLibraryOnly(item);
  const status = `${item.status || ""}`.trim();
  switch (statusFilter) {
    case "untranslated": return lib;
    case "done": return !lib && status === "succeeded";
    case "active": return !lib && isActive(item);
    case "failed": return !lib && status === "failed";
    default: return true;
  }
}
