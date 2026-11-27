// 阅读页提问接到阅读页上的那一层（扩展 ask/ReaderAskExtension 只调这一个，2026-11-27 起经贡献表接进阅读页）：
// - 问的是哪儿：右键（「在这里提问 / 问这段」）、选着书页上的字按 ?；窗口开着时在书页上选字，下一问就带上它（不弹任何东西）。
// - 书页上的「?」（use-ask-marks）：主对话里的点了打开主对话，以前按书存的只读地看。
// - 提问窗（ReaderAskPanel，第一次提问才加载）。
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";

import type { ReaderAskAnchor, ReaderAskMessage, ReaderAskPort } from "../contracts/ask.js";
import type { ReaderMenuContext, ReaderMenuItem } from "../extensions/types.js";
import type { PdfOutlineNode } from "../pdf/pdf-outline.js";
import { READER_PAGE_ATTR } from "../pdf/reader-dom-contract.js";
import { projectReaderRegion, resolveReaderRegionHighlight, type ReaderMetadata, type ReaderRegion } from "../shared/data/reader-regions.js";
import { buildAskAnchor, selectedPageText } from "./anchor.js";
import type { AskMark } from "./ReaderAskMarks.js";
import { useAskConversation } from "./use-ask-conversation.js";
import { useAskMarks } from "./use-ask-marks.js";

const ReaderAskPanel = lazy(() => import("./ReaderAskPanel.js"));

type Legacy = { anchor: ReaderAskAnchor; messages: readonly ReaderAskMessage[]; mark: AskMark };

export function useReaderAsk({
  port,
  documentId,
  jobId,
  versionId,
  regions,
  metadata,
  bookmarks,
  hoveredItemId,
  resetKey,
  goToPage,
  pageCount,
}: {
  port: ReaderAskPort | null;
  documentId: string;
  jobId: string;
  versionId: string | null;
  regions: readonly ReaderRegion[];
  metadata: ReaderMetadata | null;
  bookmarks: readonly PdfOutlineNode[];
  /** 悬停框现在认出的块。 */
  hoveredItemId: () => string | null;
  resetKey: string;
  goToPage: (page: number, pane?: "source" | "translated") => void;
  pageCount: number;
}) {
  const book = useMemo(() => ({ documentId, jobId, versionId }), [documentId, jobId, versionId]);
  const pointOf = useCallback((itemId: string | null, pane: "source" | "translated", page: number) => {
    const region = itemId ? regions.find((entry) => entry.itemId === itemId) : null;
    const highlight = region ? resolveReaderRegionHighlight(region, metadata, pane) : null;
    const rect = highlight && highlight.box.page === page ? projectReaderRegion(highlight, 1, 1) : null;
    return rect ? { x: rect.left, y: rect.top } : null;
  }, [regions, metadata]);
  const marks = useAskMarks({ port, documentId, resetKey, pointOf });
  const ask = useAskConversation({ port, book, onAppended: marks.addRecords });
  const [legacy, setLegacy] = useState<Legacy | null>(null);

  const anchorAt = useCallback(
    (target: Element | null, clientX: number, clientY: number, selection: string) => buildAskAnchor({
      pageElement: target?.closest(`[${READER_PAGE_ATTR}]`) ?? null,
      clientX,
      clientY,
      itemId: hoveredItemId(),
      selection,
      regions,
      bookmarks,
      metadata,
    }),
    [hoveredItemId, regions, bookmarks, metadata],
  );
  /** 现在书页上选着的字 → 出处；没选着是 null。 */
  const selectionAnchor = useCallback(() => {
    const picked = selectedPageText(globalThis.getSelection?.() ?? null);
    if (!picked.text || !picked.element || !picked.rect) return null;
    return anchorAt(picked.element, picked.rect.left + picked.rect.width / 2, picked.rect.top + picked.rect.height / 2, picked.text);
  }, [anchorAt]);

  const openAsk = useCallback((anchor: ReaderAskAnchor) => {
    setLegacy(null);
    ask.ask(anchor);
  }, [ask.ask]); // eslint-disable-line react-hooks/exhaustive-deps

  // 选着书页上的字按 ? → 问这段。只在选着字时拦（不然 ? 照旧是快捷键帮助），捕获阶段先拿到、拦下帮助。
  useEffect(() => {
    if (!port) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "?" || event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("input, textarea, select, [contenteditable='true']")) return;
      const anchor = selectionAnchor();
      if (!anchor) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openAsk(anchor);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [port, selectionAnchor, openAsk]);

  // 窗口开着时在书页上选字：下一问带上它（发出去的那段不再带第二次）。
  const used = useRef("");
  const pendingText = ask.pending?.selection || "";
  useEffect(() => {
    if (pendingText) used.current = pendingText;
  }, [pendingText]);
  const watching = ask.visible && !legacy;
  const setPending = ask.setPending;
  useEffect(() => {
    if (!watching) return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onChange = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const anchor = selectionAnchor();
        if (anchor && anchor.selection !== used.current) setPending(anchor);
      }, 250);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("selectionchange", onChange);
    };
  }, [watching, selectionAnchor, setPending]);

  const onMark = useCallback(async (mark: AskMark) => {
    if (mark.threadId && port?.threads && documentId) {
      try {
        const thread = await port.threads.get(documentId, mark.threadId);
        setLegacy({ anchor: thread.anchor || mark.anchor, messages: thread.messages || [], mark });
      } catch {
        setLegacy({ anchor: mark.anchor, messages: [], mark });
      }
      return;
    }
    setLegacy(null);
    void ask.openMain();
  }, [port, documentId, ask.openMain]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 右键菜单里的「在这里提问 / 问这段」：右键那一下就记下问的是哪儿（选着书页上的字就问这段）。 */
  const menuItems = useCallback((context: ReaderMenuContext): ReaderMenuItem[] => {
    if (!port) return [];
    const picked = selectedPageText(globalThis.getSelection?.() ?? null);
    const anchor = anchorAt(context.target, context.clientX, context.clientY, picked.element ? picked.text : "");
    return anchor ? [{
      key: "ask",
      label: anchor.selection ? "问这段" : "在这里提问",
      hint: anchor.selection ? "?" : undefined,
      onSelect: () => openAsk(anchor),
    }] : [];
  }, [port, anchorAt, openAsk]);

  const legacyView = legacy ? {
    anchor: legacy.anchor,
    messages: legacy.messages,
    onClose: () => setLegacy(null),
    onDelete: port?.threads && legacy.mark.threadId ? () => {
      void port.threads!.remove(documentId, legacy.mark.threadId!).catch(() => {});
      marks.removeMark(legacy.mark.key);
      setLegacy(null);
    } : undefined,
  } : null;
  // 主对话还没读回来时先不画窗口：不然先画一个空窗口、开一个会话，读回来换成主对话又重开一个（白开一个会话，11-27 真机看到）。
  const ready = !ask.persistent || Boolean(ask.view.conversation) || Boolean(ask.error);
  const panel: ReactElement | null = port && ((ask.visible && ready) || legacy) ? (
    <Suspense fallback={null}>
      <ReaderAskPanel
        port={port}
        jobId={jobId}
        book={book}
        ask={ask}
        legacy={legacyView}
        onShowSelection={({ page, pane }) => goToPage(page, pane)}
        onJumpToPage={(page) => goToPage(page)}
        pageCount={pageCount}
      />
    </Suspense>
  ) : null;

  return { marks: marks.marks, onMark, menuItems, panel, open: ask.openMain, enabled: Boolean(port) };
}
