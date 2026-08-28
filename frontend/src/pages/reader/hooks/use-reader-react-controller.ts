// Composes full react-pdf reader logic (session → shell → panes → tools → HUD).

import { useCallback, useEffect, useMemo, type RefObject } from "react";
import { useReaderSession } from "./use-reader-session.js";
import { useReaderKeyboard } from "./use-reader-keyboard.js";
import { useReaderShell } from "./use-reader-shell.js";
import { useReaderPaneModel } from "./use-reader-pane-model.js";
import { useReaderZoom } from "./use-reader-zoom.js";
import { useReaderModeNavigation } from "./use-reader-mode-navigation.js";
import { useReaderAnnotations } from "./use-reader-annotations.js";
import { useReaderTextSelection } from "./use-reader-text-selection.js";
import { useReaderTools, type ReaderToolsApi } from "./use-reader-tools.js";
import { useCurrentPage } from "../pdf/useCurrentPage.js";
import { usePageRowSync } from "../pdf/usePageRowSync.js";
import { useReadingAnchor } from "../pdf/useReadingAnchor.js";
import { useUrlAnchorJump } from "./use-url-anchor-jump.js";
import type { PageRowHeights } from "../pdf/usePageRowSync.js";
import type { ReaderMode, ReaderSessionState } from "./use-reader-session.js";
import type { ProtectedPdfFile } from "../pdf/useProtectedPdfFile.js";
import type { ReaderPaneModel } from "./use-reader-pane-model.js";
import type { ReaderAnnotationsApi } from "./use-reader-annotations.js";
import type { ReaderTextSelection } from "./use-reader-text-selection.js";
import type { ReaderNote } from "../annotations/types.js";

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
  setModeKeepingPage: (next: ReaderMode) => void;
  showHud: boolean;
  tools: ReaderToolsApi;
  notes: ReaderAnnotationsApi;
  selection: ReaderTextSelection | null;
  clearSelection: () => void;
  addNoteFromSelection: (selection: ReaderTextSelection) => void;
  jumpToNote: (note: ReaderNote) => void;
  documentTitle: string;
  download: ReaderSessionState["download"];
};


export function useReaderReactController(): ReaderReactController {
  const session = useReaderSession();
  const tools = useReaderTools();
  const { shellRef, shellEl, shellWidth, compareColWidth, bindShell } = useReaderShell();
  const { userZoom, onZoomChange } = useReaderZoom(session.mode, shellRef);

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
    { userZoom, shellWidth },
  );

  const {
    beginModeSwitch,
    goToPage: goToPageWithTotal,
    repinIfRestoring,
  } = useReadingAnchor(shellRef, {
    primaryPane: panes.primaryPane,
    mode: session.mode,
    enabled: !session.boot.loading,
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

  const goToPage = useCallback((page: number) => {
    // Lấy số trang lớn nhất từ pane đã tải; nếu chưa biết thì truyền 0 để clampPageNumber cho qua trang đích.
    const total = Math.max(
      Number(panes.hudNumPages) || 0,
      Number(panes.primaryNumPages) || 0,
      Number(panes.numPagesByPane?.source) || 0,
      Number(panes.numPagesByPane?.translated) || 0,
    );
    goToPageWithTotal(page, total);
  }, [goToPageWithTotal, panes.hudNumPages, panes.primaryNumPages, panes.numPagesByPane]);

  // Nhảy về từ favorite / search: URL ?page_idx= -> số trang (0-based -> 1-based).
  useUrlAnchorJump({
    enabled: !session.boot.loading && !session.boot.failed && session.assetsReady,
    numPages: panes.hudNumPages || 0,
    goToPage,
  });

  const { setModeKeepingPage } = useReaderModeNavigation({
    mode: session.mode,
    setMode: session.setMode,
    beginModeSwitch,
  });

  const openNotes = useCallback(() => {
    tools.open("notes");
  }, [tools]);

  const notes = useReaderAnnotations(
    {
      jobId: session.jobId,
      documentId: session.documentId,
    },
    { onAfterAdd: openNotes },
  );

  const { selection, clearSelection } = useReaderTextSelection(
    shellRef,
    !session.boot.loading && !session.boot.failed,
  );

  const addNoteFromSelection = useCallback((sel: ReaderTextSelection) => {
    notes.addFromQuote({
      page: sel.page,
      pane: sel.pane,
      quote: sel.quote,
    });
    clearSelection();
  }, [notes, clearSelection]);

  const jumpToNote = useCallback((note: ReaderNote) => {
    // Nếu ghi chú nằm ở pane bản dịch/gốc, cố gắng chuyển sang một cột tương ứng hoặc đối chiếu.
    if (note.pane === "translated" && session.mode === "source") {
      beginModeSwitch();
      session.setMode("compare");
    } else if (note.pane === "source" && session.mode === "translated") {
      beginModeSwitch();
      session.setMode("compare");
    }
    goToPage(note.page);
  }, [session, beginModeSwitch, goToPage]);

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

  // Giữ reference object tools ổn định cho tới khi active thay đổi.
  const toolsApi = useMemo(() => tools, [tools.active, tools.open, tools.close, tools.toggle, tools.isOpen]);

  return {
    session,
    boot: session.boot,
    sourceOnly: session.sourceOnly,
    mode: session.mode,
    userZoom,
    onZoomChange,
    shell: { bindShell, shellEl, shellWidth, compareColWidth, shellRef },
    panes,
    sessionFiles: {
      sourceUrl: session.sourceUrl,
      translatedUrl: session.translatedUrl,
      sourceFile: session.sourceFile,
      translatedFile: session.translatedFile,
    },
    rowHeights,
    currentPage,
    goToPage,
    setModeKeepingPage,
    download: session.download,
    showHud,
    tools: toolsApi,
    notes,
    selection,
    clearSelection,
    addNoteFromSelection,
    jumpToNote,
    documentTitle: session.title || "",
  };
}
