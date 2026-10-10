// 从 frontend/web 迁入的 React-pdf 视图真值，现为 @retainpdf/reader 主入口
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { readerViewportWidth } from "./pdf/reader-zoom.js";
import { resolveReaderInitialMode, shouldPersistReaderMode } from "./hooks/reader-initial-mode.js";
import type { ReaderMode } from "./hooks/use-reader-session.js";
import {
  loadReaderViewState,
  saveReaderViewState,
} from "./shared/state/reader-view-state.js";
import {
  ReaderProvider,
  type ReaderContextValue,
  type ReaderHudContextValue,
} from "./components/react-pdf/reader-context.js";

const ReaderMarkdownPanel = lazy(() => import("./components/react-pdf/ReaderMarkdownPanel.js").then((m) => ({ default: m.ReaderMarkdownPanel })));

import { useReaderPanelSlot } from "./components/react-pdf/use-reader-panel-slot.js";
import { ReaderHostPanelShell } from "./components/react-pdf/ReaderHostPanelShell.js";

/** 稳定的空数组：每次渲染新建一个会让每页的标记层白白重算。 */
import { READER_HOST_PANELS } from "./components/react-pdf/reader-host-panels.js";
import { resolveLiveTranslationToggles } from "./shared/data/live-translation-state.js";
import { renderReaderBoardSlot } from "./adapters.js";
import { createRegionHoverStore } from "./shared/state/region-hover-store.js";

/** 阅读视图可见台面的判别联合。 */
export type ReaderPaneComposition = {
  /**
   * 台面形态（单一真源）：
   * - source-only：单栏原文；
   * - translated-only：仅译文（右栏语义）；
   * - final-compare：左源右最终译文的并排；
   * - live-overlay：源栏原文 + 流式实时译文叠加（对照态保留右栏最终译文）。
   */
  kind: "source-only" | "translated-only" | "final-compare" | "live-overlay";
  /** 顶栏页签 / 键盘 / HUD 使用的可见 PDF 模式 */
  visibleMode: "source" | "compare" | "translated";
  compareMode: boolean;
  showSource: boolean;
  showTranslated: boolean;
  /**
   * 单一真值：是否把流式实时译文叠加到原文 PDF 上（Grid 消费）。
   * 仅在实时译文可用（最终译文 PDF 未就绪）时为 true；最终就绪后恒为 false。
   */
  overlayOnSource: boolean;
  /** 无 job：FAB / Markdown / AI 等「需要任务」能力判定 */
  sourceOnly: boolean;
  /** 无可并排的最终译文 (sourceOnly || !translatedUrl)：页签禁用判定 */
  sourceViewOnly: boolean;
};

/**
 * 单一纯函数，从 session.mode、实时译文可用/可见、助手开合与译文产物派生
 * 可见台面。原先散落在 app 的实时对照 / visiblePdfMode /
 * resolveReaderGridPresentation 全部收口到这里，Grid/Tabs/键盘/HUD 只消费结果。
 *
 * liveTranslationVisible 只作为「用户是否想开实时译文」的用户意图（默认关）：
 * 源栏按钮切换后，实时译文直接叠加在原文 PDF 上（overlayOnSource）；
 * overlayContentAvailable 表示「有可叠加的流式译文内容」（进行中或已完成都成立）。
 * 默认不叠加，避免旧「左右都是中文」的自动叠加 bug。
 */
