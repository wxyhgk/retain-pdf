// 书页区左缘的目录（2026-11-28 照原型 reader-prototype.html「适配百页大书的左侧 Minimap 目录」）：
// 平时只是一排极淡的短横线（章长、节短，当前节墨色、当前章深灰）；鼠标移上去（或键盘 Tab 到）换成目录卡，
// 当前章展开、别的章收着（▸ / ▾），页码只在悬停和当前那一行出；条目多（> 15）时卡片顶上有过滤框，光标在框里时卡片不收。
// 以前目录是左栏的一个页签（11-27），要先点开左栏再切页签，还占着左边 300px。
// 数据（章 + 节、眼下在哪、画哪几根）在 shared/content/reader-toc.ts。
import { useLayoutEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { Button, Input } from "@retainpdf/ui";

import type { PdfOutlineNode } from "../../pdf/pdf-outline.js";
import { readerOutline } from "../../shared/content/reader-find.js";
import { filterToc, readerToc, tocBars, tocCurrent, tocSize, TOC_FILTER_MIN, type ReaderTocNode } from "../../shared/content/reader-toc.js";
import { useReaderContext, useReaderHudContext } from "./reader-context.js";

const NO_REGIONS: never[] = [];

export function ReaderTocMinimap({ bookmarks, onJumpPage, onJumpBlock }: {
  /** PDF 自带的书签（有就按它列）。 */
  bookmarks: readonly PdfOutlineNode[];
  onJumpPage: (page: number) => void;
  /** 按标题来的目录跳到那一块。 */
  onJumpBlock: (itemId: string) => void;
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

  return (
    <nav
      className="reader-toc-minimap"
      aria-label="目录"
      onPointerEnter={open}
      // 只在焦点从外面进来时算「打开」（在卡片里 Tab 来 Tab 去不再滚回当前节）。
      onFocus={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) open();
      }}
    >
      <div className="reader-toc-bars" tabIndex={0} aria-label={`目录，${total} 条（移上去或按 Tab 展开）`}>
        {bars.map((bar) => <span key={bar.id} className="reader-toc-bar" data-kind={bar.kind} data-state={bar.state || undefined} aria-hidden />)}
      </div>
      <div className="reader-toc-card" data-compact={total <= TOC_FILTER_MIN ? "true" : undefined}>
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
                  else event.currentTarget.blur();
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
      </div>
    </nav>
  );
}
