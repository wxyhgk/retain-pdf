// Composes full react-pdf reader logic (session → shell → panes → tools → HUD).

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useReaderSession } from "./use-reader-session.js";
import { useReaderKeyboard } from "./use-reader-keyboard.js";
import { useReaderShell } from "./use-reader-shell.js";
import { useReaderPaneModel } from "./use-reader-pane-model.js";
import { useReaderZoom } from "./use-reader-zoom.js";
import { useReaderTextSelection } from "./use-reader-text-selection.js";
import { useReaderModeNavigation } from "./use-reader-mode-navigation.js";
import { useReaderTools, type ReaderToolsApi } from "./use-reader-tools.js";
import { useCurrentPage } from "../pdf/useCurrentPage.js";
import { usePageRowSync } from "../pdf/usePageRowSync.js";
import { useReadingAnchor } from "../pdf/useReadingAnchor.js";
import { useUrlAnchorJump } from "./use-url-anchor-jump.js";
import type { PageRowHeights } from "../pdf/usePageRowSync.js";
import type { ReaderMode, ReaderSessionState } from "./use-reader-session.js";
import type { ProtectedPdfFile } from "../pdf/useProtectedPdfFile.js";
import type { ReaderPaneModel } from "./use-reader-pane-model.js";
import {
  findReaderRegion,
  findReaderRegionByAssetUrl,
  findReaderRegionByCitation,
  regionBoxForPane,
  type ReaderRegion,
  type ReaderSelection,
  type ReaderRegionSelection,
} from "../shared/data/reader-regions.js";
import { readerViewStateScope } from "../shared/state/reader-view-state.js";
import { useLiveTranslation } from "./use-live-translation.js";
import type { LiveTranslationState } from "../shared/data/live-translation-state.js";

export const CITATION_HIGHLIGHT_MS = 2000;

export type ReaderAnchorTarget = number | {
  page_idx?: number;
  page?: number;
  block_id?: string;
  image_url?: string;
  snippet?: string;
};

export type ReaderReactController = {
  session: ReaderSessionState;
  boot: ReaderSessionState["boot"];
  sourceOnly: boolean;
  mode: ReaderMode;
  userZoom: number;
  onZoomChange: (zoom: number) => void;
  shell: {
    bindShell: (node: HTMLDivElement | null) => void;
    shellEl: HTMLElement | null;
    shellWidth: number;
    compareColWidth: number;
    shellRef: RefObject<HTMLDivElement | null>;
  };
  panes: ReaderPaneModel;
  sessionFiles: {
    sourceUrl: string;
    translatedUrl: string;
    sourceFile: ProtectedPdfFile | null;
    translatedFile: ProtectedPdfFile | null;
  };
  rowHeights: PageRowHeights;
  currentPage: number;
  goToPage: (page: number) => void;
  activeRegion: ReaderRegion | null;
  jumpToAnchor: (target: ReaderAnchorTarget, pane?: "source" | "translated") => void;
  setModeKeepingPage: (next: ReaderMode) => void;
  showHud: boolean;
  tools: ReaderToolsApi;
  selection: ReaderSelection | null;
  clearSelection: () => void;
  selectRegion: (selection: ReaderRegionSelection) => void;
  documentTitle: string;
  download: ReaderSessionState["download"];
  /** stable local persistence scope for reading position/layout */
  viewStateKey: string;
  liveTranslation: LiveTranslationState;
  liveTranslationAvailable: boolean;
};

const LIVE_TRANSLATION_WORKFLOWS = new Set(["book", "translate"]);
export function shouldTrackLiveTranslation(input: {
  jobId: string;
  sourceUrl: string;
  workflow: string;
}): boolean {
  return Boolean(
    input.jobId
    && input.sourceUrl
    && LIVE_TRANSLATION_WORKFLOWS.has(input.workflow),
  );
}

export function shouldEnableLiveTranslation(input: {
  jobId: string;
  sourceUrl: string;
  translatedUrl: string;
  jobStatus: string;
  workflow: string;
}): boolean {
  return Boolean(
    shouldTrackLiveTranslation(input)
    // Preserve already committed live pages while the session switches to the
    // final PDF. Only a successful task with an authoritative artifact replaces
    // the temporary workspace. Failed/cancelled attempts keep their durable
    // page snapshots even when an older translated artifact also exists.
    && !(input.jobStatus === "succeeded" && input.translatedUrl),
  );
}


