import { type ReactElement, type ReactNode } from "react";
import type { LiveTranslationState } from "../../shared/data/live-translation-state.js";
export type ReaderWorkspaceView = "reading" | "compare" | "markdown" | "ai";
export type ReaderWorkspaceMode = "source" | "compare" | "translated";
export type ReaderWorkspaceTabsProps = {
    mode: ReaderWorkspaceMode;
    documentReady: boolean;
    /**
     * 「无可并排的最终译文」(sourceOnly || !translatedUrl)。
     * 与 FAB 的 sourceOnly（无 job）语义不同：禁对照/译文页签看这个。
     */
    sourceViewOnly?: boolean;
    onModeChange: (mode: ReaderWorkspaceMode) => void;
    liveTranslation?: {
        visible: boolean;
        state: LiveTranslationState;
        onToggle: () => void;
        /** 最近译好的那一页（1 起）和跳过去的办法；已经在那一页、或没有时不显示按钮。 */
        latestPage?: number | null;
        currentPage?: number;
        onJumpToLatest?: () => void;
    } | null;
    /** 这次看着它翻完了：顶栏左边换成「翻译完成 · 看对照」。 */
    completion?: {
        onOpenCompare: () => void;
    } | null;
    /** 顶栏左段（2026-11-28 起顶栏是三段：左返回、左栏、书名；中原文 / 对照 / 译文；右面板和看法、下载）。 */
    start?: ReactNode;
    /** 顶栏右段。 */
    end?: ReactNode;
    /** 「对照」后面紧跟的东西（对比版本的 ▾，ReaderBarTools place="compare"；只有一份译文时没有）。 */
    compareExtra?: ReactNode;
};
export declare function liveTranslationStatusCopy(state: LiveTranslationState): string;
export declare function isReaderWorkspaceDisabled(input: {
    id: ReaderWorkspaceMode;
    documentReady: boolean;
    /** 「无可并排的最终译文」；有 live 译文时对照仍可开 */
    sourceViewOnly: boolean;
    liveTranslationAvailable: boolean;
}): boolean;
export declare function ReaderWorkspaceTabs(props: ReaderWorkspaceTabsProps): ReactElement;
//# sourceMappingURL=ReaderWorkspaceTabs.d.ts.map