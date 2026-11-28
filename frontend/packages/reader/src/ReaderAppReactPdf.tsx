// 从 frontend/web 迁入的 React-pdf 视图真值，现为 @retainpdf/reader 主入口。
// 2026-11-27 拆开：这里只把各块接起来（谁和谁共享什么状态、context、渲染顺序）；各块的状态和 effect 在 ./app/ 下，
// 可见台面的纯函数在 app/pane-composition.ts（这里照旧导出，老的引用不用改）。
import { useCallback, useMemo, useState, type CSSProperties } from "react";
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
import { ReaderBarTools } from "./components/react-pdf/ReaderBarTools.js";
import { ReaderFinderToggles } from "./components/react-pdf/ReaderFinder.js";
import { ReaderTocMinimap } from "./components/react-pdf/ReaderTocMinimap.js";
import { ReaderSideRail } from "./components/react-pdf/ReaderSideRail.js";
import { useReaderIssueNav } from "./hooks/use-reader-issues.js";
import { ReaderPageMenu, pageMenuFromContextMenu, type ReaderPageMenuState } from "./components/react-pdf/ReaderPageMenu.js";
import { ReaderPendingEditsPill } from "./components/react-pdf/ReaderPendingEditsPill.js";
import { useReaderDocTheme } from "./hooks/use-reader-doc-theme.js";
import { ReaderFinderArea } from "./app/ReaderFinderArea.js";
import { ReaderOverlays } from "./app/ReaderOverlays.js";
import { useLiveTranslationControls, useLiveTranslationOverlay } from "./app/use-live-translation-overlay.js";
import { BUILTIN_READER_EXTENSIONS } from "./extensions/builtin.js";
import { collectMenuItems, ReaderExtensionOutlets, ReaderExtensionsProvider } from "./extensions/registry.js";
import type { ReaderMenuItem } from "./extensions/types.js";
import { useReaderContributionTable, useReaderExtensionHost, useRightDockSlot } from "./app/use-reader-extension-host.js";
import { useReaderBlockEditing } from "./app/use-reader-block-editing.js";
import { useReaderTranslationVersions } from "./hooks/use-reader-version-compare.js";
import { useReaderFinder } from "./app/use-reader-finder.js";
import { useReaderModePersistence } from "./app/use-reader-mode-persistence.js";
import { useReaderPdfAssets } from "./app/use-reader-pdf-assets.js";
import { compareFitsStage, resolveLiveTranslationVisibleOnWorkspaceChange } from "./app/pane-composition.js";

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
  // 扩展登记的表（extensions/）。右边停着东西（面板，或扩展贴右边的浮层）时，中间工作区的横排里多一栏，书页区（.reader-stage）自然变窄；
  // 右边只停一个，后来的留下（useRightDockSlot）。剩下的书页区放不下两栏时对照收成单栏原文。
  const table = useReaderContributionTable();
  const { reserveRight } = table;
  const sideDocked = assistantOpen || reserveRight > 0;
  // 左栏（搜索 / 书签 / 待改，app/use-reader-finder）：开着、屏够宽时书页区左边也让出一栏。
  const finderState = useReaderFinder(c);
  const { finder, findTerm } = finderState;
  const leftDocked = Boolean(finder) && finderState.pinned;
  // 目录固定了（目录卡顶上的图钉；2026-11-28 顶栏的「目录」按钮去掉了）：屏够宽（和左栏同一条线，finderState.pinned）时是中间工作区最左边实占的一栏，窄屏只是卡片一直开着。
  // 只在这一次打开里记着（2026-11-28 左栏也是一进来收着）。
  const [tocPinned, setTocPinned] = useState(false);
  const tocDocked = tocPinned && finderState.pinned;
  const closeAssistant = useCallback(() => {
    setAssistantPanel(null);
  }, []);
  useRightDockSlot(reserveRight, assistantPanel, closeAssistant);
  // 实时译文叠不叠、可见台面（Grid / Tabs / 键盘 / HUD 的唯一真源）、两个开关摆哪：app/use-live-translation-overlay。
  const { liveTranslationVisible, setLiveTranslationVisible, paneComposition, liveToggles, sourceViewOnly, visiblePdfMode } = useLiveTranslationOverlay(
    c, assistantOpen, compareFitsStage(c.shell.shellWidth, sideDocked || leftDocked || tocDocked),
  );
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
  const jumpToBlock = useCallback((itemId: string) => c.jumpToAnchor({ block_id: itemId }), [c.jumpToAnchor]);
  // 待处理（没翻成、内容问题、版面放不下）：顶栏左栏开关的角标和左栏「待处理」页签用同一份；N / Shift+N 在里面监听。
  const issueNav = useReaderIssueNav(c.sourceOnly ? "" : session.jobId, c.currentPage, jumpToBlock);
  // 右边停靠栏里放面板的元素（扩展从 api.panelHost 拿，用 createPortal 画进去）。
  const [panelHost, setPanelHost] = useState<HTMLDivElement | null>(null);
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
  } = useReaderExtensionHost(c, table, {
    translationVersions, bookmarks, regionHover, assistantPanel, closeAssistant, visiblePdfMode, changeWorkspace, jumpToBlockIn, zoomDocuments,
    editBlock: blockEdit.available && !blockEdit.blockedReason ? editBlock : null,
    panelHost,
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
    leftDocked ? "is-sidebar-pinned" : "",
    tocDocked ? "is-toc-docked" : "",
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
          {/* 壳层（2026-11-28）：根节点里只有中间工作区一行（左栏、书页区、右边停靠栏），不再拿 --reader-stage-* 去算谁让谁。
              顶栏、底栏 11-28 下午起都不占行，浮在书页区的顶上、底下（ReaderWorkspaceTabs、ReaderZoomHud 画在 .reader-stage 里）。 */}
          <div className="reader-workspace">
            {tocDocked ? <ReaderTocMinimap bookmarks={bookmarks} onJumpPage={c.goToPage} onJumpBlock={jumpToBlock} pinned docked onPinChange={setTocPinned} /> : null}
            <ReaderFinderArea state={finderState} bookmarkScope={c.viewStateKey} issues={issueNav} />
            <div className="reader-stage">
              {/* 浮在书页区顶上：左上一颗返回，正上方原文 / 对照 / 译文（2026-11-28 下午起不再是占一行的顶栏；用户：「左侧的返回按钮不要给书籍的标题」，书名不再画）。 */}
              <ReaderWorkspaceTabs
                mode={visiblePdfMode}
                documentReady={Boolean(session.jobId)}
                sourceViewOnly={sourceViewOnly}
                onModeChange={changeWorkspace}
                compareExtra={<ReaderBarTools place="compare" />}
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
                start={<ReaderCloseHome onBeforeClose={session.prepareClose} />}
              />
              {/* 目录：书页区左缘一排短横线，移上去出目录卡（照原型 reader-prototype.html）；固定成一栏时画在上面工作区最左边。 */}
              {tocDocked ? null : <ReaderTocMinimap bookmarks={bookmarks} onJumpPage={c.goToPage} onJumpBlock={jumpToBlock} pinned={tocPinned} onPinChange={setTocPinned} />}
              {/* 右缘竖条：AI 回答、Markdown、下载（2026-11-28 从顶栏右边挪过来，悬浮不占栏）。 */}
              <ReaderSideRail active={assistantPanel} />
              <ReaderCompareGrid paneComposition={paneComposition} markdownSplit={assistantOpen} assistantSplit={sideDocked} liveTranslation={c.liveTranslation} sourcePaneAction={sourcePaneAction} />
              <ReaderReactBoot loading={boot.loading} failed={boot.failed} text={boot.text} percent={boot.percent} regionsError={Boolean(session.readerErrors.regions)} metadataError={Boolean(session.readerErrors.metadata)} onRetry={session.refreshJobArtifacts} />
              {/* 底栏也浮在书页区底下（2026-11-28 用户：「继续往下做底部栏的」）：左、中、右三颗胶囊，只盖书页区。 */}
              <ReaderZoomHud
                mode={visiblePdfMode}
                modeControls={null}
                bookmarkScope={c.viewStateKey}
                startSlot={<ReaderFinderToggles open={finder} onToggle={finderState.toggleSidebar} issueCount={issueNav.issues.length} />}
                leftSlot={<ReaderPendingEditsPill edit={blockEdit} />}
                toolsSlot={<ReaderBarTools place="bottom" />}
              />
            </div>
            {/* 右边停靠栏：Markdown 面板开着、或提问窗贴右边时实占一栏，扩展把面板画进 .reader-dock-body（api.panelHost）。
                同一时间只停一个（useRightDockSlot）。Markdown 的宽度拖分栏线改（--reader-ai-split-width），提问窗的宽度它自己记、
                左边缘拖（reserveRight）。都没开时这一栏只是藏起来不卸掉：Markdown 面板第一次打开后一直挂着，留着滚动位置。 */}
            <aside
              className="reader-dock"
              hidden={!sideDocked}
              data-dock={assistantOpen ? "panel" : reserveRight ? "extension" : undefined}
              style={!assistantOpen && reserveRight ? ({ "--reader-dock-width": `${reserveRight}px` } as CSSProperties) : undefined}
              aria-label="阅读辅助面板"
            >
              <ReaderAssistantDock active={assistantPanel} />
              <div className="reader-dock-body" ref={setPanelHost} />
            </aside>
          </div>
          {assistantOpen ? <ReaderAssistantSplitResizeHandle /> : null}
          <ReaderOverlays
            session={session}
            zoomDocuments={zoomDocuments}
            zoomItem={zoomItem}
            setZoomItem={setZoomItem}
            closeZoom={closeZoom}
            visiblePdfMode={visiblePdfMode}
          />
          <ReaderPageMenu menu={pageMenu} onClose={closePageMenu} actions={menuItems} sections={menuSections} />
          <ReaderExtensionOutlets extensions={BUILTIN_READER_EXTENSIONS} />
          <DownloadToastHost />
        </div>
      </ReaderProvider>
    </ReaderExtensionsProvider>
  );
}