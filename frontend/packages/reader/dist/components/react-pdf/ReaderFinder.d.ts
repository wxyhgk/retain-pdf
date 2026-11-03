import { type ReactElement } from "react";
export type ReaderFinderTab = "outline" | "search";
/** 顶栏左边的两颗：点开左栏到那一页签，再点同一颗收起。 */
export declare function ReaderFinderToggles({ open, onToggle }: {
    open: ReaderFinderTab | null;
    onToggle: (tab: ReaderFinderTab) => void;
}): ReactElement;
/** 块从阅读页的 context 来，眼下的页（目录里标出在哪一节）从 HUD context 来。 */
export declare function ReaderFinder({ tab, onTab, onClose, onJump, }: {
    tab: ReaderFinderTab;
    onTab: (tab: ReaderFinderTab) => void;
    onClose: () => void;
    onJump: (itemId: string) => void;
}): ReactElement;
//# sourceMappingURL=ReaderFinder.d.ts.map