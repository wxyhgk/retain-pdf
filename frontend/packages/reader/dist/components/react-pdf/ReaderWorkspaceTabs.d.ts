import type { ReactElement } from "react";
import type { LiveTranslationState } from "../../shared/data/live-translation-state.js";
export type ReaderWorkspaceView = "reading" | "compare" | "markdown" | "ai";
export type ReaderWorkspaceMode = "source" | "compare" | "translated";
export type ReaderWorkspaceTabsProps = {
    mode: ReaderWorkspaceMode;
    documentReady: boolean;
    sourceOnly?: boolean;
    onModeChange: (mode: ReaderWorkspaceMode) => void;
    liveTranslation?: {
        visible: boolean;
        state: LiveTranslationState;
        onToggle: () => void;
    } | null;
};
export declare function liveTranslationStatusCopy(state: LiveTranslationState): string;
export declare function isReaderWorkspaceDisabled(input: {
    id: ReaderWorkspaceMode;
    documentReady: boolean;
    sourceOnly: boolean;
    liveTranslationAvailable: boolean;
}): boolean;
export declare function ReaderWorkspaceTabs({ mode, documentReady, sourceOnly, onModeChange, liveTranslation, }: ReaderWorkspaceTabsProps): ReactElement;
//# sourceMappingURL=ReaderWorkspaceTabs.d.ts.map