import { useCallback, useState, useSyncExternalStore, type ReactElement } from "react";
import type { ReactNode } from "react";
import { PdfDocumentPane } from "../../pdf/PdfDocumentPane.js";
import type { ProtectedPdfFile } from "../../pdf/useProtectedPdfFile.js";
import type { PageRowHeights } from "../../pdf/usePageRowSync.js";
import { READER_ZOOM_DEFAULT } from "../../pdf/reader-zoom.js";
import { useKeepPageOnResize } from "../../hooks/use-keep-page-on-resize.js";
import {
  READER_GRID_CLASS,
  READER_SCROLL_SHELL_CLASS,
} from "../../pdf/reader-dom-contract.js";
import {
  isStructuredReaderRegion,
  type ReaderMetadata,
  type ReaderRegion,
} from "../../shared/data/reader-regions.js";
import type { LiveTranslationState } from "../../shared/data/live-translation-state.js";
import type { ReaderPaneComposition } from "../../ReaderAppReactPdf.js";
import { useReaderContext } from "./reader-context.js";


const noopSubscribe = () => () => {};
const nullSnapshot = (): string | null => null;

export type ReaderCompareGridProps = {
  mode?: string; // ReaderMode
  /** 以下 controller 透传值缺省时从 reader context 取 */
  bindShell?: (node: HTMLDivElement | null) => void;
  shellEl?: HTMLElement | null;
  userZoom?: number;
  compareMode?: boolean;
  /** 阅读区全宽（shell），用于 zoom% 相对整屏计算 */
  shellWidth?: number;
  rowHeights?: PageRowHeights;
  mountSource?: boolean;
  mountTranslated?: boolean;
  showSource?: boolean;
  showTranslated?: boolean;
  /** 「无可并排的最终译文」；仅决定源文件缺失文案，不是 FAB 的 sourceOnly */
  sourceViewOnly?: boolean;
  sourceUrl?: string;
  translatedUrl?: string;
  sourceFile?: ProtectedPdfFile | null;
  translatedFile?: ProtectedPdfFile | null;
  onMetrics?: () => void;
  onNumPagesChange?: (pages: number, pane: "source" | "translated") => void;
  activeRegion?: ReaderRegion | null;
  regions?: ReaderRegion[];
  readerMetadata?: ReaderMetadata | null;
  markdownSplit?: boolean;
  assistantSplit?: boolean;
  liveTranslation?: LiveTranslationState;
  /** 源栏右上角动作（如「译文」叠加开关）；挂在 pane="source" 容器内。 */
  sourcePaneAction?: ReactNode;
  /**
   * 单一真值：是否把流式实时译文叠加到原文 PDF 上。
   * 仅当实时译文可用（最终译文 PDF 未就绪）时为 true；就绪后恒为 false。
   */
  overlayOnSource?: boolean;
  /**
   * 可见台面判别联合（单一真源）。提供时覆盖 mode/compareMode/
   * showSource/showTranslated/overlayOnSource 这几个散落输入。
   */
  paneComposition?: ReaderPaneComposition;
};

export function resolveReaderGridPresentation({
  mode,
  compareMode,
  showSource,
  showTranslated,
  markdownSplit,
  overlayOnSource = false,
}: Pick<ReaderCompareGridProps, "mode" | "compareMode" | "showSource" | "showTranslated"> & {
  markdownSplit: boolean;
  overlayOnSource?: boolean;
}) {
  // 对照态叠加不再「消栏」：overlayOnSource 只决定源栏是否挂流式画布，
  // 不再强制单栏。右栏（最终译文 PDF）由 paneComposition.showTranslated
  // 保留，避免右栏消失像对照坏了。overlayOnSource 保留在签名中以兼容
  // 旧调用方（未使用）。
  void overlayOnSource;
  const splitSourceCompare = markdownSplit && mode === "compare";
  return {
    mode: splitSourceCompare ? "source" : mode,
    compareMode: compareMode && !markdownSplit,
    showSource: splitSourceCompare ? true : showSource,
    showTranslated: splitSourceCompare ? false : showTranslated,
  };
}

/** 页宽的基准。
 *
 * 开着侧栏时用双倍 shell 宽 —— 这样 50% 缩放恰好铺满 PDF 那一栏（见调用处的
 * 注释）。
 *
 * # 原来那个 viewport 封顶是错的
 *
 * 曾经是 `Math.min(shellWidth * 2, viewportWidth)`，注释说封顶是为了压掉
 * 「ResizeObserver 晚一帧」造成的一次闪动。但分栏是**可拖的**（30%–65%），
 * 于是在 30%–50% 这半个区间里 `shellWidth * 2 > viewport`，基准被钳成常量：
 *
 *     面板 30%  shell 1344  基准 1920(封顶)  50%页宽 936   栏宽 1344
 *     面板 40%  shell 1152  基准 1920(封顶)  50%页宽 936   栏宽 1152
 *     面板 50%  shell  960  基准 1920        50%页宽 936   栏宽  960  ← 只有这里对
 *     面板 65%  shell  672  基准 1344        50%页宽 648   栏宽  672
 *
 * 用户看到的：把分隔条往右拖给 PDF 更多地方，**页面一点都不变大**，两侧白边
 * 越拖越宽；反方向拉却会跟着缩小。同一根分隔条，两个方向行为不对称。
 *
 * 一个**瞬态**护栏被写成了稳态上限。那一帧的闪动现在由 PdfDocumentPane 的
 * 200ms settle 吸收（见 resolveReaderWidthCommit），不需要在这里封顶。
 *
 * viewportWidth 参数保留：调用方仍然传，但只在 shell 还没量出来时兜底。
 */
