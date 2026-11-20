import { type ReactElement, type ReactNode } from "react";
export type ReaderFinderTab = "outline" | "search";
/** 顶栏左边的两颗：点开左栏到那一页签，再点同一颗收起。 */
export declare function ReaderFinderToggles({ open, onToggle, children, }: {
    open: ReaderFinderTab | null;
    onToggle: (tab: ReaderFinderTab) => void;
    /** 跟在两颗后面的（「对比版本」）。 */
    children?: ReactNode;
}): ReactElement;
/** 块从阅读页的 context 来，眼下的页（目录里标出在哪一节）从 HUD context 来。 */
export declare function ReaderFinder({ tab, onTab, onClose, onJump, query, onQuery, term, focusSignal, }: {
    tab: ReaderFinderTab;
    onTab: (tab: ReaderFinderTab) => void;
    onClose: () => void;
    onJump: (itemId: string) => void;
    /** 输入框里的字（每敲一下就变）。 */
    query: string;
    onQuery: (query: string) => void;
    /** 防抖后的搜索词：列命中、书页标命中都按它，不每敲一下就扫全书。 */
    term: string;
    /** 每变一次把光标放回搜索框（Cmd/Ctrl+F 在左栏已经开着时）。 */
    focusSignal?: number;
}): ReactElement;
//# sourceMappingURL=ReaderFinder.d.ts.map