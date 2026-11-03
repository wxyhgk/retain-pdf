// 阅读页左上的「目录」「搜索」和点开的左栏：目录是这本书的标题块，搜索在每块的原文和译文里找（shared/content/reader-find.ts），
// 点一条按块跳过去。以前这两样只在 Markdown 面板里，PDF 这边几百页只能输页码跳。
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { ListTree, Search, X } from "lucide-react";
import { Button, Input } from "@retainpdf/ui";

import { currentOutlineIndex, readerOutline, searchReaderRegions } from "../../shared/content/reader-find.js";
import { useReaderContext, useReaderHudContext } from "./reader-context.js";

export type ReaderFinderTab = "outline" | "search";

const NO_REGIONS: never[] = [];

/** 顶栏左边的两颗：点开左栏到那一页签，再点同一颗收起。 */
export function ReaderFinderToggles({ open, onToggle }: { open: ReaderFinderTab | null; onToggle: (tab: ReaderFinderTab) => void }): ReactElement {
  return (
    <div className="reader-finder-toggles">
      <Button className="reader-finder-toggle" aria-pressed={open === "outline"} title="目录" onClick={() => onToggle("outline")}>
        <ListTree size={16} strokeWidth={2.1} aria-hidden />
        <span>目录</span>
      </Button>
      <Button className="reader-finder-toggle" aria-pressed={open === "search"} title="在书里搜索（原文和译文）" onClick={() => onToggle("search")}>
        <Search size={16} strokeWidth={2.1} aria-hidden />
        <span>搜索</span>
      </Button>
    </div>
  );
}

/** 块从阅读页的 context 来，眼下的页（目录里标出在哪一节）从 HUD context 来。 */
export function ReaderFinder({
  tab,
  onTab,
  onClose,
  onJump,
}: {
  tab: ReaderFinderTab;
  onTab: (tab: ReaderFinderTab) => void;
  onClose: () => void;
  onJump: (itemId: string) => void;
}): ReactElement {
  const regions = useReaderContext()?.regions ?? NO_REGIONS;
  const currentPage = useReaderHudContext()?.currentPage ?? 1;
  const outline = useMemo(() => readerOutline(regions), [regions]);
  const here = currentOutlineIndex(outline, currentPage);
  const [query, setQuery] = useState("");
  const hits = useMemo(() => searchReaderRegions(regions, query), [regions, query]);
  const input = useRef<HTMLInputElement | null>(null);
  const list = useRef<HTMLOListElement | null>(null);
  useEffect(() => {
    if (tab === "search") input.current?.focus();
    // 打开目录：眼下这一节滚到眼前（长目录里它常在下面）。
    else list.current?.querySelector('[aria-current="location"]')?.scrollIntoView({ block: "center" });
  }, [tab]);

  return (
    <aside className="reader-finder" aria-label={tab === "outline" ? "目录" : "搜索"}>
      <header className="reader-finder-head">
        <div className="reader-finder-tabs" role="tablist">
          <Button className="reader-finder-tab" role="tab" aria-selected={tab === "outline"} onClick={() => onTab("outline")}>目录</Button>
          <Button className="reader-finder-tab" role="tab" aria-selected={tab === "search"} onClick={() => onTab("search")}>搜索</Button>
        </div>
        <Button className="reader-finder-close" aria-label="收起" title="收起" onClick={onClose}>
          <X size={16} strokeWidth={2.1} aria-hidden />
        </Button>
      </header>
      {tab === "outline" ? (
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
      ) : (
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
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && hits[0]) onJump(hits[0].itemId);
                // 别让阅读页的快捷键（翻页、缩放）吃掉打的字。
                event.stopPropagation();
              }}
            />
            {query.trim() ? <p className="reader-finder-count">{hits.length >= 200 ? "200 处以上，只列前 200 处" : `${hits.length} 处`}</p> : null}
          </div>
          <ol className="reader-finder-list">
            {hits.map((hit) => (
              <li key={hit.itemId}>
                <Button className="reader-finder-entry is-hit" onClick={() => onJump(hit.itemId)}>
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