export function resolveReaderPaneComposition(input: {
  mode: "source" | "compare" | "translated";
  sourceOnly: boolean;
  translatedUrl: string;
  overlayContentAvailable: boolean;
  liveTranslationVisible: boolean;
  assistantOpen: boolean;
  assistantPdfPane?: "source" | "translated" | null;
}): ReaderPaneComposition {
  const sourceViewOnly = input.sourceOnly || !input.translatedUrl;
  // 单一真值：仅「有可叠加译文内容且用户主动开启且无助手接管」时，
  // 在当前原文 PDF 上叠加流式译文。
  const overlayOnSource = Boolean(
    input.overlayContentAvailable
    && input.liveTranslationVisible
    && !input.assistantOpen,
  );
  // AI 从某栏选区发起时锁定该栏；否则助手分栏把对照降级为单栏原文。
  const pdfMode = input.assistantPdfPane
    || (input.assistantOpen && input.mode === "compare" ? "source" : input.mode);
  const visibleMode = pdfMode;
  // 对照态叠加不再「消栏」：overlay 只在源栏叠加流式画布，右栏（最终译文）
  // 照常保留。compareMode / showTranslated 不再被 overlay 强制关闭。
  //
  // **但要看有没有最终译文可挂。** 这两个值原来完全不看 sourceViewOnly，而真正
  // 挂载右栏的闸在别处（use-reader-pane-model 的 `mountTranslated = … && !sourceOnly`）。
  // 于是翻译还在跑、最终译文 PDF 还不存在时点「对照」：栅格按两列排
  // （minmax(0,1fr) 两份），第二列一个子元素都没有 —— 不是空状态文案，是**半个
  // 屏幕纯白**。而这正是翻译期间点对照的默认路径（pill 在时对照页签是放开的，
  // changeWorkspace 还会自动打开叠加）。
  const showTranslated = !sourceViewOnly
    && (visibleMode === "translated" || visibleMode === "compare");
  const compareMode = visibleMode === "compare" && showTranslated;
  const showSource = overlayOnSource || visibleMode !== "translated" || !showTranslated;
  const kind: ReaderPaneComposition["kind"] = overlayOnSource
    ? "live-overlay"
    : visibleMode === "compare"
      ? "final-compare"
      : visibleMode === "translated"
        ? "translated-only"
        : "source-only";
  return {
    kind,
    visibleMode,
    compareMode,
    showSource,
    showTranslated,
    overlayOnSource,
    sourceOnly: input.sourceOnly,
    sourceViewOnly,
  };
}

/**
 * 切换工作区页签时，是否自动开关实时译文叠加。
 * - 切到对照：仅在“实时译文真正可用（最终译文 PDF 未就绪）”时自动打开。
 *   任务完成后即使残留已提交的实时页，也不得自动选中「实时译文 · 已完成」。
 * - 离开对照（原文/译文）：关闭，回到页签自身的显示。
 * 返回 null 表示保持用户当前选择不动。
 */
export function resolveLiveTranslationVisibleOnWorkspaceChange(
  next: ReaderWorkspaceMode,
  liveTranslationAvailable: boolean,
): boolean | null {
  if (next === "compare") {
    return liveTranslationAvailable ? true : null;
  }
  return false;
}

