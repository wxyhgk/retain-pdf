// Reader 级 Context：承载外壳组件最常下钻的少量 controller 值。
//
// 只放进「消费方多、且目前纯透传」的字段，避免把整个 controller 公开面
// 倒进一个全局对象。高频变化的 currentPage/numPages 单独立一个 HUD context，
// 让滚动只重渲染底栏，而不是所有外壳。
import { createContext, useContext, type ReactNode } from "react";
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
