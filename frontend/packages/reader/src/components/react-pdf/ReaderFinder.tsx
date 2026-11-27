// 阅读页的左栏：目录、搜索、书签、待处理四个页签（2026-11-27 起；以前只有目录、搜索，书签和待处理是底栏的两个弹出框）。
// 目录是这本书的标题块，搜索在每块的原文和译文里找（shared/content/reader-find.ts），点一条按块跳过去。
// 以前这两样只在 Markdown 面板里，PDF 这边几百页只能输页码跳。
//
// 搜索词由阅读页持有（ReaderAppReactPdf）：防抖后的词同时给这里列命中、给书页文字层标出命中（PdfPageSlot）。
// 回车 / Shift+回车在命中之间走（「第 i / n 处」），Esc 收起。Cmd/Ctrl+F 由阅读页接住打开这里。
// 默认浮在书页上（2026-11-20 起）：点卡外（顶栏那颗按钮除外，它自己管开关）、按 Esc 收起。
// 栏头「钉住」以后是左边一整栏（data-pinned），书页区让位，点书、Esc 都不收（2026-11-27）。
import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { ListTree, Pin, PinOff, Search, X } from "lucide-react";
import { Button, Input } from "@retainpdf/ui";

import { currentOutlineIndex, readerOutline, searchReaderRegions, stepFindHit } from "../../shared/content/reader-find.js";
import type { PdfOutlineNode } from "../../pdf/pdf-outline.js";
import { ReaderBookmarkTree } from "./ReaderBookmarkTree.js";
import { useReaderContext, useReaderHudContext } from "./reader-context.js";

export type ReaderFinderTab = "outline" | "search" | "bookmarks" | "issues";

const TAB_TITLES: Record<ReaderFinderTab, string> = { outline: "目录", search: "搜索", bookmarks: "书签", issues: "待处理" };

const NO_REGIONS: never[] = [];
const NO_BOOKMARKS: PdfOutlineNode[] = [];

/** 目录按什么列：PDF 自带的书签，还是 OCR 认出的标题。 */
type OutlineSource = "bookmarks" | "headings";

/** 顶栏左边那颗（只有图标，名字在悬停里）：开 / 收左栏，开的是上次那一页签。待处理有几处时角上带个数。
 *  children 跟在后面（以前放「对比版本」，2026-11-20 挪进右下角的悬浮小球）。 */
export function ReaderFinderToggles({
  open,
  onToggle,
  issueCount = 0,
  children,
}: {
  open: ReaderFinderTab | null;
  onToggle: () => void;
  /** 待处理几处（0 不画角标）。 */
  issueCount?: number;
  children?: ReactNode;
}): ReactElement {
  const title = `目录、搜索、书签${issueCount ? `、待处理 ${issueCount} 处` : ""}（⌘F 搜索）`;
  return (
    <div className="reader-finder-toggles">
      <Button className="reader-finder-toggle" aria-label="左栏：目录、搜索、书签" aria-pressed={Boolean(open)} title={title} onClick={onToggle}>
        <ListTree size={17} strokeWidth={2.1} aria-hidden />
        {issueCount ? <span className="reader-finder-toggle-badge" aria-label={`待处理 ${issueCount} 处`}>{issueCount}</span> : null}
      </Button>
      {children}
    </div>
  );
}

/** 「搜索」开关（2026-11-20 在底栏；2026-11-27 起底栏不放了，搜索在左栏的页签里、⌘F）。留着给宿主自己摆。 */
export function ReaderSearchToggle({ open, onToggle }: { open: ReaderFinderTab | null; onToggle: (tab: ReaderFinderTab) => void }): ReactElement {
  return (
    <Button
      className="reader-react-hud-btn reader-search-toggle"
      data-finder-toggle="search"
      aria-label="在书里搜索"
      aria-pressed={open === "search"}
      title="在书里搜索（原文和译文，⌘F）"
      onClick={() => onToggle("search")}
    >
      <Search size={15} strokeWidth={2.1} aria-hidden />
    </Button>
  );
}

