// 阅读页的左栏：搜索、书签、待处理（2026-11-28 照原型 reader-prototype.html：目录挪去书页区左缘的 ReaderTocMinimap，
// 左栏只管「找」——搜索在每块的原文和译文里找（shared/content/reader-find.ts），点一条按块跳过去）。
//
// 搜索词由阅读页持有（ReaderAppReactPdf）：防抖后的词同时给这里列命中、给书页文字层标出命中（PdfPageSlot）。
// 回车 / Shift+回车在命中之间走（「第 i / n 处」），Esc 收起。Cmd/Ctrl+F 由阅读页接住打开这里。
// 摆法（2026-11-28）：屏够宽时是中间工作区最左边实占的一栏（data-pinned），点书、Esc 都不收，只有 × 和顶栏开关收；
// 窄屏没地方，浮在书页上，点卡外、按 Esc 收起。以前（11-27）默认浮着、栏头图钉钉住，原型里没有图钉，去掉了。
import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Button, Input } from "@retainpdf/ui";

import { searchReaderRegions, stepFindHit } from "../../shared/content/reader-find.js";
import { useReaderContext } from "./reader-context.js";

export type ReaderFinderTab = "search" | "bookmarks" | "issues";

const TAB_TITLES: Record<ReaderFinderTab, string> = { search: "搜索", bookmarks: "书签", issues: "待改" };

const NO_REGIONS: never[] = [];

/** 顶栏左段的「搜索」（照原型：放大镜 + 「搜索」+ 待改几处的灰数字）：开 / 收左栏，开的是上次那一页签。
 *  children 跟在后面（以前放「对比版本」，2026-11-20 挪进右下角的悬浮小球）。 */
export function ReaderFinderToggles({
  open,
  onToggle,
  issueCount = 0,
  children,
}: {
  open: ReaderFinderTab | null;
  onToggle: () => void;
  /** 待改几处（0 不写）。 */
  issueCount?: number;
  children?: ReactNode;
}): ReactElement {
  const title = `在全文搜索，书签${issueCount ? `、待改 ${issueCount} 处` : ""}（⌘F）`;
  return (
    <div className="reader-finder-toggles">
      <Button className="reader-finder-toggle" aria-label="左栏：搜索、书签、待改" aria-pressed={Boolean(open)} title={title} onClick={onToggle}>
        <Search size={14} strokeWidth={2.1} aria-hidden />
        <span className="reader-finder-toggle-label">搜索</span>
        {issueCount ? <span className="reader-finder-toggle-count" aria-label={`待改 ${issueCount} 处`}>{issueCount}</span> : null}
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
  pinned = false,
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
  /** 实占一栏（屏够宽时）：点书、Esc 都不收。不给是浮着（窄屏）。 */
  pinned?: boolean;
  /** 「书签」页签的内容（ReaderBookmarkList）；不给就没有这个页签。 */
  bookmarkPane?: ReactNode;
  /** 「待处理」页签的内容（ReaderIssueList）；没有待处理时不给，就没有这个页签。 */
  issuesPane?: ReactNode;
  issueCount?: number;
}): ReactElement {
  const regions = useReaderContext()?.regions ?? NO_REGIONS;
  const hits = useMemo(() => searchReaderRegions(regions, term), [regions, term]);
  // 回车走到的那一处；换了词从头来。
  const [active, setActive] = useState(-1);
  useEffect(() => setActive(-1), [term]);
  const input = useRef<HTMLInputElement | null>(null);
  const card = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    // 实占一栏时不因为点别处、按 Esc 收起（只有栏头的 × 和顶栏那颗收）。
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
  }, [tab, focusSignal]);
  useEffect(() => {
    if (tab === "search" && active >= 0) list.current?.querySelector('[aria-current="true"]')?.scrollIntoView?.({ block: "nearest" });
  }, [tab, active]);
  const goTo = (index: number) => {
    const hit = hits[index];
    if (!hit) return;
    setActive(index);
    onJump(hit.itemId);
  };

  const tabs: ReaderFinderTab[] = ["search", ...(bookmarkPane ? ["bookmarks" as const] : []), ...(issuesPane ? ["issues" as const] : [])];
  // 开着的页签没了（待改都改完了）：回到搜索。
  const shown: ReaderFinderTab = tabs.includes(tab) ? tab : "search";

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
        <Button className="reader-finder-close" aria-label="收起" title="收起" onClick={onClose}>
          <X size={16} strokeWidth={2.1} aria-hidden />
        </Button>
      </header>
      {shown === "bookmarks" ? bookmarkPane : shown === "issues" ? issuesPane : null}
      {shown !== "search" ? null : (
        <>
          <div className="reader-finder-search">
            <Input
              ref={input}
              type="search"
              size="sm"
              className="reader-finder-input"
              placeholder="搜原文或译文（⌘F）"
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
          <ol ref={list} className="reader-finder-list">
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