export function resolveReaderPageWidthBasis(
  shellWidth: number,
  sidePanelSplit: boolean,
  viewportWidth = shellWidth * 2,
): number {
  if (!sidePanelSplit) return shellWidth;
  // shell 还没量出来（首帧）时才用 viewport 兜底，别让页宽算成 0。
  if (!Number.isFinite(shellWidth) || shellWidth <= 0) return viewportWidth;
  return shellWidth * 2;
}

export function liveTranslationPendingCopy(state: LiveTranslationState | undefined): string {
  if (!state) return "";
  if (state.connection === "terminal" && state.jobStatus === "failed") {
    return state.pagesByPage.size > 0
      ? `翻译已暂停，已保留 ${state.pagesByPage.size} 页译文`
      : "翻译已暂停，原始 PDF 仍可阅读";
  }
  if (state.connection === "terminal" && ["cancelled", "canceled"].includes(state.jobStatus)) {
    return state.pagesByPage.size > 0
      ? `翻译已取消，已保留 ${state.pagesByPage.size} 页译文`
      : "翻译已取消，原始 PDF 仍可阅读";
  }
  if (state.pagesByPage.size > 0) return "";
  if (state.connection === "unavailable") {
    return state.error || "实时译文暂不可用，原始 PDF 仍可阅读";
  }
  if (state.error) return state.error;
  if (state.layoutByPage.size === 0) {
    return "正在完成 OCR，译文将在这里逐页出现";
  }
  return "版面已就绪，正在等待首个译文页面";
}

