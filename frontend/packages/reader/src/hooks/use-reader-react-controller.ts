// Composes full react-pdf reader logic (session → shell → panes → HUD).

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useReaderSession } from "./use-reader-session.js";
import { useReaderShell } from "./use-reader-shell.js";
import { useReaderPaneModel } from "./use-reader-pane-model.js";
import { useReaderZoom } from "./use-reader-zoom.js";
import { useReaderModeNavigation } from "./use-reader-mode-navigation.js";
import { useCurrentPage } from "../pdf/useCurrentPage.js";
import { usePageRowSync } from "../pdf/usePageRowSync.js";
import { useReadingAnchor } from "../pdf/useReadingAnchor.js";
import { useReaderUrlAnchorSync } from "./use-url-anchor-jump.js";
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
} from "../shared/data/reader-regions.js";
import { readerViewStateScope } from "../shared/state/reader-view-state.js";
import { useLiveTranslation } from "./use-live-translation.js";
import { useReaderRevisedBlocks, type RevisedBlocks } from "./use-reader-revised-blocks.js";
import type { LiveTranslationState } from "../shared/data/live-translation-state.js";
import { isFinishedJobStatus } from "@retainpdf/domain/job";

export const CITATION_HIGHLIGHT_MS = 2000;

/**
 * 无 region 命中时的页码回退：区分 0 基与 1 基来源再换算。
 * - number：视为 0 基 page_idx，+1；
 * - page_idx（0 基）：+1；
 * - page（1 基）：直用，page_idx 缺席时才看它；
 * - 非法/缺席返回 null。
 */
export function resolveReaderAnchorFallbackPage(target: ReaderAnchorTarget): number | null {
  if (typeof target === "number") {
    const pageIdx = Number(target);
    if (!Number.isFinite(pageIdx) || pageIdx < 0) return null;
    return Math.floor(pageIdx) + 1;
  }
  if (!target || typeof target !== "object") return null;
  const rawIdx = target.page_idx;
  if (rawIdx !== undefined && rawIdx !== null && `${rawIdx}`.trim() !== "") {
    const pageIdx = Number(rawIdx);
    if (!Number.isFinite(pageIdx) || pageIdx < 0) return null;
    return Math.floor(pageIdx) + 1;
  }
  const rawPage = target.page;
  if (rawPage !== undefined && rawPage !== null && `${rawPage}`.trim() !== "") {
    const page = Number(rawPage);
    if (!Number.isFinite(page) || page < 1) return null;
    return Math.floor(page);
  }
  return null;
}

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
  goToPage: (page: number, pane?: "source" | "translated") => void;
  activeRegion: ReaderRegion | null;
  jumpToAnchor: (target: ReaderAnchorTarget, pane?: "source" | "translated") => void;
  setModeKeepingPage: (next: ReaderMode) => void;
  showHud: boolean;
  download: ReaderSessionState["download"];
  /** stable local persistence scope for reading position/layout */
  viewStateKey: string;
  liveTranslation: LiveTranslationState;
  liveTranslationAvailable: boolean;
  /** 改过的块（阅读页块编号 → 改过几次），译文栏画标记用。 */
  revisedBlocks: RevisedBlocks;
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
  // 打开时就已经成功、且有最终译文 PDF 的任务，不跟实时译文：用不上，而且它会从头
  // 重放全部事件、逐页取快照，追不上的页每页重试一串 409（48 页的书开着一直在打）。
  // 本次会话里见过任务在跑的照旧跟到底 —— 运行中 → 成功切到最终 PDF 的那一下，
  // 已经出来的实时页不能丢（见 shouldEnableLiveTranslation 的注释）。
  const sawRunningRef = useRef({ jobId: "", running: false });
  if (sawRunningRef.current.jobId !== session.jobId) {
    sawRunningRef.current = { jobId: session.jobId, running: false };
  }
  const normalizedStatus = `${session.jobStatus || ""}`.trim().toLowerCase();
  if (normalizedStatus && !isFinishedJobStatus(normalizedStatus)) {
    sawRunningRef.current.running = true;
  }
  const liveTranslation = useLiveTranslation({
    jobId: session.jobId,
    jobStatus: session.jobStatus,
    enabled: liveTranslationTracked && (liveTranslationAvailable || sawRunningRef.current.running),
  });
  const { shellRef, shellEl, shellWidth, bindShell } = useReaderShell();
  // 只在有译文时读：原文直开（没有任务）没有修订记录。
  const revisedBlocks = useReaderRevisedBlocks(session.jobId, !session.sourceOnly);
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
      page = resolveReaderAnchorFallbackPage(target as ReaderAnchorTarget);
    }
    if (page == null || page < 1) return;
    activateRegion(region);
    goToPage(page, targetPane);
  }, [activateRegion, goToPage, panes.primaryPane, session.regions]);
  // 收藏 / 搜索回跳：URL ?page_idx= → 页码（0 基 → 1 基）；
  // 阅读中反向把 currentPage 防抖写回 URL，使分享/刷新回到当前位置。
  useReaderUrlAnchorSync({
    enabled: !session.boot.loading && !session.boot.failed && session.assetsReady,
    syncEnabled: !session.boot.loading && !session.boot.failed && session.assetsReady,
    numPages: panes.hudNumPages || 0,
    currentPage,
    goToPage,
    resolveBlockPage,
    jobId: session.jobId,
    documentId: session.documentId,
    onAnchorApplied: (anchor) => {
      activateRegion(findReaderRegion(session.regions, anchor.blockId));
    },
  });

  const { setModeKeepingPage } = useReaderModeNavigation({
    mode: session.mode,
    setMode: session.setMode,
    beginModeSwitch,
  });

  // 点块 / 拖选文字后的浮条（复制 / 问 AI）整个删了：复制交给悬停框，
  // 拖选文字照旧是浏览器原生选区（Ctrl+C）。
  useEffect(() => {
    // Citation highlights carry page/pane coordinates; they are invalid as soon
    // as the displayed Reader content changes.
    activateRegion(null);
  }, [readerContentKey, activateRegion]);

  const showHud = !session.boot.loading && !session.boot.failed;

  const shellMemo = useMemo(() => ({ bindShell, shellEl, shellWidth, shellRef }), [bindShell, shellEl, shellWidth, shellRef]);
  const sessionFilesMemo = useMemo(() => ({
    sourceUrl: session.sourceUrl,
    translatedUrl: session.translatedUrl,
    sourceFile: session.sourceFile,
    translatedFile: session.translatedFile,
  }), [session.sourceUrl, session.translatedUrl, session.sourceFile, session.translatedFile]);

  // 将频繁变化的 currentPage 隔离：主体 shell/panes 等保持稳定，避免滚动时全量重渲染
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
    viewStateKey,
    liveTranslation,
    liveTranslationAvailable,
    revisedBlocks,
  }), [session, shellMemo, panes, sessionFilesMemo, rowHeights, goToPage, activeRegion, jumpToAnchor, setModeKeepingPage, showHud, userZoom, onZoomChange, viewStateKey, liveTranslation, liveTranslationAvailable, revisedBlocks]);

  return useMemo(() => ({
    ...stablePart,
    currentPage,
  }), [stablePart, currentPage]);
}
