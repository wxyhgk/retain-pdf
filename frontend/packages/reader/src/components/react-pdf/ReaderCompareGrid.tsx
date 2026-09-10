import type { ReactElement } from "react";
import { PdfDocumentPane } from "../../pdf/PdfDocumentPane.js";
import type { ProtectedPdfFile } from "../../pdf/useProtectedPdfFile.js";
import type { PageRowHeights } from "../../pdf/usePageRowSync.js";
import {
  READER_SCROLL_SHELL_CLASS,
  READER_SCROLL_SHELL_ID,
} from "../../pdf/reader-dom-contract.js";
import {
  isStructuredReaderRegion,
  type ReaderMetadata,
  type ReaderRegion,
  type ReaderRegionSelection,
} from "../../shared/data/reader-regions.js";
import type { LiveTranslationState } from "../../shared/data/live-translation-state.js";

export type ReaderCompareGridProps = {
  mode: string; // ReaderMode
  bindShell: (node: HTMLDivElement | null) => void;
  shellEl: HTMLElement | null;
  userZoom: number;
  compareMode: boolean;
  /** 阅读区全宽（shell），用于 zoom% 相对整屏计算 */
  shellWidth: number;
  /** @deprecated 保留兼容，页宽不再用半栏 */
  compareColWidth?: number;
  rowHeights?: PageRowHeights;
  mountSource: boolean;
  mountTranslated: boolean;
  showSource: boolean;
  showTranslated: boolean;
  sourceOnly: boolean;
  sourceUrl: string;
  translatedUrl: string;
  sourceFile: ProtectedPdfFile | null;
  translatedFile: ProtectedPdfFile | null;
  onMetrics: () => void;
  onNumPagesChange: (pages: number, pane: "source" | "translated") => void;
  activeRegion?: ReaderRegion | null;
  regions?: ReaderRegion[];
  readerMetadata?: ReaderMetadata | null;
  onSelectRegion?: (selection: ReaderRegionSelection) => void;
  markdownSplit?: boolean;
  assistantSplit?: boolean;
  reversePanes?: boolean;
  liveTranslation?: LiveTranslationState;
  /** Running translation: stable source PDF on the left, source-backed live canvas on the right. */
  liveTranslationPair?: boolean;
};

export function resolveReaderGridPresentation({
  mode,
  compareMode,
  showSource,
  showTranslated,
  markdownSplit,
  liveTranslationPair = false,
}: Pick<ReaderCompareGridProps, "mode" | "compareMode" | "showSource" | "showTranslated"> & {
  markdownSplit: boolean;
  liveTranslationPair?: boolean;
}) {
  if (liveTranslationPair) {
    return {
      mode: "compare",
      compareMode: true,
      showSource: true,
      showTranslated: true,
    };
  }
  const splitSourceCompare = markdownSplit && mode === "compare";
  return {
    mode: splitSourceCompare ? "source" : mode,
    compareMode: compareMode && !markdownSplit,
    showSource: splitSourceCompare ? true : showSource,
    showTranslated: splitSourceCompare ? false : showTranslated,
  };
}

export function resolveReaderPageWidthBasis(
  shellWidth: number,
  sidePanelSplit: boolean,
  viewportWidth = shellWidth * 2,
): number {
  if (!sidePanelSplit) return shellWidth;
  // 切换到 Markdown / AI 时，ResizeObserver 会晚一帧才把 shellWidth 从整屏
  // 更新成半屏。用 viewport 封顶可保证前后两帧得到同一个页面宽度，避免
  // PDF 先放大再缩回，看起来像重新加载。
  return Math.min(shellWidth * 2, viewportWidth);
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
  const {
    mode,
    bindShell,
    shellEl,
    userZoom,
    compareMode,
    shellWidth,
    rowHeights,
    mountSource,
    mountTranslated,
    showSource,
    showTranslated,
    sourceOnly,
    sourceUrl,
    translatedUrl,
    sourceFile,
    translatedFile,
    onMetrics,
    onNumPagesChange,
    activeRegion,
    regions = [],
    readerMetadata,
    onSelectRegion,
    markdownSplit = false,
    assistantSplit = false,
    reversePanes = false,
    liveTranslation,
    liveTranslationPair = false,
  } = props;

  const presentation = resolveReaderGridPresentation({
    mode,
    compareMode,
    showSource,
    showTranslated,
    markdownSplit,
    liveTranslationPair,
  });
  // zoom 的产品语义一直相对完整阅读器宽度：Markdown / AI 分栏后 shell
  // 只有半屏，因此用双倍基准保持 50% 恰好铺满左栏。
  const pageWidthBasis = resolveReaderPageWidthBasis(
    shellWidth,
    markdownSplit || assistantSplit,
    typeof document === "undefined" ? shellWidth * 2 : document.documentElement.clientWidth,
  );

  return (
    <div
      ref={bindShell}
      id={READER_SCROLL_SHELL_ID}
      className={READER_SCROLL_SHELL_CLASS}
      data-reader-scroll-shell="true"
      data-reader-region-count={regions.length}
      data-reader-structured-region-count={regions.filter(isStructuredReaderRegion).length}
      data-reader-metadata-ready={readerMetadata ? "true" : "false"}
    >
      <main
        className={`reader-react-grid reader-mode-${presentation.mode}${reversePanes ? " is-reversed" : ""}`}
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
              sourceOnly
                ? "源文件不可用：该文档没有可读取的源 PDF。"
                : "暂无原文 PDF"
            }
            onNumPagesChange={onNumPagesChange}
            activeRegion={activeRegion}
            regions={regions}
            readerMetadata={readerMetadata}
            onSelectRegion={onSelectRegion}
            liveTranslation={liveTranslationPair ? undefined : liveTranslation}
            showLiveTranslation={!liveTranslationPair}
          />
        ) : null}
        {mountTranslated || liveTranslationPair ? (
          <PdfDocumentPane
            pane="translated"
            url={liveTranslationPair ? sourceUrl : translatedUrl}
            preloadedFile={liveTranslationPair ? sourceFile : translatedFile}
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
            onSelectRegion={onSelectRegion}
            liveTranslation={liveTranslationPair ? liveTranslation : undefined}
            showLiveTranslation={liveTranslationPair}
            liveTranslationPendingLabel={liveTranslationPair
              ? liveTranslationPendingCopy(liveTranslation)
              : ""}
          />
        ) : null}
      </main>
    </div>
  );
}