/** 块从阅读页的 context 来，眼下的页（目录里标出在哪一节）从 HUD context 来。 */
export function ReaderFinder({
  tab,
  onTab,
  onClose,
  onJump,
  query,
  onQuery,
  term,
  focusSignal = 0,
  bookmarks = NO_BOOKMARKS,
  onJumpPage,
  pinned = false,
  onPin,
  bookmarkPane,
  issuesPane,
  issueCount = 0,
}: {
  tab: ReaderFinderTab;
  onTab: (tab: ReaderFinderTab) => void;
  onClose: () => void;
  onJump: (itemId: string) => void;
  /** 输入框里的字（每敲一下就变）。 */
  query: string;
  onQuery: (query: string) => void;
  /** 防抖后的搜索词：列命中、书页标命中都按它，不每敲一下就扫全书。 */
  term: string;
  /** 每变一次把光标放回搜索框（Cmd/Ctrl+F 在左栏已经开着时）。 */
  focusSignal?: number;
  /** PDF 自带的书签（有就默认按书签看目录）。 */
  bookmarks?: readonly PdfOutlineNode[];
  /** 点书签：跳到那一页。 */
  onJumpPage?: (page: number) => void;
  /** 钉在左边（书页区让位）：点书、Esc 都不收。 */
  pinned?: boolean;
  /** 栏头的「钉住 / 不钉」；不给就没有这颗（窄屏钉不住）。 */
  onPin?: (pinned: boolean) => void;
  /** 「书签」页签的内容（ReaderBookmarkList）；不给就没有这个页签。 */
  bookmarkPane?: ReactNode;
  /** 「待处理」页签的内容（ReaderIssueList）；没有待处理时不给，就没有这个页签。 */
  issuesPane?: ReactNode;
  issueCount?: number;
}): ReactElement {
  const regions = useReaderContext()?.regions ?? NO_REGIONS;
  const currentPage = useReaderHudContext()?.currentPage ?? 1;
  const outline = useMemo(() => readerOutline(regions), [regions]);
  // 有书签就默认按书签看；两样都有时卡片上能切。
  const hasBookmarks = bookmarks.length > 0 && Boolean(onJumpPage);
  const [outlineSource, setOutlineSource] = useState<OutlineSource>("bookmarks");
  const showBookmarks = hasBookmarks && (outlineSource === "bookmarks" || !outline.length);
  const here = currentOutlineIndex(outline, currentPage);
  const hits = useMemo(() => searchReaderRegions(regions, term), [regions, term]);
  // 回车走到的那一处；换了词从头来。
  const [active, setActive] = useState(-1);
  useEffect(() => setActive(-1), [term]);
  const input = useRef<HTMLInputElement | null>(null);
  const card = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    // 钉住的栏不因为点别处、按 Esc 收起（只有栏头的 × 和顶栏那颗收）。
    if (pinned) return undefined;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target || card.current?.contains(target) || target.closest?.(".reader-finder-toggles, [data-finder-toggle]")) return;
      closeRef.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [pinned]);
  const list = useRef<HTMLOListElement | null>(null);
  useEffect(() => {
    if (tab === "search") input.current?.focus();
    // 打开目录：眼下这一节滚到眼前（长目录里它常在下面）。
    else list.current?.querySelector('[aria-current="location"]')?.scrollIntoView({ block: "center" });
  }, [tab, focusSignal]);
  useEffect(() => {
    if (tab === "search" && active >= 0) list.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest" });
  }, [tab, active]);
  const goTo = (index: number) => {
    const hit = hits[index];
    if (!hit) return;
    setActive(index);
    onJump(hit.itemId);
  };

  const tabs: ReaderFinderTab[] = ["outline", "search", ...(bookmarkPane ? ["bookmarks" as const] : []), ...(issuesPane ? ["issues" as const] : [])];
  // 开着的页签没了（待处理都处理完了）：看目录。
  const shown: ReaderFinderTab = tabs.includes(tab) ? tab : "outline";

  return (
    <aside ref={card} className="reader-finder" data-finder-tab={shown} data-pinned={pinned ? "true" : undefined} aria-label={`左栏：${TAB_TITLES[shown]}`}>
      <header className="reader-finder-head">
        <div className="reader-finder-tabs" role="tablist">
          {tabs.map((id) => (
            <Button key={id} className="reader-finder-tab" role="tab" aria-selected={shown === id} onClick={() => onTab(id)}>
              {TAB_TITLES[id]}
              {id === "issues" && issueCount ? <span className="reader-finder-tab-count">{issueCount}</span> : null}
            </Button>
          ))}
        </div>
        {onPin ? (
          <Button
            className="reader-finder-close reader-finder-pin"
            aria-pressed={pinned}
            aria-label={pinned ? "不钉了，浮在书上" : "钉在左边"}
            title={pinned ? "不钉了：浮在书上，点别处收起" : "钉在左边：书页往右让，一直开着"}
            onClick={() => onPin(!pinned)}
          >
            {pinned ? <PinOff size={15} strokeWidth={2.1} aria-hidden /> : <Pin size={15} strokeWidth={2.1} aria-hidden />}
          </Button>
        ) : null}
        <Button className="reader-finder-close" aria-label="收起" title="收起" onClick={onClose}>
          <X size={16} strokeWidth={2.1} aria-hidden />
        </Button>
      </header>
      {shown === "bookmarks" ? bookmarkPane : shown === "issues" ? issuesPane : null}
      {shown === "outline" && hasBookmarks && outline.length ? (
        <div className="reader-finder-switch" role="radiogroup" aria-label="目录按什么列">
          <Button className="reader-finder-switch-option" role="radio" aria-checked={showBookmarks} onClick={() => setOutlineSource("bookmarks")}>按 PDF 目录</Button>
          <Button className="reader-finder-switch-option" role="radio" aria-checked={!showBookmarks} onClick={() => setOutlineSource("headings")}>按标题</Button>
        </div>
      ) : null}
      {shown === "outline" && showBookmarks && onJumpPage ? (
        <ReaderBookmarkTree nodes={bookmarks} currentPage={currentPage} onJumpPage={onJumpPage} />
      ) : shown === "outline" ? (
        outline.length ? (
          <ol ref={list} className="reader-finder-list">
            {outline.map((entry, index) => (
              <li key={entry.itemId}>
                <Button
                  className="reader-finder-entry"
                  data-level={entry.level}
                  aria-current={index === here ? "location" : undefined}
                  onClick={() => onJump(entry.itemId)}
                >
                  <span className="reader-finder-entry-text">{entry.text}</span>
                  <span className="reader-finder-entry-page">{entry.page}</span>
                </Button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="reader-finder-empty">{regions.length ? "这本书没有认出标题。" : "这本书还没有段落数据。"}</p>
        )
      ) : shown !== "search" ? null : (
        <>
          <div className="reader-finder-search">
            <Input
              ref={input}
              type="search"
              size="sm"
              className="reader-finder-input"
              placeholder="原文、译文里的字"
              aria-label="在书里搜索"
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  goTo(stepFindHit(active, hits.length, event.shiftKey));
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  // 钉住的栏不收，只把光标交还给书。
                  if (pinned) event.currentTarget.blur();
                  else onClose();
                }
                // 别让阅读页的快捷键（翻页、缩放）吃掉打的字。
                event.stopPropagation();
              }}
            />
            {term ? (
              <p className="reader-finder-count" aria-live="polite">
                {hits.length === 0
                  ? "没有找到"
                  : `${active >= 0 ? `第 ${active + 1} / ` : ""}${hits.length >= 200 ? "200+ 处，只列前 200 处" : `${hits.length} 处`}${active < 0 ? "，回车跳到第一处" : ""}`}
              </p>
            ) : null}
          </div>
          <ol className="reader-finder-list">
            {hits.map((hit, index) => (
              <li key={hit.itemId}>
                <Button className="reader-finder-entry is-hit" aria-current={index === active ? "true" : undefined} onClick={() => goTo(index)}>
                  <span className="reader-finder-entry-text">
                    {hit.snippet.slice(0, hit.at)}
                    <mark>{hit.snippet.slice(hit.at, hit.at + hit.length)}</mark>
                    {hit.snippet.slice(hit.at + hit.length)}
                  </span>
                  <span className="reader-finder-entry-page">{hit.page}</span>
                </Button>
              </li>
            ))}
          </ol>
        </>
      )}
    </aside>
  );
}
