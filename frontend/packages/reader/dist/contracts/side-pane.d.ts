import type { ReactNode } from "react";
/** 书里的一个位置：锚在原文上。先按块编号找，找不到（重新 OCR 过）就在那一页上找这段原文，都找不到只翻到那一页。 */
export type ReaderAnchor = {
    /** PDF 页码，从 1 数。 */
    page: number;
    /** OCR 块编号（`p129-b000` 这种写法）。 */
    itemId?: string;
    /** 那一块开头的一小段原文（十几个字以上才用来匹配）。 */
    quote?: string;
};
/** 跳的结果：找到那一块并亮起来 / 只翻到了那一页 / 页码不对、没跳。 */
export type ReaderAnchorJump = "block" | "page" | "none";
/** 页边小圆点的颜色：用皮肤的语义色，不写学习系统自己的含义。 */
export type ReaderMarginMarkerTone = "ok" | "danger" | "warn" | "accent" | "muted";
export type ReaderMarginMarker = {
    /** 宿主自己的编号，点了以后原样传回去。 */
    key: string;
    anchor: ReaderAnchor;
    tone: ReaderMarginMarkerTone;
    /** 空心圆（例如「还没测」）。 */
    hollow?: boolean;
    /** 悬停和读屏读出来的字。 */
    label: string;
};
/** 宿主内容拿到的能力。每次渲染给一份新的；函数本身稳定，可以放进 effect 的依赖。 */
export type ReaderSidePaneApi = {
    documentId: string;
    jobId: string;
    /** 左栏现在看到第几页（从 1 数）。 */
    currentPage: number;
    /** 左栏翻到这个位置并把那一块亮一下。 */
    navigateToAnchor: (anchor: ReaderAnchor) => ReaderAnchorJump;
    /** 设页边小圆点（只在这个页签里画）；传空数组清掉。onSelect 是点了某个圆点。 */
    setMarginMarkers: (markers: readonly ReaderMarginMarker[], onSelect?: (key: string) => void) => void;
    /** 关掉第二栏，回到原来的读法。 */
    close: () => void;
};
export type ReaderSidePanePort = {
    /** 顶栏页签上的字，例如「学习」。 */
    label: string;
    /** 这本书出不出这个页签（例如这本书有没有知识图）。没有任务的纯原文也会问，jobId 是空串。 */
    isAvailableFor: (ids: {
        documentId: string;
        jobId: string;
    }) => boolean;
    /** 右栏的内容。 */
    render: (api: ReaderSidePaneApi) => ReactNode;
};
//# sourceMappingURL=side-pane.d.ts.map