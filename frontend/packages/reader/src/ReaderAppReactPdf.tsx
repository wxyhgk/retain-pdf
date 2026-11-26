// 从 frontend/web 迁入的 React-pdf 视图真值，现为 @retainpdf/reader 主入口
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReaderReactController } from "./hooks/use-reader-react-controller.js";
import { ArrowLeft } from "lucide-react";
import { Button } from "@retainpdf/ui";
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
import { READER_PAGE_ATTR, READER_ROOT_CLASS } from "./pdf/reader-dom-contract.js";
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

/** 稳定的空数组：每次渲染新建一个会让每页的标记层白白重算。 */
import {
  latestLiveTranslationPage,
  resolveLiveTranslationToggles,
  shouldAutoOpenLiveTranslation,
  shouldOfferLiveTranslationCompletion,
} from "./shared/data/live-translation-state.js";
import { isEditableReaderBlock } from "./shared/data/block-edit.js";
import { createRegionHoverStore } from "./shared/state/region-hover-store.js";
import { ReaderFinder, ReaderFinderToggles, ReaderSearchToggle, type ReaderFinderTab } from "./components/react-pdf/ReaderFinder.js";
import { ReaderToolBall } from "./components/react-pdf/ReaderToolBall.js";
import { ReaderInkDock, ReaderInkMenu, inkMenuFromContextMenu, useInkShortcuts, type InkMenuState } from "./components/react-pdf/ReaderInkPalette.js";
import { useReaderInk } from "./hooks/use-reader-ink.js";
import { useReaderVersionCompare } from "./hooks/use-reader-version-compare.js";
import { useFindShortcut } from "./hooks/use-find-shortcut.js";
import { useReaderBlockEdit, useEditBlockShortcut } from "./hooks/use-reader-block-edit.js";
import { ReaderPendingEditsPill } from "./components/react-pdf/ReaderPendingEditsPill.js";
import { useReaderDocTheme } from "./hooks/use-reader-doc-theme.js";
import type { PdfOutlineNode } from "./pdf/pdf-outline.js";
import type { RegionPdfDocument } from "./pdf/RegionCanvas.js";
import { ReaderZoomViewer } from "./components/react-pdf/ReaderZoomViewer.js";
import { ReaderXrefPreview } from "./components/react-pdf/ReaderXrefPreview.js";
import type { ReaderAskAnchor } from "./contracts/ask.js";
import { buildAskAnchor, selectedPageText } from "./ask/anchor.js";
import { readerSessionDataPort } from "./external.js";
import { useAskThreads } from "./ask/use-ask-threads.js";

// 提问窗单独一块（assistant-ui、streamdown、KaTeX 都在里面），第一次提问才加载。
const ReaderAskPanel = lazy(() => import("./ask/ReaderAskPanel.js"));
import { useReaderXrefs } from "./hooks/use-reader-xrefs.js";
import { buildXrefIndex, type XrefTarget } from "./shared/content/reader-xrefs.js";

