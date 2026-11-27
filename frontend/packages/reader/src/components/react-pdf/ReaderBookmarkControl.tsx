// 底栏左边：「书签」（给当前页加 / 取消书签，按书存在本机，见 reader-bookmarks.ts；书签列表在左栏「书签」页签）和紧挨着的「收藏」入口。
// 2026-11-28 收口：两颗都带轻字标签，不再是左下角一个孤零零的图标。「收藏」功能还没做，点开只说一句还在做（用户要先留入口）。

import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@retainpdf/ui";

import { useReaderBookmarks } from "../../hooks/use-reader-bookmarks.js";
import type { ReaderRegion } from "../../shared/data/reader-regions.js";

export type ReaderBookmarkControlProps = {
  scope: string;
  currentPage: number;
  numPages: number;
  regions?: readonly ReaderRegion[];
};

export function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill={filled ? "currentColor" : "none"}>
      <path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

export function ReaderBookmarkControl({ scope, currentPage, numPages, regions }: ReaderBookmarkControlProps) {
  const { bookmarks, toggle } = useReaderBookmarks(scope, regions);
  if (!scope || numPages <= 0) return null;
  const page = Math.min(Math.max(currentPage, 1), numPages);
  const marked = bookmarks.some((bookmark) => bookmark.page === page);

  return (
    <div className="reader-react-hud-group reader-bookmarks" aria-label="书签">
      <button
        type="button"
        className={`reader-react-hud-btn reader-bookmark-mark${marked ? " is-marked" : ""}`}
        aria-pressed={marked}
        aria-label={marked ? `取消第 ${page} 页的书签` : `给第 ${page} 页加书签`}
        title={marked ? "取消这一页的书签（书签都在左栏「书签」里）" : "给这一页加书签（书签都在左栏「书签」里）"}
        onClick={() => toggle(page)}
      >
        <BookmarkIcon filled={marked} />
        <span className="reader-bottombar-label">{marked ? "已加书签" : "书签"}</span>
      </button>
      <ReaderFavoritesEntry />
    </div>
  );
}

/** 「收藏」入口：功能还没做，点开一张小卡说明（点外面、Esc 收起）。 */
function ReaderFavoritesEntry() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <span className="reader-favorites" ref={root}>
      <Button
        className="reader-react-hud-btn reader-favorites-toggle"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="收藏（还在做）"
        onClick={() => setOpen((value) => !value)}
      >
        <Star size={14} strokeWidth={2} aria-hidden />
        <span className="reader-bottombar-label">收藏</span>
      </Button>
      {open ? (
        <div className="reader-favorites-card reader-floating-surface" role="dialog" aria-label="收藏">
          <strong>收藏</strong>
          <p>还在做：以后可以把喜欢的段落、整页收在这里，按书分好，随时翻回来。现在先用「书签」记页。</p>
        </div>
      ) : null}
    </span>
  );
}
