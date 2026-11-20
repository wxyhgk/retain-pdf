import { type ReactElement, type ReactNode } from "react";
export type ReaderFinderTab = "outline" | "search";
/** 顶栏左边的「目录」（只有图标，名字在悬停里）：点开浮着的卡，再点收起。「搜索」在底栏（ReaderSearchToggle）。
 *  children 跟在后面（以前放「对比版本」，2026-11-20 挪进右下角的悬浮小球）。 */
export declare function ReaderFinderToggles({ open, onToggle, children, }: {
    open: ReaderFinderTab | null;
    onToggle: (tab: ReaderFinderTab) => void;
    children?: ReactNode;
}): ReactElement;
/** 底栏的「搜索」（2026-11-20 从顶栏挪下来）：点开的卡也从底栏往上弹。 */
export declare function ReaderSearchToggle({ open, onToggle }: {
    open: ReaderFinderTab | null;
    onToggle: (tab: ReaderFinderTab) => void;
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