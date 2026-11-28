import { type ReactElement, type ReactNode } from "react";
export type ReaderFinderTab = "search" | "bookmarks" | "issues";
/** 顶栏左段的「搜索」（放大镜 + 待改几处的灰数字；2026-11-28 起两条栏只用图标，「搜索」两个字去掉）：开 / 收左栏，开的是上次那一页签。
 *  children 跟在后面（以前放「对比版本」，2026-11-20 挪进右下角的悬浮小球）。 */
export declare function ReaderFinderToggles({ open, onToggle, issueCount, children, }: {
    open: ReaderFinderTab | null;
    onToggle: () => void;
    /** 待改几处（0 不写）。 */
    issueCount?: number;
    children?: ReactNode;
}): ReactElement;
/** 「搜索」开关（2026-11-20 在底栏；2026-11-27 起底栏不放了，搜索在左栏的页签里、⌘F）。留着给宿主自己摆。 */
export declare function ReaderSearchToggle({ open, onToggle }: {
    open: ReaderFinderTab | null;
    onToggle: (tab: ReaderFinderTab) => void;
}): ReactElement;
/** 块从阅读页的 context 来，眼下的页（目录里标出在哪一节）从 HUD context 来。 */
export declare function ReaderFinder({ tab, onTab, onClose, onJump, query, onQuery, term, focusSignal, pinned, bookmarkPane, issuesPane, issueCount, }: {
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
    /** 实占一栏（屏够宽时）：点书、Esc 都不收。不给是浮着（窄屏）。 */
    pinned?: boolean;
    /** 「书签」页签的内容（ReaderBookmarkList）；不给就没有这个页签。 */
    bookmarkPane?: ReactNode;
    /** 「待处理」页签的内容（ReaderIssueList）；没有待处理时不给，就没有这个页签。 */
    issuesPane?: ReactNode;
    issueCount?: number;
}): ReactElement;
//# sourceMappingURL=ReaderFinder.d.ts.map