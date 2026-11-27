// Reader 级 Context：承载外壳组件最常下钻的少量 controller 值。
//
// 只放进「消费方多、且目前纯透传」的字段，避免把整个 controller 公开面
// 倒进一个全局对象。高频变化的 currentPage/numPages 单独立一个 HUD context，
// 让滚动只重渲染底栏，而不是所有外壳。
import { createContext, useContext, type ReactNode } from "react";
import type { PdfOutlineNode } from "../../pdf/pdf-outline.js";
import type { RegionPdfDocument } from "../../pdf/RegionCanvas.js";
import type { ReaderTextMark } from "../../shared/content/reader-text-marks.js";
import type { ReaderPageLayer } from "../../extensions/registry.js";
import type { ReaderComparedDocument } from "../../extensions/types.js";
import type { ReaderPaneModel } from "../../hooks/use-reader-pane-model.js";
import type { ReaderDownloadContext } from "../../hooks/use-reader-session.js";
import type {
  ReaderMetadata,
  ReaderRegion,
} from "../../shared/data/reader-regions.js";
import type { RegionHoverStore } from "../../shared/state/region-hover-store.js";
import type { ProtectedPdfFile } from "../../pdf/useProtectedPdfFile.js";
import type { PageRowHeights } from "../../pdf/usePageRowSync.js";
import type { ReaderAssistantPanel } from "./reader-assistant-types.js";
import type { ReaderBlockEdit } from "../../hooks/use-reader-block-edit.js";
import type { ReaderInk } from "../../hooks/use-reader-ink.js";

export type ReaderContextValue = {
  // shell / zoom
  bindShell: (node: HTMLDivElement | null) => void;
  shellEl: HTMLElement | null;
  shellWidth: number;
  userZoom: number;
  onZoomChange: (zoom: number) => void;
  rowHeights: PageRowHeights;
  // panes
  mountSource: boolean;
  mountTranslated: boolean;
  onMetrics: () => void;
  onNumPagesChange: ReaderPaneModel["onNumPages"];
  // files
  sourceUrl: string;
  translatedUrl: string;
  sourceFile: ProtectedPdfFile | null;
  translatedFile: ProtectedPdfFile | null;
  // regions
  regions: ReaderRegion[];
  readerMetadata: ReaderMetadata | null;
  activeRegion: ReaderRegion | null;
  /** 悬停块：两栏 PDF 和 Markdown 面板共享。没给（单测里直接渲染组件）时各管各的。 */
  regionHover?: RegionHoverStore;
  /** 滚到这一块所在的页并闪一下红框（和 AI 引用回跳同一条路）。 */
  jumpToBlock?: (itemId: string) => void;
  /** 改过的块（阅读页块编号 → 改过几次）：译文栏画小标记，悬停写「改过 N 次」。 */
  revisedBlocks?: ReadonlyMap<string, number>;
  /** 某一栏的 PDF 读出了自带书签（目录卡用）。 */
  onPdfOutline?: (outline: PdfOutlineNode[], pane: "source" | "translated") => void;
  /** 某一栏的 PDF 读好了（放大查看要用它重新画一块）。 */
  onPdfDocument?: (pdf: RegionPdfDocument, pane: "source" | "translated") => void;
  /** 放大查看这一块（悬停框的「放大」、双击图片）。 */
  zoomBlock?: (itemId: string) => void;
  /** 扩展登记的每页一层（贡献表的 pageLayer，例如提问的「?」），按扩展顺序叠在书页上。 */
  pageLayers?: readonly ReaderPageLayer[];
  /** 扩展给的文字层标记（贡献表的 textMarks 合在一起，例如交叉引用）：书页文字层把这些段包成 <mark>。没人给是 null。 */
  textMarks?: ((text: string) => readonly ReaderTextMark[]) | null;
  /** 译文栏悬停框的「改」：这一段变成编辑框。不能改时不给。 */
  editBlock?: (itemId: string) => void;
  /** 改译文的状态：正在改哪一段（译文栏在那里画编辑框）、写回了还没排进 PDF 的译文（先盖在 PDF 上）。 */
  blockEdit?: ReaderBlockEdit;
  /** 编辑框里要不要带一行原文：只看译文时要，对照时左边就是原文。 */
  editShowsSource?: boolean;
  /** 左栏搜索的词（防抖后）：书页文字层把命中标出来（PdfPageSlot）。空串不标。 */
  findTerm?: string;
  /** 画笔：笔迹和当前工具（hooks/use-reader-ink.ts）；每页的 InkLayer 画出来、画笔模式下接住拖动。 */
  ink?: ReaderInk;
  /** 「对比版本」：左栏换成这一份译文（地址、块；块的 source 已换成那一份的译文）。null = 左栏照常是原文。 */
  compareVersion?: ReaderComparedDocument | null;
  // 和 regions 走同一条路下去，因为它们用的是同一套 bbox 投影。
  // session
  /**
   * 真源语义 =「无 job」：判断 Markdown / AI / 收藏等需要任务的能力。
   * 仅 FAB 工具禁用等「无 job」场景取用；不要用它判断能否并排。
   */
  sourceOnly: boolean;
  /**
   * 真源语义 =「无可并排的最终译文」(sourceOnly || !translatedUrl)。
   * Grid 源文件缺失文案、Workspace tabs 对照/译文禁用取用。
   * 与 sourceOnly 语义不同，消费方必须显式选择，禁止互相顶替。
   */
  sourceViewOnly: boolean;
  download: ReaderDownloadContext;
  goToPage: (page: number, pane?: "source" | "translated") => void;
  // assistant actions (reader app 本地)
  assistant: {
    select: (panel: ReaderAssistantPanel) => void;
    close: () => void;
  };
  /** 「深色文档」：PDF 页黑底白字（hooks/use-reader-doc-theme.ts）。底栏开关读这两个；不给就不显示开关。 */
  docDark?: boolean;
  toggleDocDark?: () => void;
};

export type ReaderHudContextValue = {
  currentPage: number;
  numPages: number;
};

export type ReaderProviderProps = {
  value: ReaderContextValue;
  hud: ReaderHudContextValue;
  children: ReactNode;
};

const ReaderContext = createContext<ReaderContextValue | null>(null);
const ReaderHudContext = createContext<ReaderHudContextValue | null>(null);

export function ReaderProvider({ value, hud, children }: ReaderProviderProps): ReactNode {
  return (
    <ReaderContext.Provider value={value}>
      <ReaderHudContext.Provider value={hud}>{children}</ReaderHudContext.Provider>
    </ReaderContext.Provider>
  );
}

/** 无 Provider 时返回 null（组件/单测可继续用显式 props）。 */
export function useReaderContext(): ReaderContextValue | null {
  return useContext(ReaderContext);
}

/** 无 Provider 时返回 null（HUD 单测可继续用显式 props）。 */
export function useReaderHudContext(): ReaderHudContextValue | null {
  return useContext(ReaderHudContext);
}
