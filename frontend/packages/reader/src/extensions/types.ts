// 阅读页的贡献表（2026-11-27，docs/ops/planning/reader-redesign/）：功能写成「扩展」，往几个固定的口子里登记自己的东西，
// 阅读页按表画出来；加一个功能不用再改 ReaderAppReactPdf。现在只给内置扩展用，口子的形状照着以后的插件定。
import type { ComponentType, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import type { PdfOutlineNode } from "../pdf/pdf-outline.js";
import type { ReaderMetadata, ReaderRegion } from "../shared/data/reader-regions.js";
import type { ReaderAssistantPanel } from "../shared/types/reader-assistant-panels.js";

/** 扩展能看到、能用的阅读页：正在读的书、书的块和目录、几个动作。阅读页状态变了就换一个新对象。 */
export type ReaderApi = {
  documentId: string;
  jobId: string;
  /** 正在读的译文版本；没有是 null。 */
  versionId: string | null;
  regions: readonly ReaderRegion[];
  metadata: ReaderMetadata | null;
  bookmarks: readonly PdfOutlineNode[];
  pageCount: number;
  /** 换书、换任务时变：扩展据此丢掉上一本书的状态。 */
  resetKey: string;
  /** 悬停框现在认出的块。 */
  hoveredItemId: () => string | null;
  goToPage: (page: number, pane?: "source" | "translated") => void;
  /** 纯本地 PDF（没有任务）：要任务的功能（Markdown……）用不了。 */
  sourceOnly: boolean;
  /** 开着哪个面板（扩展定义里 panels 的 id），没开是 null。 */
  activePanel: ReaderAssistantPanel | null;
  closePanel: () => void;
};

/** 右键书页的那一下：点在哪个元素、屏幕坐标、第几页（认不出是 0）。 */
export type ReaderMenuContext = { target: Element; clientX: number; clientY: number; page: number };

/** 右键菜单画笔那一排上面的一项。 */
export type ReaderMenuItem = { key: string; label: string; hint?: string; onSelect: () => void };

/** 每一页上叠一层（页边的标记之类）：页码和这一页的原始高度（PDF 点）。 */
export type ReaderPageLayerProps = { page: number; height: number };

/** 快捷键说明里列出来的一条（扩展自己监听按键，这里只是说明）。 */
export type ReaderShortcut = { keys: string; desc: string };

/** 一个扩展往阅读页上放的东西；每一项都可以没有。 */
export type ReaderContribution = {
  /** 右键书页时问一次，给这一下要加的菜单项（同步算，不能等）。 */
  menuItems?: (context: ReaderMenuContext) => readonly ReaderMenuItem[];
  /** 每一页上画的一层。 */
  pageLayer?: (props: ReaderPageLayerProps) => ReactNode;
  /** 快捷键说明里单独一组，组名是扩展的 title。 */
  shortcuts?: readonly ReaderShortcut[];
};

/**
 * 扩展的一个面板（右边停靠的那种，同一时间只开一个）：启动器（右下角小球）上一颗按钮、开着时顶上的 tab。
 * 写在扩展定义上、不走运行时登记：面板开没开要按书存、重开阅读页恢复，id 必须是 shared/types/reader-assistant-panels 里登记过的
 * （类型上就卡住）；面板内容由扩展自己画（看 useReaderApi().activePanel）。
 */
export type ReaderPanelTab = {
  id: ReaderAssistantPanel;
  /** 按钮、tab 上的字。 */
  label: string;
  /** 窄的时候的缩写。 */
  short: string;
  Icon: LucideIcon;
  /** 没有任务（纯本地 PDF）时禁用并说明原因。 */
  needsJob: boolean;
};

/**
 * 一个扩展：一个组件，挂在阅读页根节点里浮层的位置，用 useReaderApi() 读阅读页、useReaderContribution() 登记贡献。
 * 它画出来的就是它盖在阅读页上的东西（浮动窗口……），没有就 return null。浮层不放进贡献表：那样扩展里每变一下都要经表让整个阅读页重画
 * （2026-11-27 真机试出来过：表 → 阅读页重画 → 扩展重画 → 新元素又登记，React #185 死循环）。
 */
export type ReaderExtension = { id: string; title: string; Component: ComponentType; panels?: readonly ReaderPanelTab[] };
