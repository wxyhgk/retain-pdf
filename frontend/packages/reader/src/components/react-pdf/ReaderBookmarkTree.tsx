// 目录卡里的「书签」：PDF 自带的目录，多级、能折叠（pdf/pdf-outline.ts 读出来的树）。
// 打开时眼下这一节和它的上级都展开、滚到眼前；其余默认收着，长书先看到一列章。点一条跳到那一页。

import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@retainpdf/ui";

import { ancestorIds, currentBookmark, type PdfOutlineNode } from "../../pdf/pdf-outline.js";

export function ReaderBookmarkTree({
  nodes,
  currentPage,
  onJumpPage,
}: {
  nodes: readonly PdfOutlineNode[];
  currentPage: number;
  onJumpPage: (page: number) => void;
}): ReactElement {
  const here = useMemo(() => currentBookmark(nodes, currentPage), [nodes, currentPage]);
  // 展开哪些：只在打开（或换了书签树）时按眼下这一节定一次，之后由读者自己点。
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([...ancestorIds(here), ...(here ? [here] : [])]));
  useEffect(() => {
    setExpanded(new Set([...ancestorIds(here), ...(here ? [here] : [])]));
    // 只跟着书签树换，不跟着翻页换（翻页时不替读者开合）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);
  const list = useRef<HTMLOListElement | null>(null);
  useEffect(() => {
    list.current?.querySelector('[aria-current="location"]')?.scrollIntoView({ block: "center" });
  }, [nodes]);

  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const render = (items: readonly PdfOutlineNode[]): ReactElement[] => items.map((node) => {
    const open = expanded.has(node.id);
    const hasChildren = node.children.length > 0;
    return (
      <li key={node.id} className="reader-bookmark" data-level={node.level}>
        <div className="reader-bookmark-row">
          {hasChildren ? (
            <Button
              className={`reader-bookmark-toggle${open ? " is-open" : ""}`}
              aria-label={open ? `收起「${node.title}」` : `展开「${node.title}」`}
              aria-expanded={open}
              onClick={() => toggle(node.id)}
            >
              <ChevronRight size={14} strokeWidth={2.2} aria-hidden />
            </Button>
          ) : <span className="reader-bookmark-spacer" aria-hidden="true" />}
          <Button
            className="reader-finder-entry reader-bookmark-entry"
            data-level={node.level}
            aria-current={node.id === here ? "location" : undefined}
            disabled={node.page === null}
            title={node.page === null ? "这条书签没有指到页" : `${node.title} · 第 ${node.page} 页`}
            onClick={() => node.page !== null && onJumpPage(node.page)}
          >
            <span className="reader-finder-entry-text">{node.title}</span>
            {node.page !== null ? <span className="reader-finder-entry-page">{node.page}</span> : null}
          </Button>
        </div>
        {hasChildren && open ? <ol className="reader-bookmark-children">{render(node.children)}</ol> : null}
      </li>
    );
  });

  return <ol ref={list} className="reader-finder-list reader-bookmark-tree" aria-label="书签">{render(nodes)}</ol>;
}
