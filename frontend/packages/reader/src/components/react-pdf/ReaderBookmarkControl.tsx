// 底栏书签：给当前页加 / 取消书签，列表里点一下跳到那一页。按书存在本机（见 reader-bookmarks.ts）。

import { useEffect, useRef, useState } from "react";
import {
  bookmarkLabelForPage,
  readReaderBookmarks,
  removeReaderBookmark,
  toggleReaderBookmark,
  type ReaderBookmark,
} from "../../shared/state/reader-bookmarks.js";
import type { ReaderRegion } from "../../shared/data/reader-regions.js";

export type ReaderBookmarkControlProps = {
  scope: string;
  currentPage: number;
  numPages: number;
  regions?: readonly ReaderRegion[];
  onGoToPage?: (page: number) => void;
};

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill={filled ? "currentColor" : "none"}>
      <path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

export function ReaderBookmarkControl({ scope, currentPage, numPages, regions, onGoToPage }: ReaderBookmarkControlProps) {
  const [bookmarks, setBookmarks] = useState<ReaderBookmark[]>(() => readReaderBookmarks(scope));
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setBookmarks(readReaderBookmarks(scope));
    setOpen(false);
  }, [scope]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!scope || numPages <= 0) return null;
  const page = Math.min(Math.max(currentPage, 1), numPages);
  const marked = bookmarks.some((bookmark) => bookmark.page === page);

  return (
    <div className="reader-react-hud-group reader-bookmarks" aria-label="书签" ref={rootRef}>
      <button
        type="button"
        className={`reader-react-hud-btn reader-bookmark-toggle${marked ? " is-marked" : ""}`}
        aria-pressed={marked}
        aria-label={marked ? `取消第 ${page} 页的书签` : `给第 ${page} 页加书签`}
        title={marked ? "取消这一页的书签" : "给这一页加书签"}
        onClick={() => setBookmarks(toggleReaderBookmark(scope, page, bookmarkLabelForPage(regions, page)))}
      >
        <BookmarkIcon filled={marked} />
      </button>
      <button
        type="button"
        className="reader-react-hud-btn reader-bookmark-list-btn"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`书签列表，共 ${bookmarks.length} 个`}
        title="书签列表"
        disabled={!bookmarks.length}
        onClick={() => setOpen((value) => !value)}
      >
        {bookmarks.length}
      </button>
      {open && bookmarks.length ? (
        <div className="reader-bookmark-popover" role="dialog" aria-label="书签">
          <ol className="reader-bookmark-list">
            {bookmarks.map((bookmark) => (
              <li key={bookmark.page} className={bookmark.page === page ? "is-current" : ""}>
                <button
                  type="button"
                  className="reader-bookmark-jump"
                  onClick={() => {
                    onGoToPage?.(Math.min(bookmark.page, numPages));
                    setOpen(false);
                  }}
                >
                  <span className="reader-bookmark-page">第 {bookmark.page} 页</span>
                  {bookmark.label ? <span className="reader-bookmark-label">{bookmark.label}</span> : null}
                </button>
                <button
                  type="button"
                  className="reader-bookmark-remove"
                  aria-label={`删除第 ${bookmark.page} 页的书签`}
                  onClick={() => setBookmarks(removeReaderBookmark(scope, bookmark.page))}
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
