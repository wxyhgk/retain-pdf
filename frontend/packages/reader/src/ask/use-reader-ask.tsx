// 阅读页提问接到阅读页上的那一层（扩展 ask/ReaderAskExtension 只调这一个，2026-11-27 起经贡献表接进阅读页）：
// - 问的是哪儿：右键（「在这里提问 / 问这段」）、选着书页上的字按 ?；窗口开着时在书页上选字，下一问就带上它（不弹任何东西）。
// - 书页上的「?」（use-ask-marks）：主对话里的点了打开主对话，以前按书存的只读地看。
// - 提问窗（ReaderAskPanel，第一次提问才加载）。
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { ImagePlus } from "lucide-react";
import type { AskAttachTool, AskContextOffer } from "@retainpdf/ask";

import type { ReaderAskAnchor, ReaderAskMessage, ReaderAskPort } from "../contracts/ask.js";
import type { ReaderMenuContext, ReaderMenuItem } from "../extensions/types.js";
import type { PdfOutlineNode } from "../pdf/pdf-outline.js";
import { READER_PAGE_ATTR, READER_PANE_ATTR } from "../pdf/reader-dom-contract.js";
import type { RegionFraction, RegionPdfDocument } from "../pdf/RegionCanvas.js";
import { FULL_PAGE, cropCanvasImage, regionImageName, renderRegionImage } from "../pdf/region-image.js";
import { projectReaderRegion, resolveReaderRegionHighlight, type ReaderMetadata, type ReaderRegion } from "../shared/data/reader-regions.js";
import { isEditableReaderBlock } from "../shared/data/block-edit.js";
import { buildAskAnchor, selectedPageText } from "./anchor.js";
import { ReaderAskCrop, type AskCropResult } from "./ReaderAskCrop.js";
import type { AskMark } from "./ReaderAskMarks.js";
import { MAX_EXTRAS, useAskConversation } from "./use-ask-conversation.js";
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
  editBlock,
  jumpToBlock,
  pdfDocuments,
  currentPage,
  visibleMode,
  activePanel = null,
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
  /** 改这一块的译文（这本书现在不能改是 null）。 */
  editBlock: ((itemId: string, draft?: string) => void) | null;
  jumpToBlock: (itemId: string, pane?: "source" | "translated") => void;
  /** 各栏读好的 PDF（截图按要的清晰度重新画）。 */
  pdfDocuments: { source: RegionPdfDocument | null; translated: RegionPdfDocument | null };
  currentPage: () => number;
  visibleMode: "source" | "compare" | "translated";
  /** 阅读页右边停着的面板（Markdown）；停上了提问窗就不贴右边（右边只停一个）。 */
  activePanel?: string | null;
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

  // 窗口开着时在书页上选字：还没带出处就带上它；已经带着一处（右键选好的、之前选的）不悄悄换掉（2026-11-27 用户：
  // 想复制别处一个词、查个词，出处就跳了），输入框上面问一句「换成这段 / 再加一段」。发出去的、不要的那段不再冒出来。
  const used = useRef(new Set<string>());
  const pendingText = ask.pending?.selection || "";
  useEffect(() => {
    if (pendingText) used.current.add(pendingText);
  }, [pendingText]);
  const watching = ask.visible && !legacy;
  const setPending = ask.setPending;
  const [offer, setOffer] = useState<ReaderAskAnchor | null>(null);
  const hasPending = Boolean(ask.pending);
  useEffect(() => {
    if (!hasPending) setOffer(null);
  }, [hasPending]);
  const pendingNow = useRef(ask.pending);
  pendingNow.current = ask.pending;
  useEffect(() => {
    if (!watching) return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onChange = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const anchor = selectionAnchor();
        if (!anchor || used.current.has(anchor.selection)) return;
        if (pendingNow.current) setOffer(anchor);
        else setPending(anchor);
      }, 250);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("selectionchange", onChange);
    };
  }, [watching, selectionAnchor, setPending]);

  const addExtra = ask.addExtra;
  const extraCount = ask.extras.length;
  const contextOffer = useMemo<AskContextOffer | null>(() => {
    if (!offer) return null;
    const forget = () => {
      used.current.add(offer.selection);
      setOffer(null);
    };
    return {
      label: `第 ${offer.page} 页 · ${[...offer.selection].length} 字`,
      replace: () => {
        forget();
        setPending(offer);
      },
      ...(extraCount < MAX_EXTRAS ? { add: () => {
        forget();
        addExtra(offer);
      } } : {}),
      dismiss: forget,
    };
  }, [offer, extraCount, setPending, addExtra]);

  // 截图带进提问（2026-11-27）：输入框那一行「带上这一页」、右键「截一块问」。有这一栏的 pdf.js 文档就重新画（清楚），
  // 没有就从屏幕上那张画布裁。
  const docs = useRef(pdfDocuments);
  docs.current = pdfDocuments;
  const capture = useCallback(async ({ page, pane, region, canvas }: { page: number; pane: "source" | "translated"; region: RegionFraction; canvas?: HTMLCanvasElement | null }) => {
    const pdf = docs.current[pane];
    let blob: Blob;
    if (pdf) {
      blob = await renderRegionImage(pdf, page, region);
    } else {
      const onScreen = canvas ?? document.querySelector<HTMLCanvasElement>(`[${READER_PANE_ATTR}="${pane}"] [${READER_PAGE_ATTR}="${page}"] canvas`);
      if (!onScreen) throw new Error(`第 ${page} 页还没画出来，翻到那一页再试`);
      blob = await cropCanvasImage(onScreen, region);
    }
    return new File([blob], regionImageName(page, region), { type: "image/png" });
  }, []);
  const [attachRequest, setAttachRequest] = useState<{ id: number; files: File[] } | null>(null);
  const pendingRef = useRef(ask.pending);
  pendingRef.current = ask.pending;
  const attachTools = useMemo<AskAttachTool[]>(() => [{
    key: "page",
    label: "带上这一页",
    title: "带上这一页的截图（问的那一页，没有就是现在读的这页）：公式、图表、表格让 AI 直接看图",
    icon: <ImagePlus size={14} aria-hidden />,
    run: () => {
      const pending = pendingRef.current;
      const pane = pending?.pane || (visibleMode === "translated" ? "translated" : "source");
      return capture({ page: pending?.page || currentPage() || 1, pane, region: FULL_PAGE });
    },
  }], [capture, currentPage, visibleMode]);
  const [cropping, setCropping] = useState(false);
  const [cropError, setCropError] = useState("");
  const onCrop = useCallback(async (result: AskCropResult) => {
    setCropping(false);
    setCropError("");
    try {
      const file = await capture(result);
      const anchor = anchorAt(result.point.target, result.point.x, result.point.y, "");
      setAttachRequest((current) => ({ id: (current?.id || 0) + 1, files: [file] }));
      if (anchor) openAsk({ ...anchor, itemId: null, sourceText: "", translatedText: "" });
      else void ask.openMain();
    } catch (failure) {
      setCropError(failure instanceof Error ? failure.message : String(failure));
    }
  }, [capture, anchorAt, openAsk]); // eslint-disable-line react-hooks/exhaustive-deps
  const cancelCrop = useCallback(() => setCropping(false), []);
  // 底栏右边的「截图」和右键「截一块问」都从这里开始框选；再点一下收起。
  const toggleCrop = useCallback(() => {
    setCropError("");
    setCropping((value) => !value);
  }, []);

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
    }, {
      key: "crop",
      label: "截一块问",
      onSelect: () => {
        setCropError("");
        setCropping(true);
      },
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
  // 回答底下的「改这段译文」：先打开编辑框（只开着原文时会切到对照），排好版再跳到那一块。
  const onEditBlock = useMemo(() => (editBlock ? (itemId: string, draft: string | null) => {
    editBlock(itemId, draft ?? undefined);
    requestAnimationFrame(() => jumpToBlock(itemId, "translated"));
  } : null), [editBlock, jumpToBlock]);
  const canEditBlock = useCallback((itemId: string) => isEditableReaderBlock(regions, itemId), [regions]);

  // 提问窗贴右边：书页让出那么宽（不盖住正在读的字）。窄屏（让了以后书页不到 480px）不让，照旧盖在上面。
  const [docked, setDocked] = useState(0);
  const onLayout = useCallback(({ mode, width }: { mode: string; width: number }) => {
    const viewport = globalThis.innerWidth || 0;
    setDocked(mode === "dock" && viewport - width >= 480 ? Math.round(width) : 0);
  }, []);
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
        onLayout={onLayout}
        dockTaken={activePanel !== null}
        onEditBlock={onEditBlock}
        canEditBlock={canEditBlock}
        attachTools={attachTools}
        attachRequest={attachRequest}
        contextOffer={contextOffer}
      />
    </Suspense>
  ) : null;
  const overlay: ReactElement | null = cropping || cropError ? (
    <>
      {cropping ? <ReaderAskCrop onDone={(result) => void onCrop(result)} onCancel={cancelCrop} /> : null}
      {cropError ? (
        <p className="reader-ask-crop-error" role="alert" onClick={() => setCropError("")}>截图没成：{cropError}</p>
      ) : null}
    </>
  ) : null;

  /** 底栏工具里的「提问」：开着就关，关着就打开这本书的主对话（不带出处，问整本书、翻以前的对话）。 */
  const showing = (ask.visible && ready) || Boolean(legacy);
  const closeAsk = ask.close;
  const toggle = useCallback(() => {
    if (showing) {
      setLegacy(null);
      closeAsk();
      return;
    }
    void ask.openMain();
  }, [showing, closeAsk, ask.openMain]); // eslint-disable-line react-hooks/exhaustive-deps

  return { marks: marks.marks, onMark, menuItems, panel, overlay, cropping, toggleCrop, open: ask.openMain, toggle, showing, reserveRight: showing ? docked : 0, enabled: Boolean(port) };
}
