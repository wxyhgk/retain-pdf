// 书页区左缘的目录（2026-11-28 照原型 reader-prototype.html「适配百页大书的左侧 Minimap 目录」）：
// 平时只是一排极淡的短横线（章长、节短，当前节墨色、当前章深灰）；鼠标移上去（或键盘 Tab 到）换成目录卡，
// 当前章展开、别的章收着（▸ / ▾），页码只在悬停和当前那一行出；条目多（> 15）时卡片顶上有过滤框，光标在框里时卡片不收。
// 固定（2026-11-28 用户：「目录的弹窗增加一个 pin 按钮，这样就能左侧固定了」）：卡片顶上的图钉、或顶栏左边的「目录」按钮（ReaderTocToggle）。
// 屏够宽（≥ 900，和左栏同一条线）时固定成中间工作区最左边实占的一栏（docked，书页往右让），短横线不再画；
// 窄屏固定只是卡片一直开着（浮在书页上），按 Esc 收起。再点图钉或顶栏按钮取消。
// 以前目录是左栏的一个页签（11-27），要先点开左栏再切页签，还占着左边 300px。
// 数据（章 + 节、眼下在哪、画哪几根）在 shared/content/reader-toc.ts。
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { ChevronDown, ChevronRight, ListTree, Pin, PinOff, Search, X } from "lucide-react";
import { Button, Input } from "@retainpdf/ui";

import type { PdfOutlineNode } from "../../pdf/pdf-outline.js";
import { readerOutline } from "../../shared/content/reader-find.js";
import { filterToc, readerToc, tocBars, tocCurrent, tocSize, TOC_FILTER_MIN, type ReaderTocNode } from "../../shared/content/reader-toc.js";
import { useReaderContext, useReaderHudContext } from "./reader-context.js";
import { BAR_ICON } from "./bar-icon.js";

const NO_REGIONS: never[] = [];

/** 顶栏左边的「目录」按钮：固定 / 收起目录（和卡片顶上的图钉同一个开关）。书里没有目录（没书签、也没认出标题）时灰掉。 */
export function ReaderTocToggle({ pinned, available, onToggle }: { pinned: boolean; available: boolean; onToggle: () => void }): ReactElement {
  return (
    <Button
      className="reader-toc-toggle"
      aria-label="目录"
      aria-pressed={pinned}
      disabled={!available}
      title={available ? (pinned ? "收起目录" : "把目录固定在左边") : "这本书没有目录"}
      onClick={onToggle}
    >
      <ListTree {...BAR_ICON} aria-hidden />
    </Button>
  );
}

