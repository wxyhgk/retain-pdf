import type { ComponentType, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { PdfOutlineNode } from "../pdf/pdf-outline.js";
import type { ReaderMetadata, ReaderRegion } from "../shared/data/reader-regions.js";
import type { ReaderAssistantPanel } from "../shared/types/reader-assistant-panels.js";
import type { ReaderVersionOption } from "../contracts/session.js";
import type { ReaderPaneId } from "../pdf/reader-dom-contract.js";
import type { RegionPdfDocument } from "../pdf/RegionCanvas.js";
import type { ReaderTextMark } from "../shared/content/reader-text-marks.js";
/** 扩展能看到、能用的阅读页：正在读的书、书的块和目录、几个动作。阅读页状态变了就换一个新对象。 */
export type ReaderApi = {
    documentId: string;
    jobId: string;
    /** 正在读的译文版本；没有是 null。 */
    versionId: string | null;
    /** 这本书的几份译文（宿主给了版本端口才有）。 */
    translationVersions: readonly ReaderVersionOption[];
    regions: readonly ReaderRegion[];
    metadata: ReaderMetadata | null;
    bookmarks: readonly PdfOutlineNode[];
    pageCount: number;
    /** 换书、换任务时变：扩展据此丢掉上一本书的状态。 */
    resetKey: string;
    /** 悬停框现在认出的块。 */
    hoveredItemId: () => string | null;
    goToPage: (page: number, pane?: "source" | "translated") => void;
    /** 跳到某一块（读到的位置记进阅读历史）。 */
    jumpToBlock: (itemId: string, pane?: ReaderPaneId) => void;
    /** 现在读到第几页（读的时候才取，不跟着翻页重画扩展）。 */
    currentPage: () => number;
    /** 把这一块的译文变成编辑框（只开着原文时先切到对照）；draft 给了就先填进去（存之前还能改）。这本书现在不能改（没译文、在处理、拼出来的书）是 null；表格这类不能改的块什么都不做。 */
    editBlock: ((itemId: string, draft?: string) => void) | null;
    /** 书页的滚动外壳（扩展在它上面接事件：悬停预览……）；还没挂上是 null。 */
    shellEl: HTMLElement | null;
    /** 主栏（单栏时就是那一栏，对照时是原文栏）。 */
    primaryPane: ReaderPaneId;
    /** 各栏读好的 PDF（画某一块的放大图、预览用）；还没读好是 null。 */
    pdfDocuments: {
        source: RegionPdfDocument | null;
        translated: RegionPdfDocument | null;
    };
    /** 纯本地 PDF（没有任务）：要任务的功能（Markdown……）用不了。 */
    sourceOnly: boolean;
    /** 开着哪个面板（扩展定义里 panels 的 id），没开是 null。 */
    activePanel: ReaderAssistantPanel | null;
    closePanel: () => void;
    /** 现在看的是原文 / 对照 / 译文。 */
    visibleMode: "source" | "compare" | "translated";
    /** 切原文 / 对照 / 译文（保持读到的页）。 */
    setWorkspace: (mode: "source" | "compare" | "translated") => void;
};
/** 右键书页的那一下：点在哪个元素、屏幕坐标、第几页（认不出是 0）。 */
export type ReaderMenuContext = {
    target: Element;
    clientX: number;
    clientY: number;
    page: number;
};
/** 右键菜单画笔那一排上面的一项。 */
export type ReaderMenuItem = {
    key: string;
    label: string;
    hint?: string;
    onSelect: () => void;
};
/**
 * 每一页上叠一层（页边的标记、笔迹……）：页码、这一页画出来的宽高（像素）、哪一栏（对比版本时左栏是 "compare"）、
 * 这一页现在画没画（离视口远的页只是占位，active 是 false，重的层可以先不画）。
 */
export type ReaderPageLayerProps = {
    page: number;
    width: number;
    height: number;
    pane: "source" | "translated" | "compare";
    active: boolean;
};
/** 右下角小球里的一颗按钮。给了 popup 的点了在小球旁边弹出它（done 收起），没给的点了调 onClick 再收起小球。 */
export type ReaderToolbarItem = {
    key: string;
    label: string;
    /** 悬停说明；不给用 label。 */
    title?: string;
    Icon: LucideIcon;
    /** 按下的样子（开着、正在用）；小球本身也会跟着亮。 */
    pressed?: boolean;
    onClick?: () => void;
    popup?: (done: () => void) => ReactNode;
};
/** 对照时左栏换成的另一份 PDF（对比版本）：地址、块（source 已换成那一份的字）、两栏书页上的水印。 */
export type ReaderComparedDocument = {
    url: string;
    regions: ReaderRegion[];
    left: {
        name: string;
        createdAt: string;
    };
    right: {
        name: string;
        createdAt: string;
    };
};
/** 快捷键说明里列出来的一条（扩展自己监听按键，这里只是说明）。 */
export type ReaderShortcut = {
    keys: string;
    desc: string;
};
/** 一个扩展往阅读页上放的东西；每一项都可以没有。 */
export type ReaderContribution = {
    /** 右键书页时问一次，给这一下要加的菜单项（同步算，不能等）。 */
    menuItems?: (context: ReaderMenuContext) => readonly ReaderMenuItem[];
    /** 每一页上画的一层。 */
    pageLayer?: (props: ReaderPageLayerProps) => ReactNode;
    /** 右键菜单里菜单项下面的一块（画笔的笔和颜色那一排）：page 是右键的那一页（认不出是 0），close 收起菜单。 */
    menuSection?: (context: {
        page: number;
        close: () => void;
    }) => ReactNode;
    /** 这个扩展正占着书页上的指针（画笔模式：拖动是画）：书页不出悬停框、双击不放大、文字层不让拖选。 */
    takesPointer?: boolean;
    /** 快捷键说明里单独一组，组名是扩展的 title。 */
    shortcuts?: readonly ReaderShortcut[];
    /** 右下角小球里的按钮，按扩展顺序（带面板的扩展，面板按钮跟在它的按钮后面）。 */
    toolbarItems?: readonly ReaderToolbarItem[];
    /** 书页文字层里一段字要标出来的几段（包成 <mark>，class 和 data-* 属性由扩展定）；几个扩展的合在一起，重叠的先到的赢。 */
    textMarks?: (text: string) => readonly ReaderTextMark[];
    /** 对照时左栏换成这一份；同时有几个扩展给，用第一个。 */
    comparedDocument?: ReaderComparedDocument | null;
    /** 书页右边让出多宽（px）：扩展自己画的浮层贴在右边时（提问窗贴右边），书页、底栏、小球往左让，不被盖住；几个扩展给，取最大。 */
    reserveRight?: number;
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
export type ReaderExtension = {
    id: string;
    title: string;
    Component: ComponentType;
    panels?: readonly ReaderPanelTab[];
};
//# sourceMappingURL=types.d.ts.map