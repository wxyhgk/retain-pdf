export declare function canReturnToReaderReferrer(referrer: string, currentHref: string, historyLength: number): boolean;
/** 从阅读页回主页 */
export declare function navigateReaderToHome(): void;
export declare function ReaderCloseHome({ onBeforeClose }?: {
    onBeforeClose?: () => void;
}): import("react").JSX.Element;
/**
 * 「笔记」：放在笔记（Studio）里、Studio 认 open-notes 时才有（宿主给 notesPanel）。点了让 Studio 在阅读页旁边开、收这本书的笔记；
 * 按下没有跟着 Studio 说的走（它那边收起、换了笔记也会告诉我们）。只有图标，「笔记：书名」在悬停里。
 */
export declare function ReaderNotesToggle(): import("react").JSX.Element;
//# sourceMappingURL=ReaderCloseHome.d.ts.map