export function ReaderTocMinimap({ bookmarks, onJumpPage, onJumpBlock, pinned = false, docked = false, onPinChange }: {
  /** PDF 自带的书签（有就按它列）。 */
  bookmarks: readonly PdfOutlineNode[];
  onJumpPage: (page: number) => void;
  /** 按标题来的目录跳到那一块。 */
  onJumpBlock: (itemId: string) => void;
  /** 固定了（图钉、顶栏「目录」按钮）：卡片一直开着。 */
  pinned?: boolean;
  /** 固定成实占的一栏（屏够宽时阅读页把它摆进中间工作区最左边）：不画短横线，只画卡片的内容。 */
  docked?: boolean;
  /** 点图钉；浮着固定时在卡片里按 Esc 是 false。 */
  onPinChange?: (pinned: boolean) => void;
}): ReactElement | null {
  const regions = useReaderContext()?.regions ?? NO_REGIONS;
  const currentPage = useReaderHudContext()?.currentPage ?? 1;
  const chapters = useMemo(() => readerToc(bookmarks, readerOutline(regions)), [bookmarks, regions]);
  const current = useMemo(() => tocCurrent(chapters, currentPage), [chapters, currentPage]);
  const bars = useMemo(() => tocBars(chapters, current), [chapters, current]);
  const total = tocSize(chapters);
  const [query, setQuery] = useState("");
  const shown = useMemo(() => filterToc(chapters, query), [chapters, query]);
  // 展开了哪几章：一打开卡片就把当前章加进来；点了某一条也把它那一章留着展开（别让鼠标底下的行跳走）。
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const list = useRef<HTMLDivElement | null>(null);
  const scrollToCurrent = useRef(false);
  const open = () => {
    if (current.chapterId && !expanded.has(current.chapterId)) setExpanded((set) => new Set(set).add(current.chapterId!));
    scrollToCurrent.current = true;
  };
  // 一固定就和悬停一样：展开当前章、滚到当前节（固定成一栏是新挂上的，也走这里）。
  useEffect(() => {
    if (pinned || docked) open();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在固定的那一下
  }, [pinned, docked]);
  useLayoutEffect(() => {
    if (!scrollToCurrent.current) return;
    scrollToCurrent.current = false;
    list.current?.querySelector('[aria-current="location"]')?.scrollIntoView?.({ block: "center" });
  });
  if (!chapters.length) return null;

  const toggle = (id: string) => setExpanded((set) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const jump = (node: ReaderTocNode, chapterId: string) => {
    setExpanded((set) => (set.has(chapterId) ? set : new Set(set).add(chapterId)));
    if (node.itemId) onJumpBlock(node.itemId);
    else if (node.page !== null) onJumpPage(node.page);
  };
  const filtering = Boolean(query.trim());
  const row = (node: ReaderTocNode, chapterId: string) => (
    <Button
      className="reader-toc-entry"
      data-depth={Math.min(node.depth, 3)}
      aria-current={node.id === current.nodeId ? "location" : undefined}
      disabled={!node.itemId && node.page === null}
      title={node.page === null ? "这条书签没有指到页" : `${node.title}（第 ${node.page} 页）`}
      onClick={() => jump(node, chapterId)}
    >
      <span className="reader-toc-title">{node.title}</span>
      {node.page !== null ? <span className="reader-toc-page">p.{node.page}</span> : null}
    </Button>
  );

  const pinLabel = pinned ? "取消固定" : "固定在左边";
  const content = (
    <>
      <div className="reader-toc-head">
        <span className="reader-toc-head-title">目录</span>
        <Button className="reader-toc-pin" aria-label={pinLabel} title={pinLabel} aria-pressed={pinned} onClick={() => onPinChange?.(!pinned)}>
          {pinned ? <PinOff size={14} strokeWidth={1.75} aria-hidden /> : <Pin size={14} strokeWidth={1.75} aria-hidden />}
        </Button>
      </div>
      {total > TOC_FILTER_MIN ? (
        <div className="reader-toc-filter">
          <Search size={13} aria-hidden />
          <Input
            size="sm"
            className="reader-toc-filter-input"
            value={query}
            placeholder="过滤章节标题或节号…"
            aria-label="过滤目录"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              // 别让阅读页的快捷键（翻页、缩放）吃掉打的字。
              event.stopPropagation();
              if (event.key === "Escape") {
                if (query) setQuery("");
                else {
                  event.currentTarget.blur();
                  if (pinned && !docked) onPinChange?.(false);
                }
              }
            }}
          />
          {query ? (
            <Button className="reader-toc-filter-clear" aria-label="清掉" onClick={() => setQuery("")}>
              <X size={12} aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="reader-toc-list" ref={list}>
        {shown.length ? shown.map((chapter) => {
          const isOpen = filtering || expanded.has(chapter.id);
          return (
            <div key={chapter.id} className="reader-toc-chapter">
              <div className="reader-toc-chapter-row">
                {chapter.children.length ? (
                  <Button
                    className="reader-toc-caret"
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? "收起" : "展开"}「${chapter.title}」`}
                    onClick={() => toggle(chapter.id)}
                  >
                    {isOpen ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
                  </Button>
                ) : <span className="reader-toc-caret-space" />}
                {row(chapter, chapter.id)}
              </div>
              {isOpen ? chapter.children.map((child) => <div key={child.id}>{row(child, chapter.id)}</div>) : null}
            </div>
          );
        }) : <p className="reader-toc-empty">没有匹配的章节</p>}
      </div>
    </>
  );

  if (docked) {
    return (
      <nav className="reader-toc-dock" aria-label="目录">
        {content}
      </nav>
    );
  }
  return (
    <nav
      className="reader-toc-minimap"
      aria-label="目录"
      data-pinned={pinned ? "true" : undefined}
      onPointerEnter={pinned ? undefined : open}
      onKeyDown={(event) => {
        if (pinned && event.key === "Escape") onPinChange?.(false);
      }}
      // 只在焦点从外面进来时算「打开」（在卡片里 Tab 来 Tab 去不再滚回当前节）。
      onFocus={(event) => {
        if (!pinned && !event.currentTarget.contains(event.relatedTarget as Node | null)) open();
      }}
    >
      <div className="reader-toc-bars" tabIndex={0} aria-label={`目录，${total} 条（移上去或按 Tab 展开）`}>
        {bars.map((bar) => <span key={bar.id} className="reader-toc-bar" data-kind={bar.kind} data-state={bar.state || undefined} aria-hidden />)}
      </div>
      <div className="reader-toc-card" data-compact={total <= TOC_FILTER_MIN ? "true" : undefined}>
        {content}
      </div>
    </nav>
  );
}