export function ReaderAppReactPdf() {
  const c = useReaderReactController();
  const { boot, panes, sessionFiles, session } = c;
  // 「开着哪个面板」的恢复 / 持久化整段在 use-reader-assistant-panel 里 ——
  // 那是 effect 顺序的事，只有真渲染才测得到，所以单独成 hook 好被真渲染。
  const assistant = useReaderAssistantPanel(c.viewStateKey);
  const assistantPanel = assistant.panel;
  const setAssistantPanel = assistant.setPanel;
  const [assistantPdfPane, setAssistantPdfPane] = useState<"source" | "translated" | null>(null);
  // agent 产物在左边打开时，看的是哪个文件。null = 看 PDF。
  //
  // **不进 ReaderWorkspaceMode。** 那三个（源文件/对照/翻译文件）是
  // resolveReaderPaneComposition 的输入，连着持久化、键盘、HUD 和一堆 PDF 专属
  // 的不变式；往里加第四个成员会让「对照降级」「叠加层」那些判断全部要重想。
  // 这里是文档区的**接管**，和 PDF 栏二选一，所以是独立状态。
  const [boardFile, setBoardFile] = useState<string | null>(null);
  const [liveTranslationVisible, setLiveTranslationVisible] = useState(false);
  const modeScopeRef = useRef<string | null>(null);
  const autoModeRef = useRef<ReaderMode | null>(null);

  const assistantOpen = assistantPanel !== null;
  // 是否有「可叠加到原文 PDF 上的流式译文内容」：进行中（available）或已完成
  // （实时页仍在 state 里）都成立，供源栏开关显示与叠加判定。
  const hasOverlayContent = c.liveTranslationAvailable
    || c.liveTranslation.pagesByPage.size > 0;
  // 可见台面唯一真源：Grid / Tabs / 键盘 / HUD 都从这里取。
  const paneComposition = resolveReaderPaneComposition({
    mode: c.mode,
    sourceOnly: c.sourceOnly,
    translatedUrl: sessionFiles.translatedUrl,
    overlayContentAvailable: hasOverlayContent,
    liveTranslationVisible,
    assistantOpen,
    assistantPdfPane,
  });
  // 叠层的两个开关分别摆在哪 —— 判断在 live-translation-state.ts 里，因为
  // 「收掉顶栏 pill 之后叠层还够得着吗」这个不变式要能单测（见那里的注释）。
  const closeBoard = useCallback(() => setBoardFile(null), []);
  const boardContent = boardFile
    ? renderReaderBoardSlot({ jobId: session.jobId, name: boardFile, onClose: closeBoard })
    : null;
  const liveToggles = resolveLiveTranslationToggles({
    hasOverlayContent,
    connection: c.liveTranslation.connection,
    showSource: paneComposition.showSource,
    liveTranslationVisible,
    assistantOpen,
  });
  const sourceViewOnly = paneComposition.sourceViewOnly;
  const visiblePdfMode = paneComposition.visibleMode;
  // 换文档（或 viewStateKey 迁移）时丢掉上一本书的选区上下文。
  //
  // 这里原来还有一行 `setLiveTranslationVisible(true)`，它让上面那个
  // `useState(false)` 成了死初值 —— 挂载时就跑，而且 viewStateKey 每迁一次就
  // 再跑一次，连「任务到终态自动取消叠加」都能被它翻回来。和
  // resolveReaderPaneComposition 头上写的「默认不叠加，避免旧『左右都是中文』
  // 的自动叠加 bug」直接矛盾，删掉才是那段注释说的行为。
  // 需要自动打开的那一处走 resolveLiveTranslationVisibleOnWorkspaceChange。
  useEffect(() => {
    setBoardFile(null);
    setLiveTranslationVisible(false);
  }, [c.viewStateKey]);

  // 任务到终态后自动取消「实时译文」选中：终态应回到最终译文 PDF / 对照，
  // 不应默认停留在实时叠加态（用户仍可手动再点开）。
  useEffect(() => {
    if (c.session.jobTerminal) setLiveTranslationVisible(false);
  }, [c.session.jobTerminal]);

  // 栏锁（从某栏的选区问 AI）也是按 scope 作废的：换了书那一栏就不是那一栏了。
  useEffect(() => {
    setAssistantPdfPane(null);
  }, [assistant.scope]);

  // 阅读模式恢复/持久化：与 anchor/zoom 对齐。sourceViewOnly 时只允许 source。
  // 窄屏没有存档时自动进译文（resolveReaderInitialMode）；停在这个自动默认上时
  // 不写存档，用户换过模式之后照常写（shouldPersistReaderMode）。
  useEffect(() => {
    if (boot.loading || boot.failed) return;
    if (modeScopeRef.current !== c.viewStateKey) {
      modeScopeRef.current = c.viewStateKey;
      const saved = loadReaderViewState(c.viewStateKey);
      const initial = resolveReaderInitialMode({
        savedMode: saved?.mode,
        sourceViewOnly,
        viewportWidth: readerViewportWidth(),
      });
      autoModeRef.current = initial.auto ? initial.mode : null;
      if (initial.mode && initial.mode !== c.mode) {
        c.setModeKeepingPage(initial.mode);
      }
      return;
    }
    if (!shouldPersistReaderMode(c.mode, autoModeRef.current)) return;
    autoModeRef.current = null;
    saveReaderViewState(c.viewStateKey, { mode: c.mode });
  }, [boot.failed, boot.loading, c.mode, c.setModeKeepingPage, c.viewStateKey, sourceViewOnly]);
  const workspaceView = assistantPanel || (c.mode === "compare" ? "compare" : "reading");
  // 五个包内面板的开合 —— 每个 id 只在这里写一次，open 和挂载闸都从它派生。
  // 原来是「闸一遍、open 一遍」，两处各自合法，抄改时把闸上那个写成别的面板
  // 整套测试全绿而摘录永远打不开。见 use-reader-panel-slot.ts。
  const markdownSlot = useReaderPanelSlot(assistantPanel, "markdown");
  // 槽位面板（阅读路径 / 画布 / 终端）的挂载、适配器查找和壳都在
  // ReaderHostPanelShell 里，按 READER_HOST_PANELS 逐个渲染 —— 见下面那段 map。
  // 键盘与 UI 共用同一「可见模式」真源：paneComposition.visibleMode。
  // 「0」重置缩放据此取模式默认，避免与 HUD/网格显示的模式脱节。
  useReaderKeyboard({
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
    setAssistantPdfPane(null);
  }, []);
  const changeWorkspace = useCallback((next: ReaderWorkspaceMode) => {
    setAssistantPdfPane(null);
    // A running translation can provide the compare workspace before the
    // immutable translated PDF exists. Keep the visible workspace and the
    // top-bar selection in sync instead of asking the session mode (which is
    // correctly source-only until the final artifact arrives) to represent
    // this temporary live pair.
    const autoEnable = resolveLiveTranslationVisibleOnWorkspaceChange(next, c.liveTranslationAvailable);
    if (autoEnable !== null) setLiveTranslationVisible(autoEnable);
    c.setModeKeepingPage(next);
  }, [c.liveTranslationAvailable, c.setModeKeepingPage]);

  // 源栏「译文」开关：把流式译文直接叠在原文 PDF 上 / 收起。进行中与完成后
  // 都可用（只要有可叠加内容）。默认关，避免自动叠加造成「左右都中文」。
  const sourcePaneAction = useMemo(() => {
    if (!liveToggles.sourcePaneToggle) return null;
    return (
      <button
        type="button"
        className={`reader-live-translation-toggle${liveTranslationVisible ? " is-active" : ""}`}
        onClick={() => setLiveTranslationVisible((visible) => !visible)}
        aria-pressed={liveTranslationVisible}
        title={liveTranslationVisible ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文"}
      >
        译文
      </button>
    );
  }, [liveToggles.sourcePaneToggle, liveTranslationVisible]);

  const selectAssistant = useCallback((next: ReaderAssistantPanel) => {
    setAssistantPanel(next);
    // 栏锁的语义是「这一次从某栏的选区问 AI」，生命周期跟着那次提问。
    //
    // 清它的路原来覆盖了「关面板」「切顶栏页签」「换文档」，**唯独漏了换面板**
    // —— 而换面板是 dock 上最常用的动作。漏掉的表现：在译文栏问过 AI 之后点
    // Markdown，面板换了，PDF 那半边却还只剩译文栏，顶栏还挂着「对照被面板挤掉」。
    setAssistantPdfPane(null);
  }, []);

  const hostPanelContext = useMemo(() => ({
    // **只认 jobId**，不拿 documentId 兜底（契约见 adapters.ts：「用 jobId，换文档
    // 就换终端」）。原来是 `session.jobId || session.documentId || "reader"`，于是
    // 没有任务的阅读页（书架卡片在没有 job_id 时跳 `reader.html?document_id=…`）会
    // 拿一个 document id 当 job id 用，四处同时静默失败：
    //
    //   - fx 侧 resolve_job_workspace 找不到 data/jobs/<documentId> → 退回私有目录，
    //     终端开起来了但 books/ 是空的，无报错
    //   - 产物条每 4 秒打 /api/v1/jobs/<documentId>/board → 404 → 静默跳过
    //   - 左边那块 renderReaderBoard 看 !jobId → 静默返回 null
    //
    // 空字符串在这里是有意义的信号：renderReaderTerminal 会改画一段说明，
    // 而不是一个开得起来却什么都做不了的空壳。
    sessionKey: session.jobId,
    // 以前「点块 → 浮条 → 问 AI」会把选区预填进终端；浮条整个删了（只留悬停复制），
    // 阅读器这边没有要预填的了。宿主的注入能力保留，接口不动。
    pendingInput: null,
    onOpenBoard: setBoardFile,
    onClose: closeAssistant,
  }), [closeAssistant, session.documentId, session.jobId]);

  // 外壳 Context：只装频繁下钻、且此前纯透传的值；currentPage/numPages 走 HUD
  // context，避免滚动带动整棵外壳重渲染。
  const [regionHover] = useState(createRegionHoverStore);
  const jumpToBlock = useCallback((itemId: string) => c.jumpToAnchor({ block_id: itemId }), [c.jumpToAnchor]);
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
    revisedBlocks: c.revisedBlocks,
    sourceOnly: c.sourceOnly,
    sourceViewOnly,
    download: c.download,
    goToPage: c.goToPage,
    assistant: { select: selectAssistant, close: closeAssistant },
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
    c.revisedBlocks,
    c.sourceOnly,
    sourceViewOnly,
    c.download,
    c.goToPage,
    selectAssistant,
    closeAssistant,
  ]);

  const readerHud = useMemo<ReaderHudContextValue>(() => ({
    currentPage: c.currentPage,
    numPages: panes.hudNumPages,
  }), [c.currentPage, panes.hudNumPages]);

  const rootClasses = [
    READER_ROOT_CLASS,
    `is-workspace-${workspaceView}`,
    assistantOpen ? "is-assistant-open" : "",
    paneComposition.overlayOnSource ? "is-live-translation-overlay" : "",
  ].filter(Boolean).join(" ");

  return (
    <ReaderProvider value={readerContext} hud={readerHud}>
      <div className={rootClasses} data-reader-engine="react-pdf" data-reader-workspace={workspaceView}>
        <ReaderReactBoot loading={boot.loading} failed={boot.failed} text={boot.text} percent={boot.percent} regionsError={Boolean(session.readerErrors.regions)} metadataError={Boolean(session.readerErrors.metadata)} />
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
          } : null}
        />
        <ReaderAssistantDock active={assistantPanel} />
        {assistantOpen ? <ReaderAssistantSplitResizeHandle /> : null}
        <ReaderCompareGrid paneComposition={paneComposition} markdownSplit={markdownSlot.open} assistantSplit={assistantOpen} liveTranslation={c.liveTranslation} sourcePaneAction={sourcePaneAction} />
        {/* agent 产物盖在文档区上，**不替换** ReaderCompareGrid。
          *
          * 换成二选一的话，开一张图再关掉，PDF 栅格整个重建 —— 阅读位置、已渲染
          * 的页、缩放全丢。和终端面板用 hidden 而不是卸载是同一个理由。
          *
          * 宿主没注册渲染器时 boardContent 是 null，这里什么都不画，下面还是 PDF：
          * 「功能没实现」要表现为「没有这个东西」，不是一块白屏。 */}
        {boardContent}
        {c.showHud ? (
          <ReaderZoomHud
            mode={visiblePdfMode}
            modeControls={null}
            bookmarkScope={c.viewStateKey}
          />
        ) : null}
        <Suspense fallback={null}>
          {READER_HOST_PANELS.map((panel) => (
            <ReaderHostPanelShell
              key={panel.id}
              panel={panel}
              active={assistantPanel}
              context={hostPanelContext}
            />
          ))}
          {markdownSlot.mounted ? <ReaderMarkdownPanel open={markdownSlot.open} jobId={session.jobId} sourceOnly={c.sourceOnly} side="right" onClose={closeAssistant} /> : null}
        </Suspense>
        <DownloadToastHost />
      </div>
    </ReaderProvider>
  );
}