/** 稳定的空书签列表（每次新建一个会让目录卡白白重算）。 */
const NO_BOOKMARKS: PdfOutlineNode[] = [];

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
}): ReaderPaneComposition {
  const sourceViewOnly = input.sourceOnly || !input.translatedUrl;
  // 单一真值：仅「有可叠加译文内容且用户主动开启且无助手接管」时，
  // 在当前原文 PDF 上叠加流式译文。
  const overlayOnSource = Boolean(
    input.overlayContentAvailable
    && input.liveTranslationVisible
    && !input.assistantOpen,
  );
  // 开着面板时把对照降级为单栏原文（以前 AI 还能从某栏选区发起、锁定那一栏，2026-11-03 随 AI 删了）。
  const pdfMode = input.assistantOpen && input.mode === "compare" ? "source" : input.mode;
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
  });
  // 叠层的两个开关分别摆在哪 —— 判断在 live-translation-state.ts 里，因为
  // 「收掉顶栏 pill 之后叠层还够得着吗」这个不变式要能单测（见那里的注释）。
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
    setLiveTranslationVisible(false);
  }, [c.viewStateKey]);

  // 任务到终态后自动取消「实时译文」选中：终态应回到最终译文 PDF / 对照，
  // 不应默认停留在实时叠加态（用户仍可手动再点开）。
  useEffect(() => {
    if (c.session.jobTerminal) setLiveTranslationVisible(false);
  }, [c.session.jobTerminal]);

  // 翻译还在跑、还没有最终译文时，打开就叠上译文（条件见 shouldAutoOpenLiveTranslation）。
  // 每本书（viewStateKey）只自动开一次：之后用户关掉就是关掉，不再被翻回来。
  // 上面那个按 viewStateKey 复位成 false 的 effect 写在前面，同一次提交里先跑，这里再打开。
  const autoLiveOpenedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (autoLiveOpenedKeyRef.current === c.viewStateKey) return;
    if (!shouldAutoOpenLiveTranslation({
      liveTranslationAvailable: c.liveTranslationAvailable,
      sourceViewOnly,
      jobTerminal: c.session.jobTerminal,
    })) return;
    autoLiveOpenedKeyRef.current = c.viewStateKey;
    setLiveTranslationVisible(true);
  }, [c.liveTranslationAvailable, c.session.jobTerminal, c.viewStateKey, sourceViewOnly]);

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
  const latestLivePage = latestLiveTranslationPage(c.liveTranslation);
  const jumpToLatestLivePage = useCallback(() => {
    if (latestLivePage) c.goToPage(latestLivePage, "source");
  }, [c.goToPage, latestLivePage]);
  // 「翻译完成 · 看对照」：点过、或者自己切到过对照，这本书就不再提示。
  const [completionDismissedKey, setCompletionDismissedKey] = useState<string | null>(null);
  useEffect(() => {
    if (visiblePdfMode === "compare" && c.session.jobTerminal) setCompletionDismissedKey(c.viewStateKey);
  }, [c.session.jobTerminal, c.viewStateKey, visiblePdfMode]);
  const offerCompletion = completionDismissedKey !== c.viewStateKey
    && shouldOfferLiveTranslationCompletion({
      state: c.liveTranslation,
      sourceViewOnly,
      visibleMode: visiblePdfMode,
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
  }, []);

  // 外壳 Context：只装频繁下钻、且此前纯透传的值；currentPage/numPages 走 HUD
  // context，避免滚动带动整棵外壳重渲染。
  const [regionHover] = useState(createRegionHoverStore);
  // 左栏的目录 / 搜索：开着哪一页签，null 收着。
  const [finder, setFinder] = useState<ReaderFinderTab | null>(null);
  const toggleFinder = useCallback((tab: ReaderFinderTab) => setFinder((open) => (open === tab ? null : tab)), []);
  // 搜索词：输入框里的字和防抖后的词。防抖后的词才去扫全书、标书页——每敲一下就扫，几百页的书会卡。
  // 收起左栏不清词，再打开还在；收起时书页上不标。
  const [findQuery, setFindQuery] = useState("");
  const [findTerm, setFindTerm] = useState("");
  useEffect(() => {
    const next = findQuery.replace(/\s+/gu, " ").trim();
    const timer = window.setTimeout(() => setFindTerm(next), next ? 150 : 0);
    return () => window.clearTimeout(timer);
  }, [findQuery]);
  const [findFocus, setFindFocus] = useState(0);
  // Cmd/Ctrl+F 打开书内搜索（再按一次交还浏览器，见 use-find-shortcut）。
  const openFind = useCallback(() => {
    setFinder("search");
    setFindFocus((count) => count + 1);
  }, []);
  useFindShortcut(openFind);
  const jumpFromFinder = useCallback((itemId: string) => {
    c.jumpToAnchor({ block_id: itemId });
    // 卡浮在书上：在目录里点一条就收起；搜索时留着（接着按回车走下一处），窄屏上搜索也收起（卡盖着书）。
    if (finder === "outline" || readerViewportWidth() < 900) setFinder(null);
  }, [c.jumpToAnchor, finder]);
  const jumpToBlock = useCallback((itemId: string) => c.jumpToAnchor({ block_id: itemId }), [c.jumpToAnchor]);
  // PDF 自带的书签（目录卡优先用它）：按栏记，带上是哪个文件的，换书、换文件就作废。原文的优先（译文 PDF 多半没有书签）。
  const [pdfOutlines, setPdfOutlines] = useState<Partial<Record<"source" | "translated", { url: string; nodes: PdfOutlineNode[] }>>>({});
  const outlineUrls = useRef({ source: sessionFiles.sourceUrl, translated: sessionFiles.translatedUrl });
  outlineUrls.current = { source: sessionFiles.sourceUrl, translated: sessionFiles.translatedUrl };
  const onPdfOutline = useCallback((nodes: PdfOutlineNode[], pane: "source" | "translated") => {
    setPdfOutlines((current) => ({ ...current, [pane]: { url: outlineUrls.current[pane], nodes } }));
  }, []);
  const bookmarks = useMemo(() => {
    const source = pdfOutlines.source;
    if (source && source.url === sessionFiles.sourceUrl && source.nodes.length) return source.nodes;
    const translated = pdfOutlines.translated;
    if (translated && translated.url === sessionFiles.translatedUrl && translated.nodes.length) return translated.nodes;
    return NO_BOOKMARKS;
  }, [pdfOutlines, sessionFiles.sourceUrl, sessionFiles.translatedUrl]);
  // 放大查看：各栏读好的 PDF（按文件记，换文件作废）和开着的那一块。
  const pdfDocs = useRef<Partial<Record<"source" | "translated", { url: string; pdf: RegionPdfDocument }>>>({});
  const [pdfDocsVersion, setPdfDocsVersion] = useState(0);
  const onPdfDocument = useCallback((pdf: RegionPdfDocument, pane: "source" | "translated") => {
    pdfDocs.current[pane] = { url: outlineUrls.current[pane], pdf };
    setPdfDocsVersion((version) => version + 1);
  }, []);
  const [zoomItem, setZoomItem] = useState<string | null>(null);
  const zoomBlock = useCallback((itemId: string) => setZoomItem(itemId), []);
  const closeZoom = useCallback(() => setZoomItem(null), []);
  useEffect(() => setZoomItem(null), [c.viewStateKey]);
  const zoomDocuments = useMemo(() => {
    const pick = (pane: "source" | "translated", url: string) => {
      const entry = pdfDocs.current[pane];
      return entry && entry.url === url ? entry.pdf : null;
    };
    return { source: pick("source", sessionFiles.sourceUrl), translated: pick("translated", sessionFiles.translatedUrl) };
  }, [pdfDocsVersion, sessionFiles.sourceUrl, sessionFiles.translatedUrl]);
  // 书里的引用：去处索引、悬停预览、点了跳、Alt+← 回来。
  const xrefIndex = useMemo(() => buildXrefIndex(session.regions), [session.regions]);
  const followXref = useCallback(
    (target: XrefTarget, pane: "source" | "translated") => c.jumpToAnchor({ block_id: target.itemId }, pane),
    [c.jumpToAnchor],
  );
  const xrefs = useReaderXrefs({ shellEl: c.shell.shellEl, index: xrefIndex, primaryPane: c.panes.primaryPane, follow: followXref });
  const jumpToPageFromFinder = useCallback((page: number) => {
    c.goToPage(page);
    if (finder === "outline" || readerViewportWidth() < 900) setFinder(null);
  }, [c.goToPage, finder]);
  // 改译文：悬停框里的「改」、按 E 都是把这一段变成编辑框（在译文栏里）。只开着原文栏时先切到对照。
  const blockEdit = useReaderBlockEdit({
    jobId: session.jobId,
    jobStatus: session.jobStatus,
    jobPayload: session.download.jobPayload,
    hasTranslation: !c.sourceOnly && Boolean(sessionFiles.translatedUrl),
    refreshJobStatus: session.refreshJobStatus,
  });
  const selectBlock = blockEdit.select;
  const setModeKeepingPage = c.setModeKeepingPage;
  const regions = session.regions;
  const editBlock = useCallback((itemId: string) => {
    if (!isEditableReaderBlock(regions, itemId)) return; // 表格译文还不能改（block-edit 的 EDITABLE_KINDS）
    if (visiblePdfMode === "source") setModeKeepingPage("compare");
    selectBlock(itemId);
  }, [regions, selectBlock, visiblePdfMode, setModeKeepingPage]);
  useEditBlockShortcut(blockEdit.available ? editBlock : null, regionHover);
  // 画笔：笔迹按书存在本机（hooks/use-reader-ink），右键书页出小菜单，P 进出画笔模式。
  const ink = useReaderInk(c.viewStateKey);
  useInkShortcuts(ink);
  const [inkMenu, setInkMenu] = useState<InkMenuState>(null);
  const closeInkMenu = useCallback(() => setInkMenu(null), []);
  // 阅读页提问（docs/ops/planning/reader-ask/）：宿主给了 ACP 端口才有。右键「在这里提问 / 问这段」，书页上选着字时按 ? 也行。
  const askPort = useMemo(() => {
    try {
      return readerSessionDataPort().ask ?? null;
    } catch {
      return null;
    }
  }, []);
  const [menuAsk, setMenuAsk] = useState<ReaderAskAnchor | null>(null);
  // 问过的地方（书页白边的「?」）、开着的那一次、每答完一轮存（问答记录，宿主给了才存后端）。
  const askThreads = useAskThreads({ port: askPort, documentId: session.documentId || "", resetKey: c.viewStateKey });
  const askMarks = askThreads.marks;
  const openAsk = askThreads.ask;
  const reopenAsk = askThreads.reopen;
  const ask = askThreads.open;
  const anchorAt = useCallback(
    (target: Element | null, clientX: number, clientY: number, selection: string) => buildAskAnchor({
      pageElement: target?.closest(`[${READER_PAGE_ATTR}]`) ?? null,
      clientX,
      clientY,
      itemId: regionHover.get().itemId,
      selection,
      regions: session.regions,
      bookmarks,
      metadata: session.readerMetadata,
    }),
    [regionHover, session.regions, bookmarks, session.readerMetadata],
  );
  // 选着书页上的字按 ? → 问这段。只在选着字时拦（不然 ? 照旧是快捷键帮助），捕获阶段先拿到、拦下帮助。
  useEffect(() => {
    if (!askPort) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "?" || event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("input, textarea, select, [contenteditable='true']")) return;
      const picked = selectedPageText(globalThis.getSelection?.() ?? null);
      if (!picked.text || !picked.element || !picked.rect) return;
      const anchor = anchorAt(picked.element, picked.rect.left + picked.rect.width / 2, picked.rect.top + picked.rect.height / 2, picked.text);
      if (!anchor) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openAsk(anchor);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [askPort, anchorAt, openAsk]);
  // 「对比版本」：选了一份就切到对照（左栏放那一份）；切走对照（只看原文 / 译文）就不对比了。
  const versionCompare = useReaderVersionCompare({ documentId: session.documentId, jobId: session.jobId });
  const comparedUrl = versionCompare.compared?.url || "";
  useEffect(() => {
    if (comparedUrl && visiblePdfMode !== "compare") changeWorkspace("compare");
    // 只在选中另一份时切一次；之后用户自己切走由下面那个 effect 收掉对比。
  }, [comparedUrl]);
  useEffect(() => {
    if (visiblePdfMode !== "compare") versionCompare.clear();
  }, [visiblePdfMode]);
  const compareVersion = useMemo(
    () => {
      const { compared, versions, readingVersionId } = versionCompare;
      if (!compared) return null;
      // 两栏书页上的水印：左边是对比的那份，右边是正在读的那份（名字、时间）。
      const left = versions.find((version) => version.versionId === compared.versionId);
      const right = versions.find((version) => version.versionId === readingVersionId);
      return {
        url: compared.url,
        regions: compared.regions,
        left: { name: compared.name, createdAt: left?.createdAt || "" },
        right: { name: right?.name || "当前译文", createdAt: right?.createdAt || "" },
      };
    },
    [versionCompare.compared, versionCompare.versions, versionCompare.readingVersionId],
  );
  const revisedBlocks = useMemo(() => {
    if (!blockEdit.savedCounts.size) return c.revisedBlocks;
    const merged = new Map(c.revisedBlocks);
    for (const [itemId, count] of blockEdit.savedCounts) merged.set(itemId, (merged.get(itemId) || 0) + count);
    return merged;
  }, [c.revisedBlocks, blockEdit.savedCounts]);
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
    xrefIndex,
    askMarks,
    onAskMark: reopenAsk,
    editBlock: blockEdit.available ? editBlock : undefined,
    blockEdit,
    editShowsSource: visiblePdfMode !== "compare",
    findTerm: finder === "search" ? findTerm : "",
    compareVersion,
    ink,
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
    xrefIndex,
    askMarks,
    reopenAsk,
    blockEdit,
    editBlock,
    visiblePdfMode,
    finder,
    findTerm,
    compareVersion,
    ink,
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
    <ReaderProvider value={readerContext} hud={readerHud}>
      <div
        className={rootClasses}
        data-reader-engine="react-pdf"
        data-reader-workspace={workspaceView}
        data-ink-mode={ink.tool || undefined}
        onContextMenu={(event) => {
          const menu = inkMenuFromContextMenu(event);
          if (!menu) return;
          event.preventDefault();
          if (askPort) {
            const picked = selectedPageText(globalThis.getSelection?.() ?? null);
            setMenuAsk(anchorAt(event.target as Element, event.clientX, event.clientY, picked.element ? picked.text : ""));
          }
          setInkMenu(menu);
        }}
      >
        <ReaderReactBoot loading={boot.loading} failed={boot.failed} text={boot.text} percent={boot.percent} regionsError={Boolean(session.readerErrors.regions)} metadataError={Boolean(session.readerErrors.metadata)} onRetry={session.refreshJobArtifacts} />
        {/* 三路下载和「关闭回主页」同一组：顶栏常驻，任何面板开着都够得到。
            原来它们在可拖动圆钮的菜单里，而圆钮一开 dock 就被 CSS 整个吃掉。 */}
        <ReaderFinderToggles open={finder} onToggle={toggleFinder} />
        {finder ? (
          <ReaderFinder
            tab={finder}
            onTab={setFinder}
            onClose={() => setFinder(null)}
            onJump={jumpFromFinder}
            bookmarks={bookmarks}
            onJumpPage={jumpToPageFromFinder}
            query={findQuery}
            onQuery={setFindQuery}
            term={findTerm}
            focusSignal={findFocus}
          />
        ) : null}
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
        <ReaderCompareGrid paneComposition={paneComposition} markdownSplit={markdownSlot.open} assistantSplit={assistantOpen} liveTranslation={c.liveTranslation} sourcePaneAction={sourcePaneAction} />
        {c.showHud ? (
          <ReaderZoomHud
            mode={visiblePdfMode}
            modeControls={null}
            bookmarkScope={c.viewStateKey}
            issuesJobId={c.sourceOnly ? "" : session.jobId}
            searchSlot={<ReaderSearchToggle open={finder} onToggle={toggleFinder} />}
          />
        ) : null}
        <Suspense fallback={null}>
          {markdownSlot.mounted ? <ReaderMarkdownPanel open={markdownSlot.open} jobId={session.jobId} sourceOnly={c.sourceOnly} side="right" onClose={closeAssistant} /> : null}
        </Suspense>
        {xrefs.preview ? (
          <ReaderXrefPreview preview={xrefs.preview} regions={session.regions} metadata={session.readerMetadata} documents={zoomDocuments} />
        ) : null}
        {xrefs.canGoBack ? (
          <Button className="reader-xref-back" title="回到跳之前读到的地方（Alt+←）" onClick={() => xrefs.goBack()}>
            <ArrowLeft size={14} aria-hidden /> 回到第 {xrefs.backPage} 页
          </Button>
        ) : null}
        {zoomItem ? (
          <ReaderZoomViewer
            itemId={zoomItem}
            regions={session.regions}
            metadata={session.readerMetadata}
            documents={zoomDocuments}
            panes={visiblePdfMode === "compare" ? ["source", "translated"] : visiblePdfMode === "translated" ? ["translated"] : ["source"]}
            onNavigate={setZoomItem}
            onClose={closeZoom}
          />
        ) : null}
        <ReaderToolBall active={assistantPanel} compare={versionCompare} ink={ink} />
        <ReaderInkMenu
          ink={ink}
          menu={inkMenu}
          onClose={closeInkMenu}
          actions={askPort && menuAsk ? [{
            key: "ask",
            label: menuAsk.selection ? "问这段" : "在这里提问",
            hint: menuAsk.selection ? "?" : undefined,
            onSelect: () => openAsk(menuAsk),
          }] : []}
        />
        {askPort && ask ? (
          <Suspense fallback={null}>
            <ReaderAskPanel
              key={ask.key}
              port={askPort}
              jobId={session.jobId}
              anchor={ask.anchor}
              onClose={askThreads.close}
              onShowAnchor={() => c.goToPage(ask.anchor.page, ask.anchor.pane)}
              onJumpToPage={(page) => c.goToPage(page, ask.anchor.pane)}
              pageCount={panes.hudNumPages || 0}
              initialMessages={ask.initial}
              onTurnDone={(messages, agentId, sessionId) => askThreads.save(ask.key, messages, agentId, sessionId)}
              onDelete={() => askThreads.remove(ask.key)}
            />
          </Suspense>
        ) : null}
        <ReaderInkDock ink={ink} />
        <ReaderPendingEditsPill edit={blockEdit} />
        <DownloadToastHost />
      </div>
    </ReaderProvider>
  );
}
