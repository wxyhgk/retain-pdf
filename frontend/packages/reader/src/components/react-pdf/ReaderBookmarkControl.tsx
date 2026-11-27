// 底栏书签：给当前页加 / 取消书签。按书存在本机（见 reader-bookmarks.ts）。
// 书签列表 2026-11-27 挪进左栏的「书签」页签（ReaderBookmarkList），这里只留这一颗。

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
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill={filled ? "currentColor" : "none"}>
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
        className={`reader-react-hud-btn reader-bookmark-toggle${marked ? " is-marked" : ""}`}
        aria-pressed={marked}
        aria-label={marked ? `取消第 ${page} 页的书签` : `给第 ${page} 页加书签`}
        title={marked ? "取消这一页的书签（书签都在左栏「书签」里）" : "给这一页加书签（书签都在左栏「书签」里）"}
        onClick={() => toggle(page)}
      >
        <BookmarkIcon filled={marked} />
      </button>
    </div>
  );
}