export function ReaderCompareGrid(props: ReaderCompareGridProps): ReactElement {
  const ctx = useReaderContext();
  const {
    markdownSplit = false,
    assistantSplit = false,
    liveTranslation,
    paneComposition,
  } = props;
  // 可见台面以 paneComposition 为单一真源；缺省时回退到显式 props（直接单测）。
  const mode = paneComposition?.visibleMode ?? props.mode ?? "compare";
  const compareMode = paneComposition?.compareMode ?? props.compareMode ?? mode === "compare";
  const showSource = paneComposition?.showSource ?? props.showSource ?? true;
  const showTranslated = paneComposition?.showTranslated
    ?? props.showTranslated
    ?? (mode === "compare" || mode === "translated");
  const overlayOnSource = paneComposition?.overlayOnSource ?? props.overlayOnSource ?? false;
  const bindShell = props.bindShell ?? ctx?.bindShell;
  const shellEl = props.shellEl ?? ctx?.shellEl ?? null;
  const userZoom = props.userZoom ?? ctx?.userZoom ?? READER_ZOOM_DEFAULT;
  const shellWidth = props.shellWidth ?? ctx?.shellWidth ?? 0;
  const rowHeights = props.rowHeights ?? ctx?.rowHeights;
  const mountSource = props.mountSource ?? ctx?.mountSource ?? false;
  const mountTranslated = props.mountTranslated ?? ctx?.mountTranslated ?? false;
  // 源文件缺失文案要的是「无可并排的最终译文」，显式取 sourceViewOnly。
  const sourceViewOnly = props.sourceViewOnly ?? ctx?.sourceViewOnly ?? false;
  const sourceUrl = props.sourceUrl ?? ctx?.sourceUrl ?? "";
  const translatedUrl = props.translatedUrl ?? ctx?.translatedUrl ?? "";
  const sourceFile = props.sourceFile ?? ctx?.sourceFile ?? null;
  const translatedFile = props.translatedFile ?? ctx?.translatedFile ?? null;
  const onMetrics = props.onMetrics ?? ctx?.onMetrics;
  const onNumPagesChange = props.onNumPagesChange ?? ctx?.onNumPagesChange;
  const activeRegion = props.activeRegion ?? ctx?.activeRegion;
  const regions = props.regions ?? ctx?.regions ?? [];


  const readerMetadata = props.readerMetadata ?? ctx?.readerMetadata;
  // 悬停的内容块两栏共享：鼠标在哪栏，左右都画同一块的红框（各自复制本栏的文字）。
  // 外壳给了共享 store 时 Markdown 面板也在同一个圈里（PDF 悬停 → 面板跟着高亮）。
  const hoverStore = ctx?.regionHover ?? null;
  const [localHoveredRegionId, setLocalHoveredRegionId] = useState<string | null>(null);
  const sharedHoveredRegionId = useSyncExternalStore(
    hoverStore ? hoverStore.subscribe : noopSubscribe,
    hoverStore ? () => hoverStore.get().itemId : nullSnapshot,
    hoverStore ? () => hoverStore.get().itemId : nullSnapshot,
  );
  const hoveredRegionId = hoverStore ? sharedHoveredRegionId : localHoveredRegionId;
  const handleHoverRegion = useCallback((itemId: string | null) => {
    if (hoverStore) hoverStore.set(itemId, "pdf");
    else setLocalHoveredRegionId(itemId);
  }, [hoverStore]);

  const presentation = resolveReaderGridPresentation({
    mode,
    compareMode,
    showSource,
    showTranslated,
    markdownSplit,
    overlayOnSource,
  });
  // zoom 的产品语义一直相对完整阅读器宽度：Markdown / AI 分栏后 shell
  // 只有半屏，因此用双倍基准保持 50% 恰好铺满左栏。
  // shell 还没量到（首帧，shellWidth 是 0）时**不传 override** —— 让
  // PdfDocumentPane 自己去量 scrollRoot.clientWidth。传一个假基准的后果见
  // use-reader-shell.ts 上面那段：第一次画错、200ms 后整页跳一次。
  const shellMeasured = Number.isFinite(shellWidth) && shellWidth > 0;
  const pageWidthBasis = shellMeasured
    ? resolveReaderPageWidthBasis(
      shellWidth,
      markdownSplit || assistantSplit,
      typeof document === "undefined" ? shellWidth * 2 : document.documentElement.clientWidth,
    )
    : null;
  // 阅读区变宽变窄（Studio 里开关右栏、拖分栏）时停在原来那一页，不让页高变化把眼前换成别的页。
  useKeepPageOnResize(shellEl, pageWidthBasis);

  return (
    <div
      ref={bindShell}
      className={READER_SCROLL_SHELL_CLASS}
      data-reader-region-count={regions.length}
      data-reader-structured-region-count={regions.filter(isStructuredReaderRegion).length}
      data-reader-metadata-ready={readerMetadata ? "true" : "false"}
    >
      <main
        className={`${READER_GRID_CLASS} reader-mode-${presentation.mode}`}
        data-reader-mode={markdownSplit ? "markdown-split" : assistantSplit ? "assistant-split" : mode}
      >
        {mountSource ? (
          <PdfDocumentPane
            pane="source"
            url={sourceUrl}
            preloadedFile={sourceFile}
            userZoom={userZoom}
            visible={presentation.showSource}
            scrollRoot={shellEl}
            pageWidthOverride={pageWidthBasis}
            rowHeights={presentation.compareMode ? rowHeights : undefined}
            onMetrics={onMetrics}
            emptyLabel={
              sourceViewOnly
                ? "源文件不可用：该文档没有可读取的源 PDF。"
                : "暂无原文 PDF"
            }
            onNumPagesChange={onNumPagesChange}
            activeRegion={activeRegion}
            regions={regions}
            readerMetadata={readerMetadata}
            hoveredRegionId={hoveredRegionId}
            onHoverRegion={handleHoverRegion}
            // 流式译文直接叠加在源栏原文 PDF 上（overlayOnSource，用户主动触发）。
            // 对照态不再消栏：右栏（最终译文 PDF）照常保留。叠加 badge 由
            // sourcePaneAction 组合透出，避免与「左右都是中文」混淆。
            liveTranslation={overlayOnSource ? liveTranslation : undefined}
            showLiveTranslation={overlayOnSource}
            liveTranslationPendingLabel={overlayOnSource
              ? liveTranslationPendingCopy(liveTranslation)
              : ""}
            paneAction={overlayOnSource ? (
              <>
                {props.sourcePaneAction}
                <span
                  className="reader-source-overlay-badge"
                  data-source-overlay-badge="true"
                  title="源栏正在叠加实时译文，右栏为最终译文 PDF"
                >
                  原文+实时译文叠加
                </span>
              </>
            ) : props.sourcePaneAction}
          />
        ) : null}
        {mountTranslated ? (
          <PdfDocumentPane
            pane="translated"
            url={translatedUrl}
            preloadedFile={translatedFile}
            userZoom={userZoom}
            visible={presentation.showTranslated}
            scrollRoot={shellEl}
            pageWidthOverride={pageWidthBasis}
            rowHeights={presentation.compareMode ? rowHeights : undefined}
            onMetrics={onMetrics}
            emptyLabel="暂无译文 PDF"
            onNumPagesChange={onNumPagesChange}
            activeRegion={activeRegion}
            regions={regions}
            readerMetadata={readerMetadata}
            hoveredRegionId={hoveredRegionId}
            onHoverRegion={handleHoverRegion}
            // 译文 PDF 栏就是最终译文本身，绝不叠加流式画布。
            liveTranslation={undefined}
            showLiveTranslation={false}
          />
        ) : null}
      </main>
    </div>
  );
}
