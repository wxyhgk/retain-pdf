// 从 frontend/web 迁入的 React-pdf 视图真值，现为 @retainpdf/reader 主入口。
// 2026-11-27 拆开：这里只把各块接起来（谁和谁共享什么状态、context、渲染顺序）；各块的状态和 effect 在 ./app/ 下，
// 可见台面的纯函数在 app/pane-composition.ts（这里照旧导出，老的引用不用改）。
import { useCallback, useMemo, useState } from "react";
import { useReaderReactController } from "./hooks/use-reader-react-controller.js";
import { useReaderKeyboard } from "./hooks/use-reader-keyboard.js";
import {
  ReaderAssistantSplitResizeHandle,
  ReaderAssistantDock,
  ReaderCloseHome,
  ReaderWorkspaceTabs,
  ReaderReactBoot,
  ReaderCompareGrid,
  ReaderZoomHud,
  ReaderDownloadActions,
} from "./components/react-pdf/index.js";
import type { ReaderAssistantPanel, ReaderWorkspaceMode } from "./components/react-pdf/index.js";
import { useReaderAssistantPanel } from "./hooks/use-reader-assistant-panel.js";
import { DownloadToastHost } from "./shared/react/DownloadToastHost.jsx";
import { READER_ROOT_CLASS } from "./pdf/reader-dom-contract.js";
import {
  ReaderProvider,
  type ReaderContextValue,
  type ReaderHudContextValue,
} from "./components/react-pdf/reader-context.js";
import { createRegionHoverStore } from "./shared/state/region-hover-store.js";
import { ReaderSearchToggle } from "./components/react-pdf/ReaderFinder.js";
import { ReaderToolBall } from "./components/react-pdf/ReaderToolBall.js";
import { ReaderPageMenu, pageMenuFromContextMenu, type ReaderPageMenuState } from "./components/react-pdf/ReaderPageMenu.js";
import { ReaderPendingEditsPill } from "./components/react-pdf/ReaderPendingEditsPill.js";
import { useReaderDocTheme } from "./hooks/use-reader-doc-theme.js";
import { ReaderFinderArea } from "./app/ReaderFinderArea.js";
import { ReaderOverlays } from "./app/ReaderOverlays.js";
import { useLiveTranslationControls, useLiveTranslationOverlay } from "./app/use-live-translation-overlay.js";
import { BUILTIN_READER_EXTENSIONS } from "./extensions/builtin.js";
import { collectMenuItems, ReaderExtensionOutlets, ReaderExtensionsProvider } from "./extensions/registry.js";
import type { ReaderMenuItem } from "./extensions/types.js";
import { useReaderExtensionHost } from "./app/use-reader-extension-host.js";
import { useReaderBlockEditing } from "./app/use-reader-block-editing.js";
import { useReaderTranslationVersions } from "./hooks/use-reader-version-compare.js";
import { useReaderFinder } from "./app/use-reader-finder.js";
import { useReaderModePersistence } from "./app/use-reader-mode-persistence.js";
import { useReaderPdfAssets } from "./app/use-reader-pdf-assets.js";
import { resolveLiveTranslationVisibleOnWorkspaceChange } from "./app/pane-composition.js";

export {
  resolveLiveTranslationVisibleOnWorkspaceChange,
  resolveReaderPaneComposition,
  type ReaderPaneComposition,
} from "./app/pane-composition.js";


