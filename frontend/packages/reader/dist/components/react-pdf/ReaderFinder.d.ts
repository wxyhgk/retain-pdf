import { type ReactElement, type ReactNode } from "react";
import type { PdfOutlineNode } from "../../pdf/pdf-outline.js";
export type ReaderFinderTab = "outline" | "search" | "bookmarks" | "issues";
/** 顶栏左边那颗（只有图标，名字在悬停里）：开 / 收左栏，开的是上次那一页签。待处理有几处时角上带个数。
 *  children 跟在后面（以前放「对比版本」，2026-11-20 挪进右下角的悬浮小球）。 */
export declare function ReaderFinderToggles({ open, onToggle, issueCount, children, }: {
    open: ReaderFinderTab | null;
    onToggle: () => void;
    /** 待处理几处（0 不画角标）。 */
    issueCount?: number;
    children?: ReactNode;
}): ReactElement;
/** 「搜索」开关（2026-11-20 在底栏；2026-11-27 起底栏不放了，搜索在左栏的页签里、⌘F）。留着给宿主自己摆。 */
export declare function ReaderSearchToggle({ open, onToggle }: {
    open: ReaderFinderTab | null;
    onToggle: (tab: ReaderFinderTab) => void;
}): ReactElement;
/** 块从阅读页的 context 来，眼下的页（目录里标出在哪一节）从 HUD context 来。 */
export declare function ReaderFinder({ tab, onTab, onClose, onJump, query, onQuery, term, focusSignal, bookmarks, onJumpPage, pinned, onPin, bookmarkPane, issuesPane, issueCount, }: {
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
    /** PDF 自带的书签（有就默认按书签看目录）。 */
    bookmarks?: readonly PdfOutlineNode[];
    /** 点书签：跳到那一页。 */
    onJumpPage?: (page: number) => void;
    /** 钉在左边（书页区让位）：点书、Esc 都不收。 */
    pinned?: boolean;
    /** 栏头的「钉住 / 不钉」；不给就没有这颗（窄屏钉不住）。 */
    onPin?: (pinned: boolean) => void;
    /** 「书签」页签的内容（ReaderBookmarkList）；不给就没有这个页签。 */
    bookmarkPane?: ReactNode;
    /** 「待处理」页签的内容（ReaderIssueList）；没有待处理时不给，就没有这个页签。 */
    issuesPane?: ReactNode;
    issueCount?: number;
}): ReactElement;
//# sourceMappingURL=ReaderFinder.d.ts.map