export function useReaderReactController(): ReaderReactController {
  const session = useReaderSession();
  const liveTranslationTracked = shouldTrackLiveTranslation({
    jobId: session.jobId,
    sourceUrl: session.sourceUrl,
    workflow: session.workflow,
  });
  const liveTranslationAvailable = shouldEnableLiveTranslation({
    jobId: session.jobId,
    sourceUrl: session.sourceUrl,
    translatedUrl: session.translatedUrl,
    jobStatus: session.jobStatus,
    workflow: session.workflow,
  });
  const liveTranslation = useLiveTranslation({
    jobId: session.jobId,
    jobStatus: session.jobStatus,
    enabled: liveTranslationTracked,
  });
  const tools = useReaderTools();
  const { shellRef, shellEl, shellWidth, compareColWidth, bindShell } = useReaderShell();
  const viewStateKey = readerViewStateScope({
    documentId: session.documentId,
    jobId: session.jobId,
  });
  const readerContentKey = `${viewStateKey}\u0000${session.jobId}\u0000${session.sourceUrl}\u0000${session.translatedUrl}`;
  const { userZoom, onZoomChange } = useReaderZoom(session.mode, shellRef, viewStateKey);

  const panes = useReaderPaneModel(
    {
      mode: session.mode,
      sourceOnly: session.sourceOnly,
      assetsReady: session.assetsReady,
      sourceUrl: session.sourceUrl,
      translatedUrl: session.translatedUrl,
      sourceFile: session.sourceFile,
      translatedFile: session.translatedFile,
    },
    { userZoom, shellWidth, identityKey: readerContentKey },
  );

  const {
    beginModeSwitch,
    goToPage: goToPageWithTotal,
    repinIfRestoring,
  } = useReadingAnchor(shellRef, {
    primaryPane: panes.primaryPane,
    mode: session.mode,
    enabled: !session.boot.loading,
    persistenceKey: viewStateKey,
    restoreReady: panes.primaryNumPages > 0,
  });

  useEffect(() => {
    repinIfRestoring();
  }, [shellWidth, repinIfRestoring]);

  const rowHeights = usePageRowSync(
    shellRef,
    panes.compareMode,
    panes.rowSyncRevision,
    repinIfRestoring,
  );

  const currentPage = useCurrentPage(
    shellRef,
    panes.primaryNumPages,
    !session.boot.loading,
    `${session.mode}-${userZoom}-${panes.metricsTick}`,
    panes.primaryPane,
  );

  const goToPage = useCallback((page: number, pane?: "source" | "translated") => {
    // 取已加载栏的最大页数；未知时传 0，由 clampPageNumber 放行目标页
    const total = Math.max(
      Number(panes.hudNumPages) || 0,
      Number(panes.primaryNumPages) || 0,
      Number(panes.numPagesByPane?.source) || 0,
      Number(panes.numPagesByPane?.translated) || 0,
    );
    goToPageWithTotal(page, total, pane);
  }, [goToPageWithTotal, panes.hudNumPages, panes.primaryNumPages, panes.numPagesByPane]);

  const [activeRegion, setActiveRegion] = useState<ReaderRegion | null>(null);
  const clearRegionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activateRegion = useCallback((region: ReaderRegion | null) => {
    if (clearRegionTimerRef.current) clearTimeout(clearRegionTimerRef.current);
    setActiveRegion(region);
    if (region) {
      clearRegionTimerRef.current = setTimeout(() => setActiveRegion(null), CITATION_HIGHLIGHT_MS);
    }
  }, []);
  useEffect(() => () => {
    if (clearRegionTimerRef.current) clearTimeout(clearRegionTimerRef.current);
  }, []);

  const resolveBlockPage = useCallback((blockId: string) => {
    const region = findReaderRegion(session.regions, blockId);
    return region ? regionBoxForPane(region, panes.primaryPane).page : null;
  }, [session.regions, panes.primaryPane]);

  const jumpToAnchor = useCallback((target: ReaderAnchorTarget, pane?: "source" | "translated") => {
    const targetPane = pane || panes.primaryPane;
    const blockId = typeof target === "object" && target
      ? `${target.block_id || ""}`.trim()
      : "";
    const imageUrl = typeof target === "object" && target
      ? `${target.image_url || ""}`.trim()
      : "";
    const pageHint = typeof target === "object" && target
      ? target.page_idx != null
        ? Number(target.page_idx) + 1
        : target.page != null
          ? Number(target.page)
          : null
      : typeof target === "number"
        ? target + 1
        : null;
    const region = findReaderRegionByAssetUrl(session.regions, imageUrl, pageHint)
      || findReaderRegion(session.regions, blockId)
      || (typeof target === "object" ? findReaderRegionByCitation(session.regions, target) : null);
    let page: number | null = region
      ? regionBoxForPane(region, targetPane).page
      : null;
    if (page == null) {
      const raw = typeof target === "number"
        ? target
        : target?.page_idx ?? target?.page;
      if (raw !== undefined && raw !== null && `${raw}`.trim() !== "") {
        const pageIdx = Number(raw);
        if (Number.isFinite(pageIdx) && pageIdx >= 0) page = Math.floor(pageIdx) + 1;
      }
    }
    if (page == null || page < 1) return;
    activateRegion(region);
    goToPage(page, targetPane);
  }, [activateRegion, goToPage, panes.primaryPane, session.regions]);

  // 收藏 / 搜索回跳：URL ?page_idx= → 页码（0 基 → 1 基）
  useUrlAnchorJump({
    enabled: !session.boot.loading && !session.boot.failed && session.assetsReady,
    numPages: panes.hudNumPages || 0,
    goToPage,
    resolveBlockPage,
    onAnchorApplied: (anchor) => {
      activateRegion(findReaderRegion(session.regions, anchor.blockId));
    },
  });

  const { setModeKeepingPage } = useReaderModeNavigation({
    mode: session.mode,
    setMode: session.setMode,
    beginModeSwitch,
  });

  const [regionSelection, setRegionSelection] = useState<ReaderRegionSelection | null>(null);
  const {
    selection: textSelection,
    clearSelection: clearTextSelection,
  } = useReaderTextSelection(shellRef, !session.boot.loading && !session.boot.failed);

  const clearSelection = useCallback(() => {
    setRegionSelection(null);
    clearTextSelection();
  }, [clearTextSelection]);

  const selectRegion = useCallback((next: ReaderRegionSelection) => {
    clearTextSelection();
    setRegionSelection(next);
  }, [clearTextSelection]);

  useEffect(() => {
    if (textSelection) setRegionSelection(null);
  }, [textSelection]);

  useEffect(() => {
    const shellNode = shellRef.current;
    if (!shellNode) return;
    const clearRegionSelection = () => setRegionSelection(null);
    shellNode.addEventListener("scroll", clearRegionSelection, { passive: true });
    return () => shellNode.removeEventListener("scroll", clearRegionSelection);
  }, [shellEl, shellRef]);

  const selection: ReaderSelection | null = textSelection || regionSelection;

  useEffect(() => {
    // Selection rectangles and citation highlights carry page/pane coordinates;
    // they are invalid as soon as the displayed Reader content changes.
    activateRegion(null);
    clearSelection();
  }, [readerContentKey, activateRegion, clearSelection]);

  const showHud = !session.boot.loading && !session.boot.failed;

  useReaderKeyboard({
    mode: session.mode,
    sourceOnly: session.sourceOnly,
    setMode: setModeKeepingPage,
    userZoom,
    onZoomChange,
    currentPage,
    numPages: panes.hudNumPages,
    goToPage,
    enabled: showHud,
  });

  // tools 对象引用稳定到 active 变化时
  const toolsApi = useMemo(() => tools, [tools.active, tools.open, tools.close, tools.toggle, tools.isOpen]);

  const shellMemo = useMemo(() => ({ bindShell, shellEl, shellWidth, compareColWidth, shellRef }), [bindShell, shellEl, shellWidth, compareColWidth, shellRef]);
  const sessionFilesMemo = useMemo(() => ({
    sourceUrl: session.sourceUrl,
    translatedUrl: session.translatedUrl,
    sourceFile: session.sourceFile,
    translatedFile: session.translatedFile,
  }), [session.sourceUrl, session.translatedUrl, session.sourceFile, session.translatedFile]);

  // 将频繁变化的 currentPage 隔离：主体 shell/panes/tools 等保持稳定，避免滚动时全量重渲染
  const stablePart = useMemo(() => ({
    session,
    boot: session.boot,
    sourceOnly: session.sourceOnly,
    mode: session.mode,
    userZoom,
    onZoomChange,
    shell: shellMemo,
    panes,
    sessionFiles: sessionFilesMemo,
    rowHeights,
    goToPage,
    activeRegion,
    jumpToAnchor,
    setModeKeepingPage,
    download: session.download,
    showHud,
    tools: toolsApi,
    selection,
    clearSelection,
    selectRegion,
    documentTitle: session.title || "",
    viewStateKey,
    liveTranslation,
    liveTranslationAvailable,
  }), [session, shellMemo, panes, sessionFilesMemo, rowHeights, goToPage, activeRegion, jumpToAnchor, setModeKeepingPage, showHud, toolsApi, selection, clearSelection, selectRegion, userZoom, onZoomChange, viewStateKey, liveTranslation, liveTranslationAvailable]);

  return useMemo(() => ({
    ...stablePart,
    currentPage,
  }), [stablePart, currentPage]);
}