export function ReaderAppReactPdf() {
  const c = useReaderReactController();
  const { boot, panes, session } = c;
  // 「开着哪个面板」的恢复 / 持久化整段在 use-reader-assistant-panel 里 ——
  // 那是 effect 顺序的事，只有真渲染才测得到，所以单独成 hook 好被真渲染。
  const assistant = useReaderAssistantPanel(c.viewStateKey);
  const assistantPanel = assistant.panel;
  const setAssistantPanel = assistant.setPanel;

  const assistantOpen = assistantPanel !== null;
  // 实时译文叠不叠、可见台面（Grid / Tabs / 键盘 / HUD 的唯一真源）、两个开关摆哪：app/use-live-translation-overlay。
  const { liveTranslationVisible, setLiveTranslationVisible, paneComposition, liveToggles, sourceViewOnly, visiblePdfMode } = useLiveTranslationOverlay(c, assistantOpen);
  useReaderModePersistence(c, sourceViewOnly);
  const workspaceView = assistantPanel || (c.mode === "compare" ? "compare" : "reading");
  // 键盘与 UI 共用同一「可见模式」真源：paneComposition.visibleMode。
  // 「0」重置缩放据此取模式默认，避免与 HUD/网格显示的模式脱节。
  const { docDark, toggleDocDark } = useReaderDocTheme();
  useReaderKeyboard({
    toggleDocDark,
    mode: visiblePdfMode,
    sourceOnly: c.sourceOnly,
    setMode: c.setModeKeepingPage,
    userZoom: c.userZoom,
    onZoomChange: c.onZoomChange,
    currentPage: c.currentPage,
    numPages: panes.hudNumPages,
    goToPage: c.goToPage,
    enabled: c.showHud,
  });
  const closeAssistant = useCallback(() => {
    setAssistantPanel(null);
  }, []);
  const { latestLivePage, jumpToLatestLivePage, offerCompletion, setCompletionDismissedKey, sourcePaneAction } = useLiveTranslationControls(c, {
    liveTranslationVisible,
    setLiveTranslationVisible,
    liveToggles,
    sourceViewOnly,
    visiblePdfMode,
  });
  const changeWorkspace = useCallback((next: ReaderWorkspaceMode) => {
    // A running translation can provide the compare workspace before the
    // immutable translated PDF exists. Keep the visible workspace and the
    // top-bar selection in sync instead of asking the session mode (which is
    // correctly source-only until the final artifact arrives) to represent
    // this temporary live pair.
    const autoEnable = resolveLiveTranslationVisibleOnWorkspaceChange(next, c.liveTranslationAvailable);
    if (autoEnable !== null) setLiveTranslationVisible(autoEnable);
    c.setModeKeepingPage(next);
  }, [c.liveTranslationAvailable, c.setModeKeepingPage]);

  const selectAssistant = useCallback((next: ReaderAssistantPanel) => {
    setAssistantPanel(next);
    // 栏锁的语义是「这一次从某栏的选区问 AI」，生命周期跟着那次提问。
    //
    // 清它的路原来覆盖了「关面板」「切顶栏页签」「换文档」，**唯独漏了换面板**
    // —— 而换面板是 dock 上最常用的动作。漏掉的表现：在译文栏问过 AI 之后点
    // Markdown，面板换了，PDF 那半边却还只剩译文栏，顶栏还挂着「对照被面板挤掉」。
  }, []);

  // 外壳 Context：只装频繁下钻、且此前纯透传的值；currentPage/numPages 走 HUD
  // context，避免滚动带动整棵外壳重渲染。
  const [regionHover] = useState(createRegionHoverStore);
  // 左栏的目录 / 搜索（app/use-reader-finder）。
  const finderState = useReaderFinder(c);
  const { finder, toggleFinder, findTerm } = finderState;
  const jumpToBlock = useCallback((itemId: string) => c.jumpToAnchor({ block_id: itemId }), [c.jumpToAnchor]);
  const jumpToBlockIn = useCallback((itemId: string, pane?: "source" | "translated") => c.jumpToAnchor({ block_id: itemId }, pane), [c.jumpToAnchor]);
  // PDF 自带的书签、各栏读好的 PDF 和放大查看（app/use-reader-pdf-assets）。
  const { bookmarks, onPdfOutline, onPdfDocument, zoomItem, setZoomItem, zoomBlock, closeZoom, zoomDocuments } = useReaderPdfAssets(c);
  // 改译文（app/use-reader-block-editing）。
  const { blockEdit, editBlock, revisedBlocks } = useReaderBlockEditing(c, visiblePdfMode, regionHover);
  // 右键书页的菜单：开在哪、第几页（菜单项和下面那几块是扩展登记的）。
  const [pageMenu, setPageMenu] = useState<ReaderPageMenuState>(null);
  const closePageMenu = useCallback(() => setPageMenu(null), []);
  // 这本书的几份译文、正在读哪一份（提问记读的是哪份；对比版本扩展列出来挑）。
  const translationVersions = useReaderTranslationVersions({ documentId: session.documentId, jobId: session.jobId });
  // 贡献表（extensions/，app/use-reader-extension-host）：扩展读的阅读页接口、它们登记的右键菜单项 / 每页一层 / 文字层标记 /
  // 对照左栏 / 占着指针。
  const {
    readerApi, contributionStore, contributions, pageLayers, compareVersion, textMarks, menuSections, pointerTakenId,
  } = useReaderExtensionHost(c, {
    translationVersions, bookmarks, regionHover, assistantPanel, closeAssistant, visiblePdfMode, changeWorkspace, jumpToBlockIn, zoomDocuments,
  });
  const pointerTaken = Boolean(pointerTakenId);
  // 右键那一下各扩展给的菜单项（右键时算好，菜单开着时不再变）。
  const [menuItems, setMenuItems] = useState<readonly ReaderMenuItem[]>([]);
  const readerContext = useMemo<ReaderContextValue>(() => ({
    bindShell: c.shell.bindShell,
    shellEl: c.shell.shellEl,
    shellWidth: c.shell.shellWidth,
    userZoom: c.userZoom,
    onZoomChange: c.onZoomChange,
    rowHeights: c.rowHeights,
    mountSource: c.panes.mountSource,
    mountTranslated: c.panes.mountTranslated,
    onMetrics: c.panes.onMetrics,
    onNumPagesChange: c.panes.onNumPages,
    sourceUrl: c.sessionFiles.sourceUrl,
    translatedUrl: c.sessionFiles.translatedUrl,
    sourceFile: c.sessionFiles.sourceFile,
    translatedFile: c.sessionFiles.translatedFile,
    regions: session.regions,
    readerMetadata: session.readerMetadata,
    activeRegion: c.activeRegion,
    regionHover,
    jumpToBlock,
    revisedBlocks,
    onPdfOutline,
    onPdfDocument,
    zoomBlock,
    textMarks,
    pageLayers,
    editBlock: blockEdit.available ? editBlock : undefined,
    blockEdit,
    editShowsSource: visiblePdfMode !== "compare",
    findTerm: finder === "search" ? findTerm : "",
    compareVersion,
    pointerTaken,
    sourceOnly: c.sourceOnly,
    sourceViewOnly,
    download: c.download,
    goToPage: c.goToPage,
    assistant: { select: selectAssistant, close: closeAssistant },
    docDark,
    toggleDocDark,
  }), [
    c.shell,
    c.userZoom,
    c.onZoomChange,
    c.rowHeights,
    c.panes,
    c.sessionFiles,
    session.regions,
    session.readerMetadata,
    c.activeRegion,
    regionHover,
    jumpToBlock,
    revisedBlocks,
    onPdfOutline,
    onPdfDocument,
    zoomBlock,
    textMarks,
    pageLayers,
    blockEdit,
    editBlock,
    visiblePdfMode,
    finder,
    findTerm,
    compareVersion,
    pointerTaken,
    c.sourceOnly,
    sourceViewOnly,
    c.download,
    c.goToPage,
    selectAssistant,
    closeAssistant,
    docDark,
    toggleDocDark,
  ]);

  const readerHud = useMemo<ReaderHudContextValue>(() => ({
    currentPage: c.currentPage,
    numPages: panes.hudNumPages,
  }), [c.currentPage, panes.hudNumPages]);

  const rootClasses = [
    READER_ROOT_CLASS,
    `is-workspace-${workspaceView}`,
    assistantOpen ? "is-assistant-open" : "",
    finder ? "is-finder-open" : "",
    paneComposition.overlayOnSource ? "is-live-translation-overlay" : "",
  ].filter(Boolean).join(" ");

  return (
    <ReaderExtensionsProvider api={readerApi} store={contributionStore}>
      <ReaderProvider value={readerContext} hud={readerHud}>
        <div
          className={rootClasses}
          data-reader-engine="react-pdf"
          data-reader-workspace={workspaceView}
          data-pointer-taken={pointerTakenId || undefined}
          onContextMenu={(event) => {
            const menu = pageMenuFromContextMenu(event);
            if (!menu) return;
            const items = collectMenuItems(contributions, { target: event.target as Element, clientX: event.clientX, clientY: event.clientY, page: menu.page });
            // 没有扩展往菜单里放东西：照旧是浏览器自己的菜单。
            if (!items.length && !menuSections.length) return;
            event.preventDefault();
            setMenuItems(items);
            setPageMenu(menu);
          }}
        >
          <ReaderReactBoot loading={boot.loading} failed={boot.failed} text={boot.text} percent={boot.percent} regionsError={Boolean(session.readerErrors.regions)} metadataError={Boolean(session.readerErrors.metadata)} onRetry={session.refreshJobArtifacts} />
          <ReaderFinderArea state={finderState} bookmarks={bookmarks} />
          {/* 三路下载和「关闭回主页」同一组：顶栏常驻，任何面板开着都够得到。
              原来它们在可拖动圆钮的菜单里，而圆钮一开 dock 就被 CSS 整个吃掉。 */}
          <div className="reader-chrome-tray">
            <ReaderDownloadActions />
            <ReaderCloseHome onBeforeClose={session.prepareClose} />
          </div>
          <ReaderWorkspaceTabs
            mode={visiblePdfMode}
            documentReady={Boolean(session.jobId)}
            sourceViewOnly={sourceViewOnly}
            onModeChange={changeWorkspace}
            liveTranslation={liveToggles.topBarPill ? {
              visible: liveTranslationVisible,
              state: c.liveTranslation,
              onToggle: () => setLiveTranslationVisible((visible) => !visible),
              latestPage: liveTranslationVisible ? latestLivePage : null,
              currentPage: c.currentPage,
              onJumpToLatest: jumpToLatestLivePage,
            } : null}
            completion={offerCompletion ? {
              onOpenCompare: () => {
                setCompletionDismissedKey(c.viewStateKey);
                changeWorkspace("compare");
              },
            } : null}
          />
          <ReaderAssistantDock active={assistantPanel} />
          {assistantOpen ? <ReaderAssistantSplitResizeHandle /> : null}
          <ReaderCompareGrid paneComposition={paneComposition} markdownSplit={assistantOpen} assistantSplit={assistantOpen} liveTranslation={c.liveTranslation} sourcePaneAction={sourcePaneAction} />
          {c.showHud ? (
            <ReaderZoomHud
              mode={visiblePdfMode}
              modeControls={null}
              bookmarkScope={c.viewStateKey}
              issuesJobId={c.sourceOnly ? "" : session.jobId}
              searchSlot={<ReaderSearchToggle open={finder} onToggle={toggleFinder} />}
            />
          ) : null}
          <ReaderOverlays
            session={session}
            zoomDocuments={zoomDocuments}
            zoomItem={zoomItem}
            setZoomItem={setZoomItem}
            closeZoom={closeZoom}
            visiblePdfMode={visiblePdfMode}
          />
          <ReaderToolBall active={assistantPanel} />
          <ReaderPageMenu menu={pageMenu} onClose={closePageMenu} actions={menuItems} sections={menuSections} />
          <ReaderExtensionOutlets extensions={BUILTIN_READER_EXTENSIONS} />
          <ReaderPendingEditsPill edit={blockEdit} />
          <DownloadToastHost />
        </div>
      </ReaderProvider>
    </ReaderExtensionsProvider>
  );
}