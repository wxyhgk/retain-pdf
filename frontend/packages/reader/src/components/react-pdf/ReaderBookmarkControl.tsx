// 底栏左边：「书签」（给当前页加 / 取消书签，按书存在本机，见 reader-bookmarks.ts；书签列表在左栏「书签」页签）和紧挨着的「收藏」。
// 2026-11-28 两条栏只用图标（bar-icon.ts，名字在悬停里）。「收藏」11-28 先只留入口，同一天做出来：书页上选一段字，
// 浮条或右键「收藏」收进来（reader-favorites.ts），这里点开往上弹一张列表，点一条翻回那一页，悬停出 × 删掉。

import { useEffect, useRef, useState } from "react";
import { Bookmark, Star, X } from "lucide-react";
import { Button } from "@retainpdf/ui";
import { BAR_ICON } from "./bar-icon.js";

import { useReaderBookmarks } from "../../hooks/use-reader-bookmarks.js";
import { useReaderFavorites } from "../../hooks/use-reader-favorites.js";
import { useReaderContext } from "./reader-context.js";
import type { ReaderRegion } from "../../shared/data/reader-regions.js";

export type ReaderBookmarkControlProps = {
  scope: string;
  currentPage: number;
  numPages: number;
  regions?: readonly ReaderRegion[];
};

/** 书签图标：加过书签的页填实。 */
export function BookmarkIcon({ filled }: { filled: boolean }) {
  return <Bookmark {...BAR_ICON} fill={filled ? "currentColor" : "none"} aria-hidden />;
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
      </button>
      <ReaderFavoritesEntry scope={scope} />
    </div>
  );
}

/** 「收藏」：点开往上弹这本书收的段落（新收的在上面），点一条翻回去；点外面、Esc 收起。 */
function ReaderFavoritesEntry({ scope }: { scope: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement | null>(null);
  const { favorites, remove } = useReaderFavorites(scope);
  const goToPage = useReaderContext()?.goToPage;
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
  const count = favorites.length;
  return (
    <span className="reader-favorites" ref={root}>
      <Button
        className="reader-react-hud-btn reader-favorites-toggle"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={count ? `收藏（${count} 段）` : "收藏"}
        title={count ? `收藏的段落（${count} 段）` : "收藏：书页上选一段字，点浮条上的「收藏」"}
        onClick={() => setOpen((value) => !value)}
      >
        <Star {...BAR_ICON} fill={count ? "currentColor" : "none"} aria-hidden />
      </Button>
      {open ? (
        <div className="reader-favorites-card reader-floating-surface" role="dialog" aria-label="收藏">
          <strong>收藏{count ? <span className="reader-favorites-count">{count}</span> : null}</strong>
          {count ? (
            <ul className="reader-favorites-list">
              {favorites.map((favorite) => (
                <li key={favorite.id}>
                  <Button
                    className="reader-favorites-jump"
                    title={`翻到第 ${favorite.page} 页`}
                    onClick={() => {
                      goToPage?.(favorite.page, favorite.pane);
                      setOpen(false);
                    }}
                  >
                    <span className="reader-favorites-text">{favorite.text}</span>
                    <span className="reader-favorites-page">p.{favorite.page}{favorite.pane === "translated" ? " · 译文" : ""}</span>
                  </Button>
                  <Button
                    className="reader-favorites-remove"
                    aria-label={`删掉第 ${favorite.page} 页这段收藏`}
                    title="删掉"
                    onClick={() => remove(favorite.id)}
                  >
                    <X size={13} aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p>还没有收藏。在书页上选一段字，点浮条上的「收藏」（或右键「收藏这段」），就收在这里，随时翻回来。</p>
          )}
        </div>
      ) : null}
    </span>
  );
